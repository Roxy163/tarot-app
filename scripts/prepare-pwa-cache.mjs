import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// An optional directory supports isolated build verification without touching
// the app's current preview. Production postbuild still uses dist/.
const distDir = process.argv[2] ? new URL('./', pathToFileURL(`${process.argv[2].replace(/\/$/, '')}/`)) : new URL('../dist/', import.meta.url);
const assetsDir = new URL('assets/', distDir);
const workerPath = new URL('sw.js', distDir);
const cardDir = new URL('tarot-cards/', distDir);

const assetPaths = (await readdir(assetsDir))
  .filter(name => /\.(?:js|css)$/.test(name))
  .sort()
  .map(name => `/assets/${name}`);

if (assetPaths.length === 0) {
  throw new Error('PWA cache preparation found no JavaScript or CSS assets.');
}

const worker = await readFile(workerPath, 'utf8');
const versionMarker = "const CACHE_VERSION = 'dev';";
const assetsMarker = 'const PRECACHE_ASSETS = /* BUILD_ASSETS */ [];';
const cardsMarker = 'const PRECACHE_CARD_IMAGES = /* BUILD_CARD_IMAGES */ [];';

if (!worker.includes(versionMarker) || !worker.includes(assetsMarker) || !worker.includes(cardsMarker)) {
  throw new Error('PWA cache markers are missing from sw.js.');
}

const constants = await readFile(new URL('../src/constants.ts', import.meta.url), 'utf8');
const ids = [...constants.matchAll(/\{\s*id:\s*'((?:ar\d{2})|(?:(?:wa|cu|sw|pe)(?:ac|0[2-9]|10|pa|kn|qu|ki)))'/g)].map(match => match[1]);
if (new Set(ids).size !== 78 || ids.length !== 78) throw new Error('Expected exactly 78 unique tarot card image IDs.');
const cardPaths = ids.sort().flatMap(id => ['avif', 'webp', 'jpg'].map(format => `/tarot-cards/${id}.${format}`));
const html = await readFile(new URL('index.html', distDir), 'utf8');
const versionHash = createHash('sha256').update(html).update(worker).update(assetPaths.join('\n'));
for (const cardPath of cardPaths) {
  const bytes = await readFile(new URL(cardPath.split('/').at(-1), cardDir));
  if (bytes.length < 1024) throw new Error(`Tarot image is missing or incomplete: ${cardPath}`);
  versionHash.update(cardPath).update(bytes);
}
const cacheVersion = versionHash.digest('hex').slice(0, 12);

const preparedWorker = worker
  .replace(versionMarker, `const CACHE_VERSION = '${cacheVersion}';`)
  .replace(assetsMarker, `const PRECACHE_ASSETS = ${JSON.stringify(assetPaths)};`)
  .replace(cardsMarker, `const PRECACHE_CARD_IMAGES = ${JSON.stringify(cardPaths)};`);

await writeFile(workerPath, preparedWorker);
console.log(`PWA cache ready: ${assetPaths.length} app assets + ${cardPaths.length} tarot images, version ${cacheVersion}`);
