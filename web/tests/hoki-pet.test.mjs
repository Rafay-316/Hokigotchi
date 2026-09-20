import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, advanceGame, createGame, petStage, petStatus, restoreGame, SAMPLE_PLAN } from "../src/lib/fork-game.ts";

const DAY = "2026-09-20";
const act = (game, action, day = DAY) => applyAction(game, action, day).game;

test("new players hatch through a rewarded action and feeding cannot hatch an egg", () => {
  const egg = createGame(DAY);
  assert.equal(petStatus(egg, DAY).stage.id, "egg");
  assert.deepEqual(act(egg, { type: "feed" }), egg);
  const result = applyAction(egg, { type: "checkin" }, DAY);
  assert.equal(petStatus(result.game, DAY).stage.id, "hatchling");
  assert.equal(result.game.pet.snacks, 1);
  assert.match(result.notice, /Hoki hatched/);
  assert.equal(egg.pet.snacks, 0);
});

test("only rewarded quest actions earn snacks and the bag is capped", () => {
  let game = createGame(DAY);
  const actions = [{ type: "checkin" }, { type: "plan", plan: SAMPLE_PLAN }, { type: "compare" },
    ...[1, 2, 3].map(n => ({ type: "expense", id: String(n), label: `Lunch ${n}`, category: "Food", amount: n })),
    { type: "challenge", enabled: true, floor: 1000 }, { type: "buffer", checking: 1640 }];
  for (const action of actions) game = act(game, action);
  assert.equal(game.pet.snacks, 7);
  for (const action of actions) game = act(game, action);
  game = act(game, { type: "expense", id: "extra", label: "Another lunch", category: "Food", amount: 10 });
  game = act(game, { type: "claim", checkpoint: 1 });
  assert.equal(game.pet.snacks, 7);
  const fullBag = { ...game, pet: { ...game.pet, snacks: 99 } };
  const next = act(fullBag, { type: "checkin" }, "2026-09-21");
  assert.equal(next.pet.snacks, 99);
  assert.equal(next.xp, 110);
});

test("feeding spends one snack once daily without awarding XP, tokens or points", () => {
  const game = act(createGame(DAY), { type: "checkin" });
  const raw = JSON.stringify(game);
  const fed = act(game, { type: "feed" });
  assert.equal(fed.pet.snacks, 0);
  assert.equal(fed.pet.lastFed, DAY);
  assert.equal(fed.pet.feeds, 1);
  assert.equal(fed.xp, game.xp);
  assert.equal(fed.tokens, game.tokens);
  assert.deepEqual(fed.weekly, game.weekly);
  assert.equal(petStatus(fed, DAY).fullness, 100);
  assert.equal(petStatus(fed, DAY).mood, "Happy");
  assert.deepEqual(act(fed, { type: "feed" }), fed);
  assert.deepEqual(act(restoreGame(JSON.stringify(fed)), { type: "feed" }), fed);
  assert.equal(JSON.stringify(game), raw);
});

test("empty bags prevent feeding and the next day permits a new earned snack", () => {
  const fed = act(act(createGame(DAY), { type: "checkin" }), { type: "feed" });
  const tomorrow = "2026-09-21";
  assert.equal(petStatus(fed, tomorrow).fullness, 75);
  assert.equal(petStatus(fed, tomorrow).canFeed, false);
  const checkedIn = act(fed, { type: "checkin" }, tomorrow);
  assert.equal(petStatus(checkedIn, tomorrow).canFeed, true);
  const next = act(checkedIn, { type: "feed" }, tomorrow);
  assert.equal(next.pet.feeds, 2);
  assert.equal(petStatus(next, tomorrow).fullness, 100);
  assert.equal(petStatus(next, DAY).canFeed, false);
});

test("moods recover after absence without reversing growth or deleting rewards", () => {
  let game = act(createGame(DAY), { type: "checkin" });
  game = { ...game, xp: 350, tokens: 100 };
  assert.equal(petStatus(game, "2026-09-22").mood, "Peckish");
  assert.equal(petStatus(game, "2026-09-23").mood, "Sleepy");
  const afterAbsence = advanceGame(game, "2026-10-20");
  assert.equal(petStatus(afterAbsence, "2026-10-20").stage.id, "champion");
  assert.equal(petStatus(afterAbsence, "2026-10-20").fullness, 0);
  assert.equal(afterAbsence.tokens, 100);
  const returned = act(afterAbsence, { type: "checkin" }, "2026-10-20");
  const fed = act(returned, { type: "feed" }, "2026-10-20");
  assert.equal(petStatus(fed, "2026-10-20").mood, "Happy");
});

test("evolution thresholds are permanent and report the next unlock", () => {
  for (const [xp, id] of [[0, "egg"], [9, "egg"], [10, "hatchling"], [149, "hatchling"], [150, "fledgling"], [349, "fledgling"], [350, "champion"]]) {
    assert.equal(petStage(xp).id, id);
  }
  const game = { ...createGame(DAY), xp: 140 };
  const result = applyAction(game, { type: "checkin" }, DAY);
  assert.match(result.notice, /Hoki evolved/);
  assert.equal(petStatus(result.game, DAY).progress, 0);
  assert.equal(petStatus(result.game, DAY).progressMax, 200);
});

test("legacy saves retain all original fields and receive age-appropriate pets", () => {
  const current = act(createGame(DAY), { type: "plan", plan: SAMPLE_PLAN });
  const { pet: _pet, ...legacy } = { ...current, xp: 360, tokens: 170, outfit: "sunset", owned: ["mint", "sunset"], claimed: [0, 1, 2, 3] };
  const migrated = restoreGame(JSON.stringify(legacy), DAY);
  const { pet, ...retained } = migrated;
  assert.deepEqual(retained, legacy);
  assert.equal(pet.snacks, 2);
  assert.equal(pet.started, DAY);
  assert.equal(petStatus(migrated, DAY).stage.id, "champion");
  const fed = act(migrated, { type: "feed" });
  assert.deepEqual(restoreGame(JSON.stringify(fed), "2026-09-21"), fed);
});

test("malformed pet records are rejected instead of granting invalid inventory", () => {
  const game = createGame(DAY);
  for (const pet of [null, {}, { ...game.pet, snacks: -1 }, { ...game.pet, snacks: 100 },
    { ...game.pet, snacks: "2" }, { ...game.pet, started: "invalid" },
    { ...game.pet, lastFed: DAY }, { ...game.pet, feeds: 1 },
    { ...game.pet, feeds: -1 }, { ...game.pet, lastFed: "2026-99-99", feeds: 1 }]) {
    assert.throws(() => restoreGame(JSON.stringify({ ...game, pet }), DAY));
  }
});
