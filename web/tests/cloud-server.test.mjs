import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareCloudModules } from './cloud-loader.mjs';

test('API authentication verifies the bearer token before creating a privileged database client', async () => {
  const files = prepareCloudModules(), base = new URL('.', files.url('fork-game'));
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'];
  const before = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
    process.env.SUPABASE_SECRET_KEY = 'server-test-key';
    globalThis.__clients = [];
    writeFileSync(fileURLToPath(new URL('sdk-mock.mjs', base)), `
      export function createClient(url,key) {
        globalThis.__clients.push(key);
        return {auth:{getUser:async(token)=>{
          globalThis.__verifiedToken=token;
          return globalThis.__userResponse;
        }}};
      }
    `);
    writeFileSync(fileURLToPath(new URL('server.ts', base)), readFileSync(new URL('../src/lib/cloud-server.ts', import.meta.url), 'utf8')
      .replace('import "server-only";', '').replaceAll('"@supabase/supabase-js"', '"./sdk-mock.mjs"').replaceAll('"./cloud-service"', '"./cloud-service.ts"'));
    const { authenticate, readBody, respond } = await import(new URL('server.ts', base));
    await assert.rejects(authenticate(new Request('http://localhost/api/cloud/state')), { status: 401 });
    assert.deepEqual(globalThis.__clients, []);
    const request = new Request('http://localhost/api/cloud/state?user=another-user', { headers: { Authorization: 'Bearer supplied.token.value' } });
    globalThis.__userResponse = { data: { user: null }, error: new Error('invalid JWT') };
    await assert.rejects(authenticate(request), { status: 401 });
    assert.deepEqual(globalThis.__clients, ['public-test-key']);
    globalThis.__userResponse = { data: { user: { id: 'verified-user', is_anonymous: true } }, error: null };
    await assert.rejects(authenticate(request), { status: 401 });
    globalThis.__userResponse = { data: { user: { id: 'verified-user', is_anonymous: false } }, error: null };
    const auth = await authenticate(request);
    assert.equal(auth.user, 'verified-user'); assert.equal(globalThis.__verifiedToken, 'supplied.token.value');
    assert.equal(globalThis.__clients.at(-1), 'server-test-key');
    const json = (body, contentType = 'application/json') => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': contentType }, body });
    assert.deepEqual(await readBody(json('{"ok":true}')), { ok: true });
    await assert.rejects(readBody(json('{')), { status: 400 });
    await assert.rejects(readBody(json('{}', 'text/plain')), { status: 415 });
    await assert.rejects(readBody(json(JSON.stringify({ large: 'x'.repeat(200) })), 50), { status: 413 });
    assert.match(respond({ ok: true }).headers.get('Cache-Control'), /no-store/);
    delete process.env.SUPABASE_SECRET_KEY;
    await assert.rejects(authenticate(request), { status: 503 });
  } finally {
    for (const key of names) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
    delete globalThis.__clients; delete globalThis.__verifiedToken; delete globalThis.__userResponse;
    files.cleanup();
  }
});
