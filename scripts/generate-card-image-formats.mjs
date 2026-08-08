import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const cardDir = path.join(repoRoot, 'public', 'tarot-cards');

const WEBP_OPTIONS = { quality: 78, effort: 5 };
const AVIF_OPTIONS = { quality: 54, effort: 6 };

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

const getTotalSize = async (files) => {
  const sizes = await Promise.all(files.map(async (file) => (await fs.stat(file)).size));
  return sizes.reduce((sum, size) => sum + size, 0);
};

const main = async () => {
  const entries = await fs.readdir(cardDir, { withFileTypes: true });
  const jpgFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.jpg'))
    .map(entry => path.join(cardDir, entry.name))
    .sort();

  if (!jpgFiles.length) {
    throw new Error(`No JPG tarot cards found in ${cardDir}`);
  }

  let webpCount = 0;
  let avifCount = 0;

  for (const input of jpgFiles) {
    const parsed = path.parse(input);
    const webpOutput = path.join(parsed.dir, `${parsed.name}.webp`);
    const avifOutput = path.join(parsed.dir, `${parsed.name}.avif`);

    await sharp(input)
      .rotate()
      .webp(WEBP_OPTIONS)
      .toFile(webpOutput);
    webpCount += 1;

    await sharp(input)
      .rotate()
      .avif(AVIF_OPTIONS)
      .toFile(avifOutput);
    avifCount += 1;
  }

  const webpFiles = jpgFiles.map(file => file.replace(/\.jpg$/, '.webp'));
  const avifFiles = jpgFiles.map(file => file.replace(/\.jpg$/, '.avif'));
  const jpgTotal = await getTotalSize(jpgFiles);
  const webpTotal = await getTotalSize(webpFiles);
  const avifTotal = await getTotalSize(avifFiles);

  console.log(`Generated ${webpCount} WebP and ${avifCount} AVIF tarot card images.`);
  console.log(`JPG : ${formatBytes(jpgTotal)}`);
  console.log(`WebP: ${formatBytes(webpTotal)} (${Math.round((1 - webpTotal / jpgTotal) * 100)}% smaller)`);
  console.log(`AVIF: ${formatBytes(avifTotal)} (${Math.round((1 - avifTotal / jpgTotal) * 100)}% smaller)`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
