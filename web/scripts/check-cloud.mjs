// Live integration check. Run manually from web/ while next dev is running.
// Creates two temporary Auth users (without emails) and deletes them in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
assert.ok(url && publishable && secret, 'Set the three Supabase variables in web/.env.local first.');
const origin = process.env.HOKI_TEST_APP_URL || 'http://localhost:3000';
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secret, options), users = [];
const anonymous = createClient(url, publishable, options);
async function call(path, token, body) {
  const response = await fetch(`${origin}/api/cloud/${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(25000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function tempPlayer() {
  const email = `hoki-test-${randomUUID()}@example.invalid`, password = `Hoki!${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error); users.push(created.data.user.id);
  const client = createClient(url, publishable, options);
  const login = await client.auth.signInWithPassword({ email, password }); assert.ifError(login.error);
  return { client, token: login.data.session.access_token, id: created.data.user.id };
}
let failed = false;
let stage = 'authentication checks';
try {
  assert.equal((await call('state')).status, 401, 'Missing token must be rejected (503 means configuration incomplete).');
  assert.equal((await call('state', 'forged.jwt.token')).status, 401);
  stage = 'temporary test accounts';
  const a = await tempPlayer(), b = await tempPlayer();
  stage = 'initial cloud state';
  const initial = await call('state', a.token); assert.equal(initial.status, 200, JSON.stringify(initial.data));
  assert.equal(initial.data.game.xp, 0); assert.equal(initial.data.listed, false);
  const action = (value, state) => ({ requestId: randomUUID(), revision: state.revision, day: state.day, action: value });
  stage = 'duplicate saves (both responses must be 200, with XP awarded once)';
  const once = action({ type: 'checkin' }, initial.data);
  const duplicate = await Promise.all([call('action', a.token, once), call('action', a.token, once)]);
  duplicate.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.data)));
  let state = (await call('state', a.token)).data; assert.equal(state.game.xp, 10); assert.equal(state.revision, 1);
  stage = 'request validation and player isolation';
  assert.equal((await call('action', a.token, { ...once, action: { type: 'feed' } })).status, 409);
  assert.equal((await call('action', a.token, { ...action({ type: 'checkin' }, state), userId: b.id })).status, 400);
  assert.equal((await call('action', a.token, action({ type: 'checkin', xp: 9999 }, state))).status, 400);
  assert.equal((await call('state', b.token)).data.game.xp, 0);
  stage = 'distinct concurrent saves (one 200 and one 409 expected)';
  const race = await Promise.all([
    call('action', a.token, action({ type: 'name', name: 'Test explorer A' }, state)),
    call('action', a.token, action({ type: 'name', name: 'Test explorer B' }, state)),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  stage = 'leaderboard opt-in and public fields';
  state = (await call('state', a.token)).data;
  assert.equal((await call('action', a.token, action({ type: 'visibility', listed: true }, state))).status, 200);
  const league = await call('leaderboard', a.token); assert.equal(league.status, 200);
  assert.ok(league.data.rows.some((r) => r.is_you));
  for (const row of league.data.rows) assert.deepEqual(Object.keys(row).sort(), ['position','player_name','score','logging_days','checkins','is_you'].sort());
  stage = 'database client access restrictions';
  for (const client of [anonymous, a.client, b.client]) {
    for (const table of ['hoki_players','hoki_receipts','hoki_practice_backups']) {
      const read = await client.from(table).select('*'); assert.ok(read.error || read.data.length === 0, `${table} must not be readable by client roles`);
      const write = await client.from(table).upsert({ user_id: a.id, game: state.game }); assert.ok(write.error, `${table} must not accept client writes`);
    }
    const rpc = await client.rpc('hoki_ensure', { p_user: a.id, p_game: state.game }); assert.ok(rpc.error, 'Privileged RPC must be inaccessible');
  }
  stage = 'private practice backups';
  assert.equal((await call('backup', a.token, { game: state.game })).status, 200);
  assert.equal((await call('backup', b.token)).data.backup, null);
  assert.equal((await call('backup', a.token)).data.backup.game.xp, state.game.xp);
  console.log('PASS: live auth, private data, duplicate/racing saves, opt-in rankings, backups and client privilege restrictions.');
} catch (error) {
  failed = true; console.error(`FAIL [${stage}]:`, error.message);
} finally {
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { failed = true; console.error(`Delete temporary test user ${id} in Supabase Auth: ${error.message}`); }
  }
}
if (failed) process.exitCode = 1;
