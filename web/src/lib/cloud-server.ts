import "server-only";
import { createClient } from "@supabase/supabase-js";
import { CloudError } from "./cloud-service";
import type { CloudRepository, CloudRow, Commit, Receipt } from "./cloud-service";

export function cloudConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
}
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(12000) }) } };

export async function authenticate(request: Request) {
  if (!cloudConfigured()) throw new CloudError(503, "Cloud play is not configured yet. Practice mode is available.");
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer [\w.-]+$/.test(header) || header.length > 8192) throw new CloudError(401, "Sign in to use your cloud adventure.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const verifier = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
  // A server network call validates the token. Never trust a supplied user ID or getSession() alone.
  const { data, error } = await verifier.auth.getUser(header.slice(7));
  if (error || !data.user || data.user.is_anonymous) throw new CloudError(401, "Your session expired. Sign in again.");
  const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, options);
  return { user: data.user.id, db };
}
export type Database = Awaited<ReturnType<typeof authenticate>>["db"];
function databaseError() { return new CloudError(503, "Cloud storage is unavailable. Check the database setup and try again."); }

export function repository(db: Database): CloudRepository {
  return {
    async ensure(user, game) {
      const inserted = await db.rpc("hoki_ensure", { p_user: user, p_game: game });
      if (inserted.error) throw databaseError();
      const { data, error } = await db.from("hoki_players").select("game,revision,listed").eq("user_id", user).single();
      if (error || !data) throw databaseError();
      return data as CloudRow;
    },
    async receipt(user, requestId) {
      const { data, error } = await db.from("hoki_receipts").select("fingerprint,notice").eq("user_id", user).eq("request_id", requestId).maybeSingle();
      if (error) throw databaseError();
      return data as Receipt | null;
    },
    async commit(value: Commit) {
      const { data, error } = await db.rpc("hoki_commit", { p_user: value.user, p_expected: value.expected,
        p_request_id: value.requestId, p_fingerprint: value.fingerprint, p_game: value.game, p_listed: value.listed, p_notice: value.notice });
      if (error || !data) throw databaseError();
      return data;
    },
  };
}

export async function readBody(request: Request, limit = 16384): Promise<unknown> {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw new CloudError(415, "Send JSON.");
  if (Number(request.headers.get("content-length")) > limit) throw new CloudError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new CloudError(400, "Missing request body.");
  const parts: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new CloudError(413, "Request is too large."); }
      parts.push(value);
    }
    const joined = new Uint8Array(bytes); let offset = 0;
    for (const part of parts) { joined.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder().decode(joined));
  } catch (e) {
    if (e instanceof CloudError) throw e;
    throw new CloudError(400, "Invalid JSON.");
  } finally { reader.releaseLock(); }
}
export function respond(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Authorization" } });
}
export function failure(error: unknown) {
  return respond({ success: false, error: error instanceof CloudError ? error.message : "Cloud request failed. Refresh or retry your pending action." }, error instanceof CloudError ? error.status : 503);
}
