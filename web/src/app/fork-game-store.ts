"use client";
import { useSyncExternalStore } from "react";
import { advanceGame, applyAction, createGame, localDay, restoreGame, STORAGE_KEY } from "@/lib/fork-game";
import type { Action, Game } from "@/lib/fork-game";
import type { CloudAction, Envelope } from "@/lib/cloud-rules";
import { cloudClient, cloudRequest, RequestError } from "./cloud-client";

type Account = { id: string; email: string };
export type CloudState = { game: Game; revision: number; listed: boolean; day: string; notice?: string };
type Snapshot = { game: Game; day: string; notice: string; warning: string; mode: "practice" | "cloud";
  account: Account | null; configured: boolean; status: "ready" | "loading" | "error"; revision: number;
  listed: boolean; busy: boolean; pending: boolean };
let snapshot: Snapshot | null = null;
let generation = 0, readNumber = 0, booted = false;
let pending: Envelope | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const emit = () => listeners.forEach((listener) => listener());
const getSnapshot = () => snapshot;
const getServerSnapshot = () => null;
const pendingKey = (id: string) => `hokigotchi.pending.${id}`;
function persist(game: Game) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); return ""; }
  catch { return "Device storage is unavailable. Practice progress will last only for this session."; }
}
export function practiceGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? restoreGame(raw) : createGame();
}
function loadPractice(notice = "Your next checkpoint starts with one small action.") {
  const previous = snapshot;
  let game = createGame(), warning = "";
  try { game = practiceGame(); } catch { warning = "Practice progress could not be read. The saved file has not been replaced."; }
  game = advanceGame(game);
  snapshot = { game, day: localDay(), warning, notice, mode: "practice", account: previous?.account ?? null,
    configured: previous?.configured ?? false, status: "ready", revision: 0, listed: false, busy: false, pending: false };
  emit();
}
function keepPending(value: Envelope | null, user: string) {
  pending = value;
  try { if (value) sessionStorage.setItem(pendingKey(user), JSON.stringify(value)); else sessionStorage.removeItem(pendingKey(user)); }
  catch { /* In-memory retries retain the same request ID for this window. */ }
}
function readPending(user: string) {
  try { return JSON.parse(sessionStorage.getItem(pendingKey(user)) ?? "null") as Envelope | null; }
  catch { return null; }
}
function setAccount(account: Account | null) {
  if (!snapshot || snapshot.account?.id === account?.id) return;
  generation++;
  snapshot = { ...snapshot, account, busy: false };
  pending = account ? readPending(account.id) : null;
  if (account) {
    let mode = "cloud";
    try { mode = localStorage.getItem(`hokigotchi.mode.${account.id}`) ?? mode; } catch { /* default cloud */ }
    if (mode === "practice") loadPractice("Signed in. Your device adventure is active.");
    else { snapshot = { ...snapshot, mode: "cloud", game: createGame(), status: "loading", pending: !!pending, warning: "" }; emit(); void refreshCloud(); }
  } else loadPractice("Signed out. Your original practice adventure is active.");
}
function boot() {
  if (booted) return;
  booted = true;
  loadPractice();
  const client = cloudClient();
  if (!client) return;
  void fetch("/api/cloud/config", { cache: "no-store" }).then((r) => r.json()).then((data) => {
    if (snapshot) { snapshot = { ...snapshot, configured: data.configured === true }; emit(); }
  }).catch(() => { /* Account screen can retry after configuration. */ });
  client.auth.onAuthStateChange((_event, session) => {
    // Do not run other Supabase calls inside the auth callback's lock.
    queueMicrotask(() => setAccount(session ? { id: session.user.id, email: session.user.email ?? "" } : null));
  });
}
export async function refreshCloud() {
  if (!snapshot?.account || snapshot.mode !== "cloud" || snapshot.busy) return;
  const user = snapshot.account.id, epoch = generation, number = ++readNumber;
  try {
    const state = await cloudRequest<CloudState>("state", {}, user);
    if (!snapshot || epoch !== generation || number !== readNumber || snapshot.busy) return;
    snapshot = { ...snapshot, ...state, status: "ready", pending: !!pending, warning: pending ? "A previous action needs confirmation. Retry it before continuing." : "",
      notice: "Cloud adventure loaded. Quests follow Eastern Time; the week begins Monday." };
  } catch (e) {
    if (!snapshot || epoch !== generation || number !== readNumber) return;
    snapshot = { ...snapshot, status: "error", warning: errorText(e) };
  }
  emit();
}
export function playPractice() {
  if (!snapshot || snapshot.busy) return;
  generation++;
  if (snapshot.account) try { localStorage.setItem(`hokigotchi.mode.${snapshot.account.id}`, "practice"); } catch { /* session-only mode */ }
  loadPractice("Practice adventure active. Your cloud adventure is saved separately.");
}
export function playCloud() {
  if (!snapshot?.account || snapshot.busy) return;
  generation++;
  try { localStorage.setItem(`hokigotchi.mode.${snapshot.account.id}`, "cloud"); } catch { /* session-only mode */ }
  pending = readPending(snapshot.account.id);
  snapshot = { ...snapshot, mode: "cloud", game: createGame(), status: "loading", warning: "", pending: !!pending };
  emit(); void refreshCloud();
}
function errorText(e: unknown) { return e instanceof Error ? e.message : "The request could not be completed."; }
export async function retryCloudAction() {
  if (!snapshot?.account || snapshot.mode !== "cloud" || snapshot.busy || !pending) return false;
  const epoch = generation, user = snapshot.account.id, envelope = pending;
  snapshot = { ...snapshot, busy: true, warning: "", notice: "Saving your cloud action…" }; emit();
  readNumber++;
  try {
    const state = await cloudRequest<CloudState>("action", { method: "POST", body: JSON.stringify(envelope) }, user);
    if (!snapshot || epoch !== generation) return false;
    keepPending(null, user);
    snapshot = { ...snapshot, ...state, status: "ready", busy: false, pending: false, warning: "", notice: state.notice ?? "Cloud progress saved." };
    emit(); return true;
  } catch (e) {
    if (!snapshot || epoch !== generation) return false;
    const definitive = e instanceof RequestError && [400, 409, 413, 415, 429].includes(e.status);
    if (definitive) keepPending(null, user);
    const reason = errorText(e);
    snapshot = { ...snapshot, busy: false, pending: !!pending, warning: reason, notice: definitive ? "Action was not saved. Refresh and try again." : "Save not confirmed. Retry the pending action; it will not be awarded twice." };
    if (definitive) {
      emit(); await refreshCloud();
      if (snapshot && epoch === generation) { snapshot = { ...snapshot, warning: reason }; emit(); }
      return false;
    }
  }
  emit(); return false;
}
export async function dispatchCloud(action: CloudAction) {
  if (!snapshot?.account || snapshot.mode !== "cloud") return false;
  if (snapshot.busy || pending || snapshot.status !== "ready") {
    snapshot = { ...snapshot, warning: "Finish or retry the pending cloud save before another action." }; emit(); return false;
  }
  keepPending({ requestId: crypto.randomUUID(), revision: snapshot.revision, day: snapshot.day, action }, snapshot.account.id);
  snapshot = { ...snapshot, pending: true }; return retryCloudAction();
}
export function dispatchGame(action: Action) {
  if (!snapshot) return false;
  if (snapshot.mode === "cloud") return dispatchCloud(action);
  try {
    const { game, notice } = applyAction(snapshot.game, action);
    snapshot = { ...snapshot, game, notice, day: localDay(), warning: persist(game) };
    emit(); return true;
  } catch (e) { snapshot = { ...snapshot, notice: errorText(e) }; }
  emit(); return false;
}
export async function savePracticeBackup() {
  if (!snapshot?.account) throw new Error("Sign in first.");
  const game = practiceGame();
  await cloudRequest("backup", { method: "POST", body: JSON.stringify({ game }) }, snapshot.account.id);
}
export async function restorePracticeBackup() {
  if (!snapshot?.account) throw new Error("Sign in first.");
  const user = snapshot.account.id;
  const result = await cloudRequest<{ backup: { game: Game } | null }>("backup", {}, user);
  if (!result.backup) throw new Error("No practice backup has been saved for this account.");
  if (snapshot?.account?.id !== user) throw new Error("Your account changed. Try again.");
  const game = restoreGame(JSON.stringify(result.backup.game));
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) localStorage.setItem("hokigotchi.before-practice-restore", current);
  const warning = persist(game); if (warning) throw new Error(warning);
  playPractice();
}
function tick() {
  if (!snapshot) return;
  if (snapshot.mode === "cloud") { if (!pending && !snapshot.busy) void refreshCloud(); return; }
  if (snapshot.day !== localDay()) loadPractice("A new day, a fresh quest board.");
}
function onStorage(event: StorageEvent) { if (snapshot?.mode === "practice" && (event.key === STORAGE_KEY || event.key === null)) loadPractice(); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    boot(); window.addEventListener("storage", onStorage); window.addEventListener("focus", tick);
    timer = setInterval(tick, 60000);
  }
  return () => { listeners.delete(listener); if (!listeners.size) { window.removeEventListener("storage", onStorage); window.removeEventListener("focus", tick); clearInterval(timer); } };
}
export function useAdventure() { return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot); }
