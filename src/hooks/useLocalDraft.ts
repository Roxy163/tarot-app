import { useLayoutEffect, useRef, useState } from 'react';
import { removeJsonWithBackup, writeJsonWithBackup } from '../lib/safeLocalStorage';

const memory = new Map<string, unknown>();
const failedKeys = new Set<string>();
const warnOnLeave = (event: BeforeUnloadEvent) => {
  if (!failedKeys.size) return;
  event.preventDefault();
  event.returnValue = '';
};
export function resetDraftMemory() { memory.clear(); failedKeys.clear(); window.removeEventListener('beforeunload', warnOnLeave); }

export function readLocalDraft<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key) as T | null;
  try {
    const saved = sessionStorage.getItem(key) || localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : null;
  } catch { return null; }
}

export function clearLocalDraft(key: string) {
  memory.set(key, null);
  failedKeys.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
  try { localStorage.setItem(key, 'null'); removeJsonWithBackup(key); } catch { /* The runtime tombstone prevents reopening a completed draft. */ }
}

export function useLocalDraft<T>(key: string, value: T, enabled = true) {
  const [durable, setDurable] = useState(true);
  const cleared = useRef<string | null>(null);
  const serialized = JSON.stringify(value);
  useLayoutEffect(() => {
    if (!enabled || cleared.current === `${key}:${serialized}`) return;
    const snapshot = JSON.parse(serialized) as T;
    memory.set(key, snapshot);
    // This copy survives a reload even if local storage is full.
    try { sessionStorage.setItem(key, serialized); } catch { /* Keep runtime copy. */ }
    const result = writeJsonWithBackup(key, snapshot);
    setDurable(result.ok);
    if (result.ok) failedKeys.delete(key);
    else failedKeys.add(key);
    // Keep the guard when navigating within the app while an unpersisted draft exists.
    window.removeEventListener('beforeunload', warnOnLeave);
    if (failedKeys.size) window.addEventListener('beforeunload', warnOnLeave);
  }, [key, serialized, enabled]);
  return {
    durable,
    clear: () => { cleared.current = `${key}:${serialized}`; clearLocalDraft(key); },
  };
}

export function clearAccountDrafts(uid: string) {
  const belongsToAccount = (key: string) => key.startsWith(`tarot_reading_draft_${uid}_`) || key.startsWith(`tarot_annotation_draft_${uid}_`) || key.startsWith(`tarot_daily_reflection_draft_${uid}_`) || key === `tarot_personal_meaning_draft_${uid}`;
  const keys = new Set([...memory.keys(), ...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  for (const key of keys) if (belongsToAccount(key)) clearLocalDraft(key);
}
