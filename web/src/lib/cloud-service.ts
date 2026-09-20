import { cloudTransition, cloudView, newCloudGame, parseEnvelope } from "./cloud-rules";
import type { Game } from "./fork-game";

export class CloudError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export type CloudRow = { game: Game; revision: number; listed: boolean };
export type Receipt = { fingerprint: string; notice: string };
export type Commit = { user: string; expected: number; requestId: string; fingerprint: string; game: Game; listed: boolean; notice: string };
export interface CloudRepository {
  ensure(user: string, game: Game): Promise<CloudRow>;
  receipt(user: string, requestId: string): Promise<Receipt | null>;
  commit(value: Commit): Promise<{ status: "committed" | "duplicate" | "conflict" | "reuse" | "rate"; notice?: string }>;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Unsupported request value.");
  return encoded;
}
export async function fingerprint(value: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function readCloud(repo: CloudRepository, user: string, day: string) {
  const row = await repo.ensure(user, newCloudGame(day, user));
  return { ...row, game: cloudView(row.game, day), day };
}
export async function actCloud(repo: CloudRepository, user: string, day: string, body: unknown) {
  let envelope;
  try { envelope = parseEnvelope(body); } catch (e) { throw new CloudError(400, e instanceof Error ? e.message : "Invalid request."); }
  const hash = await fingerprint(envelope);
  const replay = async (receipt: Receipt) => {
    if (receipt.fingerprint !== hash) throw new CloudError(409, "This request ID was already used for a different action.");
    return { ...await readCloud(repo, user, day), notice: receipt.notice };
  };
  const previous = await repo.receipt(user, envelope.requestId);
  if (previous) return replay(previous);
  const row = await repo.ensure(user, newCloudGame(day, user));
  if (envelope.day !== day || envelope.revision !== row.revision) {
    // Another copy may have committed between the receipt and player reads.
    // The SQL commit writes revision and receipt atomically. Recheck before
    // rejecting a stale request, and only replay an exact fingerprint match.
    const committed = await repo.receipt(user, envelope.requestId);
    if (committed) return replay(committed);
    if (envelope.day !== day) throw new CloudError(409, "A new campus day started. Refresh your adventure and try again.");
    throw new CloudError(409, "Your adventure changed in another window. Refresh and repeat this action.");
  }
  let result;
  try { result = cloudTransition(row.game, envelope.action, day); } catch (e) { throw new CloudError(400, e instanceof Error ? e.message : "Invalid action."); }
  const saved = await repo.commit({ user, expected: row.revision, requestId: envelope.requestId, fingerprint: hash,
    game: result.game, notice: result.notice, listed: envelope.action.type === "visibility" ? envelope.action.listed : row.listed });
  if (saved.status === "rate") throw new CloudError(429, "Too many actions. Wait a minute, then try again.");
  if (saved.status === "conflict") throw new CloudError(409, "Your adventure changed in another window. Refresh and repeat this action.");
  if (saved.status === "reuse") throw new CloudError(409, "This request ID was already used for a different action.");
  return { ...await readCloud(repo, user, day), notice: saved.notice ?? result.notice };
}
