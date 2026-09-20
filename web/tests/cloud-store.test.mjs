import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareCloudModules } from './cloud-loader.mjs';
const wait = () => new Promise((resolve) => setTimeout(resolve, 15));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { resolve, promise }; };

test('client preserves practice, gates unconfirmed saves, and ignores stale or cross-account responses', async () => {
  const files = prepareCloudModules();
  const base = new URL('.', files.url('fork-game'));
  const globals = ['localStorage', 'sessionStorage', 'window', 'fetch', '__sub', '__authCallback', '__cloudRequest'];
  const previous = Object.fromEntries(globals.map((key) => [key, globalThis[key]]));
  function storage() { const data = new Map(); return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) }; }
  try {
    writeFileSync(fileURLToPath(new URL('react-mock.mjs', base)), 'export function useSyncExternalStore(subscribe, get) { globalThis.__sub ??= subscribe(() => {}); return get(); }');
    writeFileSync(fileURLToPath(new URL('client-mock.mjs', base)), `
      export class RequestError extends Error { constructor(message,status){super(message);this.status=status;} }
      export function cloudClient(){return {auth:{onAuthStateChange(cb){globalThis.__authCallback=cb;}}};}
      export async function cloudRequest(...args){return globalThis.__cloudRequest(...args);}
    `);
    const source = readFileSync(new URL('../src/app/fork-game-store.ts', import.meta.url), 'utf8')
      .replaceAll('"react"', '"./react-mock.mjs"').replaceAll('"@/lib/fork-game"', '"./fork-game.ts"')
      .replaceAll('"@/lib/cloud-rules"', '"./cloud-rules.ts"').replaceAll('"./cloud-client"', '"./client-mock.mjs"');
    writeFileSync(fileURLToPath(new URL('store.ts', base)), source);
    globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    globalThis.fetch = async () => ({ json: async () => ({ configured: true }) });
    const { createGame, applyAction, STORAGE_KEY } = await import(files.url('fork-game'));
    const { cloudTransition } = await import(files.url('cloud-rules'));
    const guest = applyAction(createGame(), { type: 'checkin' }).game;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
    const states = new Map(); let failAfterSave = false, heldRead = null, heldAction = null;
    const receipt = new Set();
    globalThis.__cloudRequest = async (path, init, user) => {
      if (!states.has(user)) states.set(user, { game: createGame(), revision: 0, listed: false, day: guest.pet.started });
      let state = states.get(user);
      if (path === 'state') {
        const copy = structuredClone(state);
        if (heldRead) { const gate = heldRead; heldRead = null; await gate.promise; }
        return copy;
      }
      assert.equal(path, 'action');
      const envelope = JSON.parse(init.body);
      if (!receipt.has(envelope.requestId)) {
        const result = cloudTransition(state.game, envelope.action, state.day);
        state = { ...state, ...result, revision: state.revision + 1 }; states.set(user, state); receipt.add(envelope.requestId);
      }
      if (heldAction) { const gate = heldAction; heldAction = null; await gate.promise; }
      if (failAfterSave) { failAfterSave = false; throw new Error('Lost connection after commit'); }
      return structuredClone(state);
    };
    const store = await import(new URL('store.ts', base));
    const current = () => store.useAdventure();
    assert.equal(current().mode, 'practice'); assert.equal(current().game.xp, 10);
    globalThis.__authCallback('SIGNED_IN', { user: { id: 'user-a', email: 'a@example.test' } });
    await wait();
    assert.equal(current().mode, 'cloud'); assert.equal(current().game.xp, 0);
    assert.equal(current().status, 'ready');
    failAfterSave = true;
    store.dispatchGame({ type: 'checkin' });
    assert.equal(current().busy, true); assert.equal(current().game.xp, 0);
    await wait();
    assert.equal(current().pending, true); assert.equal(current().game.xp, 0);
    assert.ok(sessionStorage.getItem('hokigotchi.pending.user-a'));
    await store.retryCloudAction();
    assert.equal(current().game.xp, 10); assert.equal(current().pending, false); assert.equal(current().revision, 1);
    assert.equal(sessionStorage.getItem('hokigotchi.pending.user-a'), null);
    const readGate = deferred(); heldRead = readGate;
    const refresh = store.refreshCloud();
    store.dispatchGame({ type: 'name', name: 'Maroon Explorer' }); await wait();
    readGate.resolve(); await refresh;
    assert.equal(current().game.name, 'Maroon Explorer'); assert.equal(current().revision, 2);
    const actionGate = deferred(); heldAction = actionGate;
    store.dispatchGame({ type: 'name', name: 'Saved for A' }); await wait();
    globalThis.__authCallback('SIGNED_IN', { user: { id: 'user-b', email: 'b@example.test' } }); await wait();
    actionGate.resolve(); await wait();
    assert.equal(current().account.id, 'user-b'); assert.equal(current().game.xp, 0);
    assert.notEqual(current().game.name, 'Saved for A');
    globalThis.__authCallback('SIGNED_OUT', null); await wait();
    assert.equal(current().mode, 'practice'); assert.deepEqual(current().game, guest);
    assert.equal(localStorage.getItem(STORAGE_KEY), JSON.stringify(guest));
  } finally {
    globalThis.__sub?.();
    for (const key of globals) { if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key]; }
    files.cleanup();
  }
});
