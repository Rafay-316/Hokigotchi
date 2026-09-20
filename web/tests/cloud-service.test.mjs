import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepareCloudModules } from './cloud-loader.mjs';
const modules = prepareCloudModules();
after(modules.cleanup);
const { actCloud, readCloud, fingerprint } = await import(modules.url('cloud-service'));
const { leagueDay, parseCloudAction, parseEnvelope, practiceBackup, newCloudGame } = await import(modules.url('cloud-rules'));
const { applyAction, createGame, SAMPLE_PLAN } = await import(modules.url('fork-game'));
const DAY = '2026-09-20', USER = randomUUID();
function memoryRepository() {
  const rows = new Map(), receipts = new Map();
  let dropNextAcknowledgment = false;
  return {
    rows, receipts,
    loseAcknowledgment() { dropNextAcknowledgment = true; },
    async ensure(user, game) {
      if (!rows.has(user)) rows.set(user, { game: structuredClone(game), revision: 0, listed: false });
      return structuredClone(rows.get(user));
    },
    async receipt(user, id) { return receipts.get(`${user}/${id}`) ?? null; },
    async commit(v) {
      // Atomic section models the SQL row lock; SQL itself has a separate integration suite.
      const key = `${v.user}/${v.requestId}`, old = receipts.get(key), row = rows.get(v.user);
      if (old) return { status: old.fingerprint === v.fingerprint ? 'duplicate' : 'reuse', notice: old.notice };
      if (row.revision !== v.expected) return { status: 'conflict' };
      rows.set(v.user, { game: structuredClone(v.game), revision: row.revision + 1, listed: v.listed });
      receipts.set(key, { fingerprint: v.fingerprint, notice: v.notice });
      if (dropNextAcknowledgment) { dropNextAcknowledgment = false; throw new Error('connection interrupted'); }
      return { status: 'committed', notice: v.notice };
    },
  };
}
const request = (action, revision = 0, day = DAY) => ({ requestId: randomUUID(), revision, day, action });

function pauseFirstReceipt(repo) {
  const captured = Promise.withResolvers(), release = Promise.withResolvers();
  let paused = false;
  return {
    captured: captured.promise,
    release: () => release.resolve(),
    repository: {
      ...repo,
      async receipt(user, id) {
        const snapshot = await repo.receipt(user, id);
        if (!paused) {
          paused = true;
          captured.resolve();
          await release.promise;
        }
        return snapshot;
      },
    },
  };
}

test('campus day uses Eastern Time including DST, not the client calendar', () => {
  assert.equal(leagueDay(new Date('2026-09-21T03:59:59Z')), '2026-09-20');
  assert.equal(leagueDay(new Date('2026-09-21T04:00:00Z')), '2026-09-21');
  assert.equal(leagueDay(new Date('2026-11-01T05:30:00Z')), '2026-11-01');
  assert.equal(leagueDay(new Date('2026-11-01T06:30:00Z')), '2026-11-01');
});
test('cloud registration creates zero XP and starts privately; reads award nothing', async () => {
  const repo = memoryRepository();
  const first = await readCloud(repo, USER, DAY), again = await readCloud(repo, USER, DAY);
  assert.equal(first.game.xp, 0); assert.equal(first.listed, false); assert.deepEqual(first, again);
});
test('unknown fields, injected scores, users, dates, balances and malformed actions are rejected', () => {
  for (const action of [null, [], { type: 'unknown' }, { type: 'checkin', xp: 500 },
    { type: 'checkin', user: USER }, { type: 'checkin', day: '2099-01-01' },
    { type: 'buffer', checking: 1e8 }, { type: 'challenge', floor: 1, enabled: true },
    { type: 'visibility', listed: 'true' }, { type: 'name', name: 'a\nb' },
    { type: 'expense', id: randomUUID(), label: 'Lunch', category: 'Food', amount: -2 },
    { type: 'goalCreate', id: '__proto__', name: 'Laptop', target: 2, saved: 0 }]) assert.throws(() => parseCloudAction(action));
  assert.throws(() => parseEnvelope({ ...request({ type: 'checkin' }), userId: USER }));
});
test('clock spoofing fails without changing state', async () => {
  const repo = memoryRepository();
  await assert.rejects(actCloud(repo, USER, DAY, request({ type: 'checkin' }, 0, '2026-09-21')), { status: 409 });
  assert.equal((await readCloud(repo, USER, DAY)).game.xp, 0);
});
test('two concurrent distinct mutations cannot overwrite each other', async () => {
  const repo = memoryRepository();
  const results = await Promise.allSettled([
    actCloud(repo, USER, DAY, request({ type: 'checkin' })),
    actCloud(repo, USER, DAY, request({ type: 'plan', plan: SAMPLE_PLAN })),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409);
  assert.equal((await readCloud(repo, USER, DAY)).revision, 1);
});
test('duplicate simultaneous requests and retries reward only once', async () => {
  const repo = memoryRepository(), body = request({ type: 'checkin' });
  await Promise.all([actCloud(repo, USER, DAY, body), actCloud(repo, USER, DAY, body)]);
  const result = await actCloud(repo, USER, DAY, body);
  assert.equal(result.game.xp, 10); assert.equal(result.revision, 1); assert.equal(repo.receipts.size, 1);
});
test('a duplicate succeeds when its first receipt read misses a save that commits before its state read', async () => {
  const repo = memoryRepository(), body = request({ type: 'checkin' });
  const paused = pauseFirstReceipt(repo);
  const pending = actCloud(paused.repository, USER, DAY, body);
  await paused.captured;
  const first = await actCloud(repo, USER, DAY, body);
  paused.release();
  const replay = await pending;
  assert.equal(replay.notice, first.notice);
  assert.equal(replay.game.xp, 10); assert.equal(replay.revision, 1); assert.equal(repo.receipts.size, 1);
});
test('a duplicate can recover that same receipt race after campus midnight', async () => {
  const repo = memoryRepository(), body = request({ type: 'checkin' });
  const paused = pauseFirstReceipt(repo);
  const pending = actCloud(paused.repository, USER, '2026-09-21', body);
  await paused.captured;
  await actCloud(repo, USER, DAY, body);
  paused.release();
  const replay = await pending;
  assert.equal(replay.game.xp, 10); assert.equal(replay.revision, 1);
  assert.equal(replay.game.weekly.score, 0); assert.equal(repo.receipts.size, 1);
});
test('a changed action cannot use the receipt created during a concurrent save', async () => {
  const repo = memoryRepository(), body = request({ type: 'checkin' });
  const paused = pauseFirstReceipt(repo);
  const pending = actCloud(paused.repository, USER, DAY, { ...body, action: { type: 'feed' } });
  const rejected = assert.rejects(pending, { status: 409, message: 'This request ID was already used for a different action.' });
  await paused.captured;
  await actCloud(repo, USER, DAY, body);
  paused.release();
  await rejected;
  assert.equal((await readCloud(repo, USER, DAY)).game.xp, 10);
  assert.equal(repo.receipts.size, 1);
});
test('a distinct stale request still conflicts when another save commits between its reads', async () => {
  const repo = memoryRepository();
  const paused = pauseFirstReceipt(repo);
  const pending = actCloud(paused.repository, USER, DAY, request({ type: 'name', name: 'Stale name' }));
  const rejected = assert.rejects(pending, { status: 409, message: 'Your adventure changed in another window. Refresh and repeat this action.' });
  await paused.captured;
  await actCloud(repo, USER, DAY, request({ type: 'checkin' }));
  paused.release();
  await rejected;
  const saved = await readCloud(repo, USER, DAY);
  assert.equal(saved.game.xp, 10); assert.equal(saved.revision, 1);
  assert.notEqual(saved.game.name, 'Stale name'); assert.equal(repo.receipts.size, 1);
});
test('lost acknowledgment can be retried after midnight without awarding another day', async () => {
  const repo = memoryRepository(), body = request({ type: 'checkin' });
  repo.loseAcknowledgment();
  await assert.rejects(actCloud(repo, USER, DAY, body), /interrupted/);
  const recovered = await actCloud(repo, USER, '2026-09-21', body);
  assert.equal(recovered.game.xp, 10); assert.equal(recovered.game.weekly.score, 0); assert.equal(recovered.revision, 1);
});
test('a request ID reused with changed content is rejected', async () => {
  const repo = memoryRepository(), body = request({ type: 'checkin' });
  await actCloud(repo, USER, DAY, body);
  await assert.rejects(actCloud(repo, USER, DAY, { ...body, action: { type: 'feed' } }), { status: 409 });
});
test('the verified user scopes state and idempotency receipts', async () => {
  const repo = memoryRepository(), other = randomUUID(), body = request({ type: 'checkin' });
  await actCloud(repo, USER, DAY, body);
  assert.equal((await readCloud(repo, other, DAY)).game.xp, 0);
  assert.equal((await actCloud(repo, other, DAY, body)).game.xp, 10);
  assert.equal(repo.receipts.size, 2);
});
test('a what-if requires a server-saved plan and an actual changed amount', async () => {
  const repo = memoryRepository();
  await assert.rejects(actCloud(repo, USER, DAY, request({ type: 'compare', field: 'otherExpenses', amount: 0 })), { status: 400 });
  await actCloud(repo, USER, DAY, request({ type: 'plan', plan: SAMPLE_PLAN }));
  await assert.rejects(actCloud(repo, USER, DAY, request({ type: 'compare', field: 'otherExpenses', amount: 200 }, 1)), { status: 400 });
  const result = await actCloud(repo, USER, DAY, request({ type: 'compare', field: 'otherExpenses', amount: 0 }, 1));
  assert.equal(result.game.xp, 45);
});
test('privacy changes are server saved and award no points', async () => {
  const repo = memoryRepository();
  let r = await actCloud(repo, USER, DAY, request({ type: 'visibility', listed: true }));
  assert.equal(r.listed, true); assert.equal(r.game.xp, 0);
  r = await actCloud(repo, USER, DAY, request({ type: 'visibility', listed: false }, 1));
  assert.equal(r.listed, false); assert.equal(r.game.xp, 0);
});
test('practice migration preserves its Hoki without importing competitive points', async () => {
  const practice = applyAction(createGame(DAY), { type: 'checkin' }, DAY).game;
  const original = JSON.stringify(practice), backup = practiceBackup(practice, DAY);
  assert.equal(backup.xp, 10); assert.equal(JSON.stringify(practice), original);
  assert.equal(newCloudGame(DAY, USER).xp, 0);
  assert.throws(() => practiceBackup({ xp: 100000 }, DAY));
});
test('fingerprints ignore object property order', async () => {
  assert.equal(await fingerprint({ b: 2, a: { y: 1, x: 2 } }), await fingerprint({ a: { x: 2, y: 1 }, b: 2 }));
});
