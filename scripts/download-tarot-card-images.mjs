import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const constantsPath = join(root, 'src/constants.ts');
const outputDir = join(root, 'public/tarot-cards');
const imageWidth = 330;
const concurrency = Number(process.env.TAROT_IMAGE_CONCURRENCY || 4);

const MAJOR_ARCANA_IMAGE_FILES = {
  ar00: 'RWS_Tarot_00_Fool.jpg',
  ar01: 'RWS_Tarot_01_Magician.jpg',
  ar02: 'RWS_Tarot_02_High_Priestess.jpg',
  ar03: 'RWS_Tarot_03_Empress.jpg',
  ar04: 'RWS_Tarot_04_Emperor.jpg',
  ar05: 'RWS_Tarot_05_Hierophant.jpg',
  ar06: 'RWS_Tarot_06_Lovers.jpg',
  ar07: 'RWS_Tarot_07_Chariot.jpg',
  ar08: 'RWS_Tarot_08_Strength.jpg',
  ar09: 'RWS_Tarot_09_Hermit.jpg',
  ar10: 'RWS_Tarot_10_Wheel_of_Fortune.jpg',
  ar11: 'RWS_Tarot_11_Justice.jpg',
  ar12: 'RWS_Tarot_12_Hanged_Man.jpg',
  ar13: 'RWS_Tarot_13_Death.jpg',
  ar14: 'RWS_Tarot_14_Temperance.jpg',
  ar15: 'RWS_Tarot_15_Devil.jpg',
  ar16: 'RWS_Tarot_16_Tower.jpg',
  ar17: 'RWS_Tarot_17_Star.jpg',
  ar18: 'RWS_Tarot_18_Moon.jpg',
  ar19: 'RWS_Tarot_19_Sun.jpg',
  ar20: 'RWS_Tarot_20_Judgement.jpg',
  ar21: 'RWS_Tarot_21_World.jpg',
};

const MINOR_ARCANA_IMAGE_PREFIX = {
  wa: 'Wands',
  cu: 'Cups',
  sw: 'Swords',
  pe: 'Pents',
};

const MINOR_ARCANA_RANK_NUMBER = {
  ac: '01',
  pa: '11',
  kn: '12',
  qu: '13',
  ki: '14',
};

const getCardImageFileName = (id) => {
  if (MAJOR_ARCANA_IMAGE_FILES[id]) return MAJOR_ARCANA_IMAGE_FILES[id];

  const suit = id.slice(0, 2);
  const rank = id.slice(2);
  const suitPrefix = MINOR_ARCANA_IMAGE_PREFIX[suit];
  const rankNumber = MINOR_ARCANA_RANK_NUMBER[rank] || rank;

  if (!suitPrefix || !/^\d{2}$/.test(rankNumber)) {
    return MAJOR_ARCANA_IMAGE_FILES.ar00;
  }

  return `${suitPrefix}${rankNumber}.jpg`;
};

const getRemoteUrl = (fileName) => {
  const url = new URL(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`);
  url.searchParams.set('width', String(imageWidth));
  return url.toString();
};

const sleep = (ms) => new Promise(resolve => {
  setTimeout(resolve, ms);
});

const runCurl = (url, outputPath) => new Promise((resolve, reject) => {
  const child = spawn('curl', [
    '-L',
    '--fail',
    '--silent',
    '--show-error',
    '--max-time',
    '45',
    '--retry',
    '2',
    '--retry-delay',
    '1',
    '--user-agent',
    'tarot-pavilion-static-asset-fetch/1.0',
    '--output',
    outputPath,
    url,
  ]);

  let stderr = '';
  child.stderr.on('data', data => {
    stderr += data.toString();
  });
  child.on('error', reject);
  child.on('close', code => {
    if (code === 0) resolve();
    else reject(new Error(stderr.trim() || `curl exited with code ${code}`));
  });
});

const downloadImage = async ({ id, fileName }, attempt = 1) => {
  const url = getRemoteUrl(fileName);
  const outputPath = join(outputDir, `${id}.jpg`);
  try {
    await runCurl(url, outputPath);
    const buffer = await readFile(outputPath);
    if (buffer.length < 1024) throw new Error('Image file is unexpectedly small');
    return { id, ok: true, bytes: buffer.length };
  } catch (error) {
    if (attempt < 3) {
      await sleep(600 * attempt);
      return downloadImage({ id, fileName }, attempt + 1);
    }
    return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const runPool = async (items, worker) => {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor];
      cursor += 1;
      const result = await worker(current);
      results.push(result);
      const size = result.ok ? `${Math.round(result.bytes / 1024)}KB` : result.error;
      console.log(`${result.ok ? '✓' : '✗'} ${result.id} ${size}`);
    }
  });

  await Promise.all(workers);
  return results;
};

const constants = await readFile(constantsPath, 'utf8');
const ids = Array.from(constants.matchAll(/\{\s*id:\s*'([^']+)'/g), match => match[1]);
const uniqueIds = Array.from(new Set(ids)).filter(id => /^[a-z]{2}\d{2}$|^[a-z]{2}(ac|pa|kn|qu|ki)$/.test(id));
const cards = uniqueIds.map(id => ({ id, fileName: getCardImageFileName(id) }));

await mkdir(outputDir, { recursive: true });

console.log(`Downloading ${cards.length} tarot card images to ${outputDir}`);
const results = await runPool(cards, downloadImage);
const failed = results.filter(result => !result.ok);

if (failed.length > 0) {
  console.error(`Failed to download ${failed.length} images:`);
  failed.forEach(result => console.error(`- ${result.id}: ${result.error}`));
  process.exit(1);
}

console.log(`Done. Downloaded ${results.length} images.`);
