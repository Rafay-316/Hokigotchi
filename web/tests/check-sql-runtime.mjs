// Optional isolated PostgreSQL checks. Requires @electric-sql/pglite.
// Creates only in-memory databases; never connects to your Supabase project.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const migration = await readFile(new URL('../supabase/migrations/202609200001_hokigotchi.sql', import.meta.url), 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
const request = '22222222-2222-4222-8222-222222222222';
const initialGame = { name: 'Test Hoki', weekly: { start: '2026-09-14', score: 0 }, days: {} };
const earnedGame = {
  ...initialGame,
  weekly: { start: '2026-09-14', score: 25 },
  days: { '2026-09-20': { expenses: 1, checkin: true } },
};

async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  // Minimal Supabase prerequisites, not a replacement for hosted Auth tests.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${user}');
  `);
  return db;
}

async function snapshot(db) {
  const result = {};
  for (const table of ['hoki_players', 'hoki_receipts', 'hoki_practice_backups']) {
    result[table] = (await db.query(`select * from public.${table} order by user_id`)).rows;
  }
  return result;
}

async function commit(db) {
  return (await db.query(
    'select public.hoki_commit($1, 0, $2, $3, $4::jsonb, true, $5) as result',
    [user, request, 'test-fingerprint', JSON.stringify(earnedGame), 'Budget saved'],
  )).rows[0].result;
}

async function checkAccess(db) {
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['hoki_players', 'hoki_receipts', 'hoki_practice_backups']) {
      for (const permission of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const { rows } = await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, `public.${table}`, permission]);
        assert.equal(rows[0].allowed, false, `${role} ${permission} ${table}`);
      }
    }
    for (const signature of ['hoki_ensure(uuid,jsonb)', 'hoki_commit(uuid,bigint,uuid,text,jsonb,boolean,text)', 'hoki_leaderboard(uuid,date,text)']) {
      const { rows } = await db.query('select has_function_privilege($1, $2, $3) as allowed', [role, `public.${signature}`, 'EXECUTE']);
      assert.equal(rows[0].allowed, false, `${role} ${signature}`);
    }
  }
  const { rows } = await db.query("select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)", [['hoki_players', 'hoki_receipts', 'hoki_practice_backups']]);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.relrowsecurity));
}

test('fresh setup executes all functions; rerunning preserves player, receipt and backup data', async (t) => {
  const db = await database(t);
  await db.exec(migration);
  await db.exec('set role service_role');
  await db.query('select public.hoki_ensure($1, $2::jsonb)', [user, JSON.stringify(initialGame)]);
  assert.deepEqual(await commit(db), { status: 'committed', notice: 'Budget saved' });
  assert.deepEqual(await commit(db), { status: 'duplicate', notice: 'Budget saved' });
  await db.query('insert into public.hoki_practice_backups(user_id, game) values ($1, $2::jsonb)', [user, JSON.stringify({ name: 'Practice Hoki', xp: 150 })]);
  await db.exec('reset role');
  const before = await snapshot(db);
  assert.equal(before.hoki_players[0].revision, 1);
  assert.equal(before.hoki_receipts.length, 1);
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual(await snapshot(db), before);
  await checkAccess(db);
  await db.exec('set role service_role');
  assert.deepEqual(await commit(db), { status: 'duplicate', notice: 'Budget saved' });
  const { rows } = await db.query("select * from public.hoki_leaderboard($1, '2026-09-20', 'score')", [user]);
  assert.deepEqual(rows, [{ position: 1, player_name: 'Test Hoki', score: 25, logging_days: 1, checkins: 1, is_you: true }]);
});

test('partial setup with an existing player table completes without changing saved progress', async (t) => {
  const db = await database(t);
  const playerTable = migration.match(/create table if not exists public\.hoki_players\s*\([\s\S]*?\);/)[0];
  await db.exec(playerTable);
  await db.query('insert into public.hoki_players(user_id, game, revision, listed) values ($1, $2::jsonb, 7, true)', [user, JSON.stringify(earnedGame)]);
  const before = (await db.query('select * from public.hoki_players')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select * from public.hoki_players')).rows, before);
  await checkAccess(db);
  await db.exec('set role service_role');
  await db.query('select public.hoki_ensure($1, $2::jsonb)', [user, JSON.stringify(initialGame)]);
  assert.deepEqual((await db.query('select * from public.hoki_players')).rows, before);
  assert.equal((await db.query("select * from public.hoki_leaderboard($1, '2026-09-20', 'score')", [user])).rows[0].score, 25);
  assert.deepEqual(await commit(db), { status: 'conflict' });
});
