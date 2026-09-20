import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction, advanceGame, createGame, restoreGame, SAMPLE_PLAN,
  streak, weekStart, weekCount,
} from "../src/lib/fork-game.ts";

const MONDAY = "2026-09-14";
const act = (game, action, day = MONDAY) => applyAction(game, action, day).game;
function fullDay(game, day = MONDAY) {
  for (const action of [
    { type: "checkin" }, { type: "plan", plan: SAMPLE_PLAN }, { type: "compare" },
    ...[1, 2, 3].map((n) => ({ type: "expense", id: `${day}-${n}`, label: `Expense ${n}`, category: "Food", amount: n })),
    { type: "challenge", enabled: true, floor: 1000 }, { type: "buffer", checking: 1640 },
  ]) game = act(game, action, day);
  return game;
}

test("new adventures start at zero with no pre-earned rewards", () => {
  const game = createGame(MONDAY);
  assert.equal(game.xp, 0); assert.equal(game.tokens, 0);
  assert.deepEqual(game.claimed, [0]); assert.equal(game.challenge.enabled, false);
  assert.equal(game.plan, null);
});
test("a full day earns exactly 100 XP, 45 tokens, and 100 weekly points", () => {
  const game = fullDay(createGame(MONDAY));
  assert.equal(game.xp, 100); assert.equal(game.tokens, 45); assert.equal(game.weekly.score, 100);
});
test("repeated saves, check-ins, comparisons and balance checks cannot farm XP", () => {
  let game = fullDay(createGame(MONDAY));
  for (let n = 0; n < 20; n++) {
    for (const action of [{ type: "checkin" }, { type: "plan", plan: { ...SAMPLE_PLAN, otherExpenses: n } },
      { type: "compare" }, { type: "buffer", checking: 1640 },
      { type: "expense", id: `extra-${n}`, label: `Additional ${n}`, category: "Other", amount: 1 }]) {
      game = act(game, action);
    }
  }
  assert.equal(game.xp, 100); assert.equal(game.tokens, 45); assert.equal(game.expenses.length, 23);
  assert.equal(game.plan.otherExpenses, 19);
});
test("exact duplicate expenses are not stored or rewarded twice", () => {
  const entry = { type: "expense", id: "one", label: "Lunch", category: "Food", amount: 12.34 };
  let game = act(createGame(MONDAY), entry);
  game = act(game, { ...entry, id: "two", label: " lunch " });
  assert.equal(game.xp, 10); assert.equal(game.expenses.length, 1);
  assert.equal(game.expenses[0].cents, 1234);
});
test("deleting and re-adding expenses does not reset the three-reward limit", () => {
  let game = fullDay(createGame(MONDAY));
  game = act(game, { type: "deleteExpense", id: `${MONDAY}-1` });
  game = act(game, { type: "expense", id: "replacement", label: "Expense 1", category: "Food", amount: 1 });
  assert.equal(game.xp, 100); assert.equal(game.days[MONDAY].expenses, 3);
});
test("a below-floor check loses weekly points only once that day", () => {
  let game = fullDay(createGame(MONDAY));
  for (let n = 0; n < 5; n++) game = act(game, { type: "buffer", checking: 999.99 });
  assert.equal(game.weekly.score, 85); assert.equal(game.xp, 100); assert.equal(game.tokens, 45);
  assert.equal(game.days[MONDAY].bufferPenalty, true);
});
test("balance equal to the chosen floor qualifies and recovery can earn the daily bonus", () => {
  let game = act(createGame(MONDAY), { type: "checkin" });
  game = act(game, { type: "challenge", enabled: true, floor: 1000.01 });
  game = act(game, { type: "buffer", checking: 1000 });
  assert.equal(game.weekly.score, 0); assert.equal(game.xp, 10);
  game = act(game, { type: "buffer", checking: 1000.01 });
  assert.equal(game.weekly.score, 15); assert.equal(game.xp, 25);
});
test("unavailable balance data cannot deduct points", () => {
  const game = fullDay(createGame(MONDAY));
  const before = JSON.stringify(game);
  for (const checking of [NaN, Infinity, undefined, null]) {
    assert.throws(() => act(game, { type: "buffer", checking }));
  }
  assert.equal(JSON.stringify(game), before);
});
test("inactive challenges do not award or deduct balance points", () => {
  let game = createGame(MONDAY);
  game = act(game, { type: "buffer", checking: 2000 });
  game = act(game, { type: "buffer", checking: 0 });
  assert.equal(game.xp, 0); assert.equal(game.weekly.score, 0);
});
test("missed days cost at most 30 points per week, without duplicate deductions on reload", () => {
  let game = fullDay(createGame(MONDAY));
  game = advanceGame(game, "2026-09-18");
  assert.equal(game.weekly.score, 70); assert.equal(game.weekly.missed, 3);
  game = advanceGame(restoreGame(JSON.stringify(game)), "2026-09-18");
  game = advanceGame(game, "2026-09-20");
  assert.equal(game.weekly.score, 70); assert.equal(game.xp, 100);
});
test("pausing a challenge stops future missed-day deductions", () => {
  let game = fullDay(createGame(MONDAY));
  game = act(game, { type: "challenge", enabled: false, floor: 1000 });
  game = advanceGame(game, "2026-09-18");
  assert.equal(game.weekly.score, 100);
});
test("Monday starts a fresh league but retains XP, tokens, plan, and rewards", () => {
  let game = fullDay(createGame(MONDAY));
  game = act(game, { type: "claim", checkpoint: 1 });
  game = advanceGame(game, "2026-09-21");
  assert.equal(game.weekly.score, 0); assert.equal(game.weekly.missed, 0);
  assert.equal(game.xp, 100); assert.equal(game.tokens, 65);
  assert.deepEqual(game.claimed, [0, 1]); assert.deepEqual(game.plan, SAMPLE_PLAN);
});
test("a new day unlocks daily rewards again", () => {
  let game = fullDay(createGame(MONDAY));
  game = fullDay(game, "2026-09-15");
  assert.equal(game.xp, 200); assert.equal(game.tokens, 90); assert.equal(game.weekly.score, 200);
  assert.equal(streak(game, "2026-09-15"), 2);
  assert.equal(weekCount(game, "buffer", "2026-09-15"), 2);
});
test("streaks use calendar days across daylight saving and break after a missed day", () => {
  let game = createGame("2026-03-07");
  game = act(game, { type: "checkin" }, "2026-03-07");
  game = act(game, { type: "checkin" }, "2026-03-08");
  game = act(game, { type: "checkin" }, "2026-03-09");
  assert.equal(streak(game, "2026-03-09"), 3);
  assert.equal(streak(game, "2026-03-10"), 3);
  assert.equal(streak(game, "2026-03-11"), 0);
  assert.equal(weekStart("2026-09-20"), MONDAY);
});
test("checkpoint treasure is gated by XP and can only be collected once", () => {
  let game = fullDay(createGame(MONDAY));
  game = act(game, { type: "claim", checkpoint: 2 });
  assert.equal(game.tokens, 45);
  game = act(game, { type: "claim", checkpoint: 1 });
  game = act(game, { type: "claim", checkpoint: 1 });
  assert.equal(game.tokens, 65); assert.deepEqual(game.claimed, [0, 1]);
});
test("outfits spend tokens once, can be re-equipped free, and cannot overdraw", () => {
  let game = fullDay(createGame(MONDAY));
  game = act(game, { type: "outfit", id: "sunset" });
  assert.equal(game.tokens, 45); assert.equal(game.outfit, "mint");
  game = act(game, { type: "claim", checkpoint: 1 });
  game = act(game, { type: "outfit", id: "sunset" });
  assert.equal(game.tokens, 5); assert.equal(game.outfit, "sunset");
  game = act(game, { type: "outfit", id: "mint" });
  game = act(game, { type: "outfit", id: "sunset" });
  assert.equal(game.tokens, 5); assert.deepEqual(game.owned, ["mint", "sunset"]);
});
test("five full quest days can clear the whole first world", () => {
  let game = createGame(MONDAY);
  for (let n = 14; n <= 18; n++) game = fullDay(game, `2026-09-${n}`);
  for (let id = 1; id <= 5; id++) game = act(game, { type: "claim", checkpoint: id }, "2026-09-18");
  assert.equal(game.xp, 500); assert.equal(game.tokens, 430);
  assert.deepEqual(game.claimed, [0, 1, 2, 3, 4, 5]);
});
test("invalid amounts and invalid saves are rejected", () => {
  const game = createGame(MONDAY);
  for (const amount of [0, -1, 1.001, NaN, Infinity, 1_000_000_001]) {
    assert.throws(() => act(game, { type: "expense", id: "bad", label: "Example", category: "Food", amount }));
  }
  for (const raw of ["bad JSON", "{}", JSON.stringify({ ...game, xp: -1 }), JSON.stringify({ ...game, outfit: "missing" })]) {
    assert.throws(() => restoreGame(raw));
  }
  assert.throws(() => act(game, { type: "plan", plan: { ...SAMPLE_PLAN, monthlyIncome: "1450" } }));
});
test("saved game round-trips and actions do not mutate their input", () => {
  const game = fullDay(createGame(MONDAY));
  const raw = JSON.stringify(game);
  assert.deepEqual(restoreGame(raw), game);
  act(game, { type: "claim", checkpoint: 1 });
  assert.equal(JSON.stringify(game), raw);
});
