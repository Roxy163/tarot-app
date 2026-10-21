import type { BackupNumerologySetting } from '../types';
import { TAROT_CARDS } from '../constants';
import { getAllNumerologySettings, saveNumerologySetting } from './firebaseData';
import { readJsonRecordWithBackup, requireLocalSave, writeJsonWithBackup } from './safeLocalStorage';

export const NUMEROLOGY_RESTORED = 'tarot-numerology-restored';
export const numerologyRestoreKey = (uid: string) => `tarot_numerology_restore_${uid}`;
const numerologyCacheKey = (uid: string) => `tarot_numerology_cache_${uid}`;
export function getNumerologyCacheInfo(uid: string) {
  return readJsonRecordWithBackup<{ settings: Record<string, BackupNumerologySetting>; checkedAt?: string }>(numerologyCacheKey(uid)) || { settings: {} };
}

export function cacheNumerologySetting(uid: string, name: string, value: BackupNumerologySetting | null) {
  const cache = getNumerologyCacheInfo(uid);
  const settings = { ...cache.settings };
  if (value) settings[name] = value;
  else delete settings[name];
  return writeJsonWithBackup(numerologyCacheKey(uid), { ...cache, settings });
}

export function getLocalBackupNumerology(uid?: string): Record<string, BackupNumerologySetting> {
  if (uid) return { ...getNumerologyCacheInfo(uid).settings, ...readRestoredNumerology(uid) };
  const local = readJsonRecordWithBackup<Record<string, number | Partial<BackupNumerologySetting>>>('tarot_user_numerology') || {};
  return Object.fromEntries(TAROT_CARDS.filter(card => local[card.name] !== undefined).map(card => {
    const value = local[card.name];
    return [card.name, typeof value === 'number'
      ? { numerology: value, meaning: '', keywords: '' }
      : { numerology: value.numerology, meaning: value.meaning || '', keywords: value.keywords || '' }];
  }));
}
export function readRestoredNumerology(uid: string) {
  return readJsonRecordWithBackup<Record<string, BackupNumerologySetting>>(numerologyRestoreKey(uid)) || {};
}

export function clearRestoredNumerology(uid: string, cardName: string) {
  const pending = readRestoredNumerology(uid);
  if (!(cardName in pending)) return;
  delete pending[cardName];
  requireLocalSave(numerologyRestoreKey(uid), pending);
}

export async function getBackupNumerology(uid?: string, isCurrent: () => boolean = () => true): Promise<Record<string, BackupNumerologySetting>> {
  if (uid) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cloud: Record<string, BackupNumerologySetting>;
    try {
      cloud = await Promise.race([
        getAllNumerologySettings(uid),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('云端灵数暂时无法读取。')), 8000); }),
      ]);
    } catch { throw new Error('云端灵数暂时无法读取，本机备份仍可正常导出，已有缓存不会被清除。'); }
    finally { clearTimeout(timer); }
    if (!isCurrent()) throw new Error('账号已变化。');
    requireLocalSave(numerologyCacheKey(uid), { settings: cloud, checkedAt: new Date().toISOString() });
    return { ...readRestoredNumerology(uid), ...cloud };
  }
  return getLocalBackupNumerology();
}

const flushing = new Set<string>();
export async function syncRestoredNumerology(uid: string, isCurrent: () => boolean) {
  if (flushing.has(uid) || !Object.keys(readRestoredNumerology(uid)).length) return;
  flushing.add(uid);
  try {
    const cloud = await getAllNumerologySettings(uid);
    for (const [name, value] of Object.entries(readRestoredNumerology(uid))) {
      if (!isCurrent()) return;
      if (!cloud[name]) await saveNumerologySetting(uid, name, value);
      if (!isCurrent()) return;
      if (!cacheNumerologySetting(uid, name, cloud[name] || value).ok) return;
      // Do not discard a newer import while a previous upload was in flight.
      if (JSON.stringify(readRestoredNumerology(uid)[name]) === JSON.stringify(value)) clearRestoredNumerology(uid, name);
    }
    window.dispatchEvent(new Event(NUMEROLOGY_RESTORED));
  } catch { /* Imported settings remain durable in the current account's local queue. */ }
  finally { flushing.delete(uid); }
}
