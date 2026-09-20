import { advanceGame, applyAction, CATEGORIES, createGame, OUTFITS, restoreGame, validPlan } from "./fork-game";
import type { Action, Game } from "./fork-game";

export const LEAGUE_TIME_ZONE = "America/New_York";
export function leagueDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: LEAGUE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export function exact(v: Record<string, unknown>, keys: string[]) {
  if (Object.keys(v).length !== keys.length || keys.some((k) => !Object.hasOwn(v, k))) throw new Error("Unexpected request fields.");
}
function text(v: unknown, max: number, min = 1) { return typeof v === "string" && v.trim().length >= min && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v); }
function money(v: unknown) { return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9 && Math.round(v * 100) / 100 === v; }
function day(v: unknown) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v; }
export function uuid(v: unknown): v is string { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }

// Client actions only. Dates, XP, balances, user IDs and full game objects are never accepted.
export type CloudAction = Action | { type: "visibility"; listed: boolean };
export function parseCloudAction(v: unknown): CloudAction {
  if (!record(v) || typeof v.type !== "string") throw new Error("Choose a supported action.");
  let keys: string[] = [], valid = true;
  switch (v.type) {
    case "checkin": case "feed": case "weekReview": break;
    case "visibility": keys = ["listed"]; valid = typeof v.listed === "boolean"; break;
    case "plan": keys = ["plan"]; valid = validPlan(v.plan) && record(v.plan) && Object.keys(v.plan).length === 6; break;
    case "compare": keys = ["field", "amount"]; valid = ["monthlyIncome", "fixedExpenses", "foodExpenses", "otherExpenses"].includes(String(v.field)) && money(v.amount); break;
    case "expense": keys = ["id", "label", "category", "amount"]; valid = uuid(v.id) && text(v.label, 48, 2) && CATEGORIES.includes(v.category as typeof CATEGORIES[number]) && money(v.amount) && Number(v.amount) > 0; break;
    case "deleteExpense": case "goalProgress": keys = v.type === "goalProgress" ? ["id", "saved"] : ["id"]; valid = uuid(v.id) && (v.type !== "goalProgress" || money(v.saved)); break;
    case "claim": keys = ["checkpoint"]; valid = Number.isInteger(v.checkpoint) && Number(v.checkpoint) >= 0 && Number(v.checkpoint) <= 5; break;
    case "outfit": keys = ["id"]; valid = OUTFITS.some((o) => o.id === v.id); break;
    case "weekPlan": keys = ["week", "allocations"]; valid = day(v.week) && record(v.allocations) && Object.keys(v.allocations).length === 5 && CATEGORIES.every((c) => money((v.allocations as Record<string, unknown>)[c])); break;
    case "trackingReward": keys = ["week"]; valid = day(v.week); break;
    case "closeWeek": keys = ["week", "confirmed"]; valid = day(v.week) && typeof v.confirmed === "boolean"; break;
    case "goalCreate": keys = ["id", "name", "target", "saved"]; valid = uuid(v.id) && text(v.name, 40, 2) && money(v.target) && money(v.saved); break;
    case "name": keys = ["name"]; valid = text(v.name, 24, 2); break;
    case "challenge": case "buffer": throw new Error("Nessie balance challenges are available in practice mode. Cloud play does not yet have individual bank connections.");
    default: throw new Error("Choose a supported action.");
  }
  exact(v, ["type", ...keys]);
  if (!valid) throw new Error("Check the action's amounts and required fields.");
  return v as unknown as CloudAction;
}

export type Envelope = { requestId: string; revision: number; day: string; action: CloudAction };
export function parseEnvelope(v: unknown): Envelope {
  if (!record(v)) throw new Error("Invalid action request.");
  exact(v, ["requestId", "revision", "day", "action"]);
  if (!uuid(v.requestId) || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0 || !day(v.day)) throw new Error("Invalid action request.");
  return { requestId: v.requestId, revision: v.revision as number, day: v.day as string, action: parseCloudAction(v.action) };
}
export function newCloudGame(day: string, userId: string): Game {
  return { ...createGame(day), name: `Hoki ${userId.slice(0, 6)}` };
}
export function cloudTransition(game: Game, action: CloudAction, day: string) {
  // Also validate internal callers; unknown actions may never be silently accepted.
  const checked = parseCloudAction(action);
  if (checked.type === "visibility") return { game: advanceGame(game, day), notice: checked.listed ? "You joined the weekly league. Your player name and habit scores are visible to signed-in players." : "You left the public ranking. Your adventure continues privately." };
  if (checked.type === "compare") {
    if (!game.plan || !checked.field || checked.amount === undefined) throw new Error("Save a monthly plan before exploring a different amount.");
    if (game.plan[checked.field] === checked.amount) throw new Error("Choose a different amount to explore.");
  }
  if (game.challenge.enabled) throw new Error("Cloud game requires a supported scoring version.");
  return applyAction(game, checked, day);
}
export function cloudView(game: Game, day: string) { return advanceGame(game, day); }
export function practiceBackup(v: unknown, day: string): Game {
  // A backup never enters the competitive state or ranking tables.
  if (!record(v)) throw new Error("Invalid practice backup.");
  const g = restoreGame(JSON.stringify(v), day);
  return { version: 1, name: g.name, xp: g.xp, tokens: g.tokens, outfit: g.outfit, owned: g.owned, claimed: g.claimed,
    days: g.days, weekly: g.weekly, challenge: g.challenge, settledThrough: g.settledThrough,
    expenses: g.expenses, plan: g.plan, pet: g.pet, money: g.money };
}
