import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const distDir = new URL('../dist/', import.meta.url);
const assetsDir = new URL('../dist/assets/', import.meta.url);
const workerPath = new URL('sw.js', distDir);

const assetPaths = (await readdir(assetsDir))
  .filter(name => /\.(?:js|css)$/.test(name))
  .sort()
  .map(name => `/assets/${name}`);

if (assetPaths.length === 0) {
  throw new Error('PWA cache preparation found no JavaScript or CSS assets.');
}

const html = await readFile(new URL('index.html', distDir), 'utf8');
const cacheVersion = createHash('sha256')
  .update(html)
  .update(assetPaths.join('\n'))
  .digest('hex')
  .slice(0, 12);

const worker = await readFile(workerPath, 'utf8');
const versionMarker = "const CACHE_VERSION = 'dev';";
const assetsMarker = 'const PRECACHE_ASSETS = /* BUILD_ASSETS */ [];';

if (!worker.includes(versionMarker) || !worker.includes(assetsMarker)) {
  throw new Error('PWA cache markers are missing from sw.js.');
}

const preparedWorker = worker
  .replace(versionMarker, `const CACHE_VERSION = '${cacheVersion}';`)
  .replace(assetsMarker, `const PRECACHE_ASSETS = ${JSON.stringify(assetPaths)};`);

await writeFile(workerPath, preparedWorker);
console.log(`PWA cache ready: ${assetPaths.length} assets, version ${cacheVersion}`);
