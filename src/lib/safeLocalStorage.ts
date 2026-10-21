export const getLocalStorageBackupKey = (key: string) => `${key}__backup`;
export const getLocalStorageLatestBackupKey = (key: string) => `${key}__latest`;
const getLocalStorageBackupAtKey = (key: string) => `${key}__backup_at`;
const getLocalStorageLatestBackupAtKey = (key: string) => `${key}__latest_at`;
const TRANSACTION_KEY = 'tarot_restore_transaction';

export function recoverLocalRestore() {
  let raw: string | null;
  try { raw = localStorage.getItem(TRANSACTION_KEY); } catch { return; }
  if (!raw) return;
  const entries: [string, string | null][] = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.some(entry => !Array.isArray(entry) || entry.length !== 2
    || !/^tarot_(guest_data|readings_[\w-]+|daily_fortunes(?:_[\w-]+)?|spreads(?:_[\w-]+)?|card_metadata(?:_[\w-]+)?|card_keyword_memory(?:_[\w-]+)?|quiz_memory(?:_[\w-]+)?|user_annotations_[\w-]+|user_numerology|numerology_restore_[\w-]+)$/.test(entry[0])
    || (entry[1] !== null && typeof entry[1] !== 'string'))) throw new Error('本机恢复记录异常，请保留页面并联系作者。');
  for (const [key, value] of entries) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
  localStorage.removeItem(TRANSACTION_KEY);
}

// A journal keeps an interrupted or failed multi-key restore from becoming partial data.
export function commitLocalRestore(values: Record<string, unknown>) {
  recoverLocalRestore();
  const entries = Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)] as const);
  const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    localStorage.setItem(TRANSACTION_KEY, JSON.stringify(previous));
    for (const [key, value] of entries) localStorage.setItem(key, value);
    localStorage.removeItem(TRANSACTION_KEY);
  } catch {
    try { recoverLocalRestore(); } catch { /* Leave the journal for recovery on the next read. */ }
    throw new Error('本机空间不足或禁止写入，恢复未完成。原有资料已保留，请释放空间后重试。');
  }
  for (const [key, value] of entries) {
    try {
      const old = previous.find(entry => entry[0] === key)?.[1];
      if (old && old !== value) localStorage.setItem(getLocalStorageBackupKey(key), old);
      localStorage.setItem(getLocalStorageLatestBackupKey(key), value);
      localStorage.setItem(getLocalStorageLatestBackupAtKey(key), new Date().toISOString());
    } catch { /* The primary transaction has already committed. */ }
  }
}

const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const isJsonRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const getStoredValue = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const restoreStoredValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 当前浏览器不允许写入时，仍可把备份值返回给调用方使用。
  }
};

const readStoredJson = (key: string) => {
  const saved = getStoredValue(key);
  if (!saved) return null;

  try {
    return { raw: saved, parsed: JSON.parse(saved) };
  } catch {
    return null;
  }
};

function readJsonWithBackup(key: string, isExpectedShape: (value: unknown) => boolean): unknown {
  recoverLocalRestore();
  // Primary first, then the latest mirror, then the previous version.
  for (const candidateKey of [key, getLocalStorageLatestBackupKey(key), getLocalStorageBackupKey(key)]) {
    const candidate = readStoredJson(candidateKey);
    if (!candidate || !isExpectedShape(candidate.parsed)) continue;
    if (candidateKey !== key) restoreStoredValue(key, candidate.raw);
    return candidate.parsed;
  }
  return null;
}

export function readJsonArrayWithBackup<T>(key: string): T[] | null {
  return readJsonWithBackup(key, Array.isArray) as T[] | null;
}

export function readJsonRecordWithBackup<T extends Record<string, unknown>>(key: string): T | null {
  return readJsonWithBackup(key, isJsonRecord) as T | null;
}

export type LocalSaveResult = { ok: true } | { ok: false; error: unknown };
export const LOCAL_SAVE_ERROR = 'tarot-local-save-error';

export function writeJsonWithBackup(key: string, value: unknown): LocalSaveResult {
  try {
    recoverLocalRestore();
    const nextValue = JSON.stringify(value);
    const currentValue = localStorage.getItem(key);

    if (currentValue && currentValue !== nextValue && isValidJson(currentValue)) {
      try {
        localStorage.setItem(getLocalStorageBackupKey(key), currentValue);
        localStorage.setItem(getLocalStorageBackupAtKey(key), new Date().toISOString());
      } catch { /* A full backup must not prevent saving the primary record. */ }
    }

    localStorage.setItem(key, nextValue);
    try {
      localStorage.setItem(getLocalStorageLatestBackupKey(key), nextValue);
      localStorage.setItem(getLocalStorageLatestBackupAtKey(key), new Date().toISOString());
    } catch { /* The primary record is durable even if its mirror cannot be refreshed. */ }
    return { ok: true };
  } catch (error) {
    console.warn(`Failed to persist ${key}.`, error);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LOCAL_SAVE_ERROR, { detail: { key } }));
    return { ok: false, error };
  }
}

export function requireLocalSave(key: string, value: unknown) {
  const result = writeJsonWithBackup(key, value);
  if (!result.ok) throw new Error('本机保存失败，请保留当前页面，释放存储空间后重试。');
}

export function removeJsonWithBackup(key: string) {
  for (const suffix of ['', '__backup', '__latest', '__backup_at', '__latest_at']) {
    localStorage.removeItem(`${key}${suffix}`);
  }
}
