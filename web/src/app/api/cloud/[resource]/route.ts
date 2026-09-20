import { authenticate, cloudConfigured, failure, readBody, repository, respond } from "@/lib/cloud-server";
import { actCloud, CloudError, readCloud } from "@/lib/cloud-service";
import { leagueDay, practiceBackup, record, exact } from "@/lib/cloud-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { resource } = await context.params;
    if (resource === "config") return respond({ configured: cloudConfigured() });
    if (!["state", "leaderboard", "backup"].includes(resource)) throw new CloudError(404, "Unknown cloud resource.");
    const { user, db } = await authenticate(request);
    const day = leagueDay();
    if (resource === "state") return respond(await readCloud(repository(db), user, day));
    if (resource === "leaderboard") {
      const metric = new URL(request.url).searchParams.get("metric") ?? "score";
      if (!["score", "logging", "checkins"].includes(metric)) throw new CloudError(400, "Unknown leaderboard category.");
      const { data, error } = await db.rpc("hoki_leaderboard", { p_user: user, p_day: day, p_metric: metric });
      if (error) throw new CloudError(503, "The leaderboard is unavailable. Check the database setup and retry.");
      return respond({ rows: data, day, metric });
    }
    const { data, error } = await db.from("hoki_practice_backups").select("game,updated_at").eq("user_id", user).maybeSingle();
    if (error) throw new CloudError(503, "Your practice backup could not be read.");
    return respond({ backup: data });
  } catch (e) { return failure(e); }
}

export async function POST(request: Request, context: Context) {
  try {
    const { resource } = await context.params;
    if (!["action", "backup"].includes(resource)) throw new CloudError(404, "Unknown cloud resource.");
    const { user, db } = await authenticate(request);
    const body = await readBody(request, resource === "backup" ? 1_000_000 : 16384);
    const day = leagueDay();
    if (resource === "action") return respond(await actCloud(repository(db), user, day, body));
    let game;
    try {
      if (!record(body)) throw new Error("Invalid practice backup.");
      exact(body, ["game"]); game = practiceBackup(body.game, day);
    } catch (e) { throw new CloudError(400, e instanceof Error ? e.message : "Invalid backup."); }
    const { error } = await db.from("hoki_practice_backups").upsert({ user_id: user, game, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new CloudError(503, "Your practice backup could not be saved.");
    return respond({ success: true });
  } catch (e) { return failure(e); }
}
