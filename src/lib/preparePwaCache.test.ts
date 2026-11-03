import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TAROT_CARDS, getCardImageSources } from '../constants';

const root = process.cwd();
const folders: string[] = [];
const originalWorker = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
const imagePaths = TAROT_CARDS.flatMap(card => Object.values(getCardImageSources(card.id)));
const fixture = () => {
  const folder = mkdtempSync(join(tmpdir(), 'tarot-offline-cache-'));
  folders.push(folder);
  mkdirSync(join(folder, 'assets'));
  mkdirSync(join(folder, 'tarot-cards'));
  writeFileSync(join(folder, 'assets/app-test.js'), 'export const app = true;');
  writeFileSync(join(folder, 'index.html'), '<html><script type="module" src="/assets/app-test.js"></script></html>');
  writeFileSync(join(folder, 'sw.js'), originalWorker);
  for (const path of imagePaths) symlinkSync(join(root, 'public', path), join(folder, path));
  return folder;
};
const prepare = (folder: string) => {
  execFileSync(process.execPath, [join(root, 'scripts/prepare-pwa-cache.mjs'), folder], { cwd: root, stdio: 'pipe' });
  return readFileSync(join(folder, 'sw.js'), 'utf8');
};
const version = (worker: string) => worker.match(/const CACHE_VERSION = '([^']+)'/)![1];

describe('offline card build manifest', () => {
  afterEach(() => { folders.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true })); });
  it('contains every existing local card format without remote URLs', () => {
    const worker = prepare(fixture());
    const manifest = JSON.parse(worker.match(/const PRECACHE_CARD_IMAGES = (\[[^;]+\]);/)![1]);
    expect(manifest).toHaveLength(234);
    expect(new Set(manifest)).toEqual(new Set(imagePaths));
    expect(manifest.every((path: string) => path.startsWith('/tarot-cards/'))).toBe(true);
  });
  it('changes the cache version if either the worker policy or a card image changes', () => {
    const folder = fixture();
    const baseline = version(prepare(folder));
    writeFileSync(join(folder, 'sw.js'), `${originalWorker}\n// updated offline policy\n`);
    expect(version(prepare(folder))).not.toBe(baseline);
    writeFileSync(join(folder, 'sw.js'), originalWorker);
    const path = join(folder, 'tarot-cards/ar00.avif');
    const bytes = readFileSync(path);
    rmSync(path);
    writeFileSync(path, Buffer.concat([bytes, Buffer.from('changed-image-content')]));
    expect(version(prepare(folder))).not.toBe(baseline);
  });
  it('fails the build when even one picture format is absent', () => {
    const folder = fixture();
    rmSync(join(folder, 'tarot-cards/sw10.webp'));
    expect(() => prepare(folder)).toThrow();
    expect(readFileSync(join(folder, 'sw.js'), 'utf8')).toBe(originalWorker);
  });
});
