import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createGame, restoreGame, weeklyTotals, trackingDays, petStatus, weekStart, emptyAllocations } from "../src/lib/fork-game.ts";

const MON = "2026-09-14", NEXT = "2026-09-21";
const act = (g, a, day = MON) => applyAction(g, a, day).game;
const allocation = (food = 100) => ({ ...emptyAllocations(), Food: food });
const plan = (g = createGame(MON), food = 100, day = MON, week = weekStart(day)) => act(g, { type: "weekPlan", week, allocations: allocation(food) }, day);
const expense = (g, day, amount = 10, id = day) => act(g, { type: "expense", id, label: `Lunch ${id}`, category: "Food", amount }, day);
const goal = (g = createGame(MON), target = 400, saved = 0, day = MON, id = "goal") => act(g, { type: "goalCreate", id, name: "Laptop fund", target, saved }, day);

test("weekly allocations can vary and expenses update spent and remaining for the right week", () => {
  let g = plan();
  g = expense(g, MON, 12.34);
  g = plan(g, 175, MON, NEXT);
  assert.equal(weeklyTotals(g, MON).budgetCents, 10000);
  assert.equal(weeklyTotals(g, MON).spentCents, 1234);
  assert.equal(weeklyTotals(g, MON).remainingCents, 8766);
  g = expense(g, NEXT, 20);
  assert.equal(weeklyTotals(g, NEXT).budgetCents, 17500);
  assert.equal(weeklyTotals(g, NEXT).remainingCents, 15500);
  assert.equal(weeklyTotals(g, MON).spentCents, 1234);
  assert.deepEqual(restoreGame(JSON.stringify(g)), g);
});

test("weekly plan earns once, while edits preserve the original reward benchmark", () => {
  let g = plan();
  assert.equal(g.xp, 25); assert.equal(g.tokens, 10); assert.equal(g.pet.snacks, 1);
  g = plan(g, 200);
  g = plan(g, 300);
  assert.equal(g.xp, 25);
  assert.equal(g.money.weeks[MON].firstLimitCents, 10000);
  assert.equal(weeklyTotals(g, MON).budgetCents, 30000);
  assert.throws(() => plan(g, 50, MON, "2026-09-07"));
  assert.throws(() => plan(g, 50, MON, "2026-10-05"));
  for (const amount of [-1, 0, 0.001, NaN, Infinity]) assert.throws(() => plan(g, amount));
});

test("daily review requires a weekly plan and cannot be repeated after reload", () => {
  assert.throws(() => act(createGame(MON), { type: "weekReview" }));
  let g = act(plan(), { type: "weekReview" });
  assert.equal(g.xp, 30); assert.equal(g.tokens, 12);
  g = act(restoreGame(JSON.stringify(g)), { type: "weekReview" });
  assert.equal(g.xp, 30);
  g = act(g, { type: "weekReview" }, "2026-09-15");
  assert.equal(g.xp, 35);
  assert.equal(petStatus(g, "2026-09-15").mood, "Curious");
});

test("tracking bonuses count distinct days and pay each milestone once", () => {
  let g = plan();
  for (const day of [MON, "2026-09-15", "2026-09-16"]) g = expense(g, day);
  const before = g.xp;
  g = act(g, { type: "trackingReward", week: MON }, "2026-09-16");
  assert.equal(g.xp, before + 20);
  g = act(g, { type: "trackingReward", week: MON }, "2026-09-16");
  assert.equal(g.xp, before + 20);
  g = expense(g, "2026-09-17"); g = expense(g, "2026-09-18");
  assert.equal(trackingDays(g, MON), 5);
  const second = g.xp;
  g = act(g, { type: "trackingReward", week: MON }, "2026-09-18");
  assert.equal(g.xp, second + 35);
  g = act(g, { type: "deleteExpense", id: MON }, "2026-09-18");
  g = act(g, { type: "trackingReward", week: MON }, "2026-09-18");
  assert.equal(g.xp, second + 35);
  assert.deepEqual(g.money.weeks[MON].trackingClaims, [3, 5]);
});

test("a completed week can award review and within-budget bonuses only once", () => {
  let g = plan();
  for (const day of [MON, "2026-09-15", "2026-09-16"]) g = expense(g, day, 20);
  assert.throws(() => act(g, { type: "closeWeek", week: MON, confirmed: true }, "2026-09-20"));
  assert.throws(() => act(g, { type: "closeWeek", week: MON, confirmed: false }, NEXT));
  const before = g.xp;
  g = act(g, { type: "closeWeek", week: MON, confirmed: true }, NEXT);
  assert.equal(g.xp, before + 55);
  assert.equal(g.weekly.score, 55);
  assert.deepEqual(g.money.weeks[MON].closed, { day: NEXT, spentCents: 6000, bonus: true });
  const saved = restoreGame(JSON.stringify(g));
  assert.deepEqual(act(saved, { type: "closeWeek", week: MON, confirmed: true }, NEXT), saved);
  assert.throws(() => act(g, { type: "deleteExpense", id: MON }, NEXT));
});

test("increasing a budget after spending does not manufacture a within-budget bonus", () => {
  let g = plan();
  for (const day of [MON, "2026-09-15", "2026-09-16"]) g = expense(g, day, 50);
  g = plan(g, 200, "2026-09-16");
  const before = g.xp;
  g = act(g, { type: "closeWeek", week: MON, confirmed: true }, NEXT);
  assert.equal(g.xp, before + 15);
  assert.equal(g.money.weeks[MON].closed.bonus, false);
  const empty = act(plan(), { type: "closeWeek", week: MON, confirmed: true }, NEXT);
  assert.equal(empty.money.weeks[MON].closed.bonus, false);
  assert.equal(empty.xp, 40);
});

test("savings rewards are for new percentage milestones, including 90 percent and completion", () => {
  let g = goal(createGame(MON), 400, 100);
  assert.equal(g.xp, 0);
  assert.deepEqual(g.money.goals[0].claimed, [25]);
  g = act(g, { type: "goalProgress", id: "goal", saved: 200 });
  assert.equal(g.xp, 35);
  g = act(g, { type: "goalProgress", id: "goal", saved: 360 });
  assert.equal(g.xp, 35 + 50 + 75);
  g = act(g, { type: "goalProgress", id: "goal", saved: 400 });
  assert.equal(g.xp, 260);
  assert.equal(g.tokens, 115);
  assert.deepEqual(g.money.goals[0].claimed, [25, 50, 75, 90, 100]);
  assert.equal(petStatus(g, MON).stage.id, "fledgling");
});

test("withdrawals, repeat submissions, and reloads cannot re-earn savings milestones", () => {
  let g = act(goal(), { type: "goalProgress", id: "goal", saved: 400 });
  assert.equal(g.xp, 285);
  const tokens = g.tokens, snacks = g.pet.snacks;
  g = act(restoreGame(JSON.stringify(g)), { type: "goalProgress", id: "goal", saved: 0 });
  g = act(g, { type: "goalProgress", id: "goal", saved: 400 });
  g = act(g, { type: "goalProgress", id: "goal", saved: 1000 });
  assert.equal(g.xp, 285); assert.equal(g.tokens, tokens); assert.equal(g.pet.snacks, snacks);
});

test("larger dollar goals do not pay larger rewards for the same percentage", () => {
  const small = act(goal(createGame(MON), 100), { type: "goalProgress", id: "goal", saved: 50 });
  const large = act(goal(createGame(MON), 1000), { type: "goalProgress", id: "goal", saved: 500 });
  assert.equal(small.xp, 60); assert.equal(large.xp, 60);
  assert.equal(small.tokens, large.tokens);
});

test("new savings quests require an unfinished target and cannot be created repeatedly", () => {
  assert.throws(() => goal(createGame(MON), 100, 100));
  let g = goal();
  assert.throws(() => goal(g, 500, 0, MON, "second"));
  g = act(g, { type: "goalProgress", id: "goal", saved: 400 });
  assert.throws(() => goal(g, 500, 0, MON, "second"));
  g = goal(g, 500, 0, NEXT, "second");
  assert.equal(g.money.goals.length, 2);
  assert.throws(() => act(g, { type: "goalProgress", id: "goal", saved: 100 }, NEXT));
  assert.equal(g.money.goals[0].targetCents, 50000);
});

test("older saves gain empty money quests while retaining all previous progress", () => {
  const current = act(createGame(MON), { type: "checkin" });
  const { money: _money, ...oldPetSave } = current;
  const migrated = restoreGame(JSON.stringify(oldPetSave), MON);
  const { money, ...retained } = migrated;
  assert.deepEqual(retained, oldPetSave);
  assert.deepEqual(money, { weeks: {}, goals: [] });
  const { pet: _pet, ...oldOriginalSave } = oldPetSave;
  const oldest = restoreGame(JSON.stringify(oldOriginalSave), MON);
  assert.equal(oldest.xp, 10); assert.equal(oldest.pet.snacks, 2); assert.deepEqual(oldest.money, money);
  const highScore = { ...current, xp: 1200, weekly: { ...current.weekly, score: 1000 } };
  assert.deepEqual(restoreGame(JSON.stringify(highScore)), highScore);
});

test("malformed weekly and savings saves and invalid money inputs are rejected", () => {
  const g = plan(goal());
  for (const amount of [-1, 0.001, NaN, Infinity]) assert.throws(() => act(g, { type: "goalProgress", id: "goal", saved: amount }));
  for (const money of [null, {}, { weeks: {}, goals: [{}] }, { ...g.money, weeks: { bad: g.money.weeks[MON] } },
    { ...g.money, goals: [{ ...g.money.goals[0], claimed: [20] }] },
    { ...g.money, weeks: { [MON]: { ...g.money.weeks[MON], firstLimitCents: -1 } } }]) {
    assert.throws(() => restoreGame(JSON.stringify({ ...g, money }), MON));
  }
  const raw = JSON.stringify(g);
  act(g, { type: "goalProgress", id: "goal", saved: 400 });
  assert.equal(JSON.stringify(g), raw);
});
