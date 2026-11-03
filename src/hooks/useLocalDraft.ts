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

// Imperative draft edits share the hook's runtime copy and leave protection.
// A failed disk write still keeps the newest text available to another editor.
export function writeLocalDraft<T>(key: string, value: T): boolean {
  const serialized = JSON.stringify(value);
  memory.set(key, JSON.parse(serialized) as T);
  try { sessionStorage.setItem(key, serialized); } catch { /* Keep runtime copy. */ }
  const result = writeJsonWithBackup(key, value);
  if (result.ok) failedKeys.delete(key);
  else failedKeys.add(key);
  window.removeEventListener('beforeunload', warnOnLeave);
  if (failedKeys.size) window.addEventListener('beforeunload', warnOnLeave);
  return result.ok;
}

export const isLocalDraftDurable = (key: string) => !failedKeys.has(key);

export function clearLocalDraft(key: string) {
  memory.set(key, null);
  failedKeys.delete(key);
  let durable = true;
  try { sessionStorage.removeItem(key); } catch { durable = false; }
  try { localStorage.setItem(key, 'null'); removeJsonWithBackup(key); } catch { durable = false; }
  return durable;
}

export function useLocalDraft<T>(key: string, value: T, enabled = true) {
  const [durable, setDurable] = useState(true);
  const cleared = useRef<string | null>(null);
  const serialized = JSON.stringify(value);
  useLayoutEffect(() => {
    // A completed/cancelled edit only suppresses its own active session.
    // Starting a new session may intentionally contain exactly the same text.
    if (!enabled) { cleared.current = null; return; }
    if (cleared.current === `${key}:${serialized}`) return;
    setDurable(writeLocalDraft(key, JSON.parse(serialized) as T));
  }, [key, serialized, enabled]);
  return {
    durable,
    clear: () => { cleared.current = `${key}:${serialized}`; clearLocalDraft(key); },
  };
}

export function clearAccountDrafts(uid: string) {
  const belongsToAccount = (key: string) => key.startsWith(`tarot_reading_draft_${uid}_`) || key.startsWith(`tarot_reading_review_draft_${uid}_`) || key.startsWith(`tarot_annotation_draft_${uid}_`) || key.startsWith(`tarot_card_personal_note_draft_${uid}_`) || key.startsWith(`tarot_daily_reflection_draft_${uid}_`) || key === `tarot_personal_meaning_draft_${uid}`;
  const keys = new Set([...memory.keys(), ...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  for (const key of keys) if (belongsToAccount(key)) clearLocalDraft(key);
}
