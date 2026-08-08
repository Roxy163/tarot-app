export const getLocalStorageBackupKey = (key: string) => `${key}__backup`;
export const getLocalStorageLatestBackupKey = (key: string) => `${key}__latest`;
const getLocalStorageBackupAtKey = (key: string) => `${key}__backup_at`;
const getLocalStorageLatestBackupAtKey = (key: string) => `${key}__latest_at`;

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

const readRecoveryCandidates = (key: string) => [
  getLocalStorageLatestBackupKey(key),
  getLocalStorageBackupKey(key),
];

export function readJsonArrayWithBackup<T>(key: string): T[] | null {
  const readRecovery = () => {
    for (const recoveryKey of readRecoveryCandidates(key)) {
      const recovery = readStoredJson(recoveryKey);
      if (!recovery || !Array.isArray(recovery.parsed)) continue;
      restoreStoredValue(key, recovery.raw);
      return recovery.parsed as T[];
    }

    return null;
  };

  const saved = readStoredJson(key);
  if (!saved) return readRecovery();

  return Array.isArray(saved.parsed) ? saved.parsed as T[] : readRecovery();
}

export function readJsonRecordWithBackup<T extends Record<string, unknown>>(key: string): T | null {
  const readRecovery = () => {
    for (const recoveryKey of readRecoveryCandidates(key)) {
      const recovery = readStoredJson(recoveryKey);
      if (!recovery || !isJsonRecord(recovery.parsed)) continue;
      restoreStoredValue(key, recovery.raw);
      return recovery.parsed as T;
    }

    return null;
  };

  const saved = readStoredJson(key);
  if (!saved) return readRecovery();

  return isJsonRecord(saved.parsed) ? saved.parsed as T : readRecovery();
}

export function writeJsonWithBackup(key: string, value: unknown) {
  try {
    const nextValue = JSON.stringify(value);
    const currentValue = localStorage.getItem(key);

    if (currentValue && currentValue !== nextValue && isValidJson(currentValue)) {
      localStorage.setItem(getLocalStorageBackupKey(key), currentValue);
      localStorage.setItem(getLocalStorageBackupAtKey(key), new Date().toISOString());
    }

    localStorage.setItem(key, nextValue);
    localStorage.setItem(getLocalStorageLatestBackupKey(key), nextValue);
    localStorage.setItem(getLocalStorageLatestBackupAtKey(key), new Date().toISOString());
  } catch (error) {
    console.warn(`Failed to persist ${key}; existing local data was left untouched.`, error);
  }
}
