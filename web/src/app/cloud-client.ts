"use client";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function cloudClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try { client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "hokigotchi.auth.v1" } }); }
  catch { return null; }
  return client;
}
export class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function cloudRequest<T>(path: string, init: RequestInit = {}, expectedUser?: string): Promise<T> {
  const client = cloudClient();
  if (!client) throw new RequestError("Cloud play is not configured yet.", 503);
  const { data, error } = await client.auth.getSession();
  if (error || !data.session || (expectedUser && data.session.user.id !== expectedUser)) throw new RequestError("Sign in again to continue.", 401);
  const response = await fetch(`/api/cloud/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { ...init.headers, "Authorization": `Bearer ${data.session.access_token}`, "Content-Type": "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new RequestError(typeof body.error === "string" ? body.error : "Cloud request failed.", response.status);
  return body as T;
}
