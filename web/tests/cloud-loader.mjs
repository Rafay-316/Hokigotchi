import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// Next resolves extensionless TS imports; Node's native TS runner needs .ts.
// Copy into a temporary directory so these tests never rewrite app sources.
export function prepareCloudModules() {
  const dir = mkdtempSync(join(tmpdir(), 'hoki-cloud-tests-'));
  for (const name of ['fork-game', 'cloud-rules', 'cloud-service']) {
    const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8')
      .replaceAll('"./fork-game"', '"./fork-game.ts"').replaceAll('"./cloud-rules"', '"./cloud-rules.ts"');
    writeFileSync(join(dir, `${name}.ts`), source);
  }
  return { url: (name) => pathToFileURL(join(dir, `${name}.ts`)).href, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
