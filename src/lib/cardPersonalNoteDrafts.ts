import { useSyncExternalStore } from 'react';
import { clearLocalDraft, isLocalDraftDurable, readLocalDraft, writeLocalDraft } from '../hooks/useLocalDraft';
import type { CardAnnotation } from '../types';
import { mergeCardPersonalNoteTexts } from './cardPersonalNotes';

const listeners = new Set<() => void>();
let revision = 0;
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getRevision = () => revision;
export const useCardPersonalNoteRevision = () => useSyncExternalStore(subscribe, getRevision);

export const getCardPersonalNoteDraftKey = (scope: string, cardId: string) => `tarot_card_personal_note_draft_${scope}_${cardId}`;
const getLegacyMeaningDraftKey = (scope: string) => `tarot_personal_meaning_draft_${scope}`;
export const getCardAnnotationDraftKey = (scope: string, cardId: string) => `tarot_annotation_draft_${scope}_${cardId}`;

export function readCardPersonalNoteText(scope: string, cardId: string, cardName: string, saved?: Partial<CardAnnotation> | null) {
  const shared = readLocalDraft<{ text?: string }>(getCardPersonalNoteDraftKey(scope, cardId));
  if (typeof shared?.text === 'string') return shared.text;
  const editor = readLocalDraft<{ personalNotes?: string; personalNotesUnified?: boolean }>(getCardAnnotationDraftKey(scope, cardId));
  if (editor?.personalNotesUnified && typeof editor.personalNotes === 'string') return editor.personalNotes;
  const meanings = readLocalDraft<Record<string, string>>(getLegacyMeaningDraftKey(scope));
  return mergeCardPersonalNoteTexts(
    meanings?.[cardName] ?? saved?.personalMeaning,
    editor?.personalNotes ?? saved?.personalNotes,
  );
}

export function writeCardPersonalNoteDraft(scope: string, cardId: string, text: string) {
  const durable = writeLocalDraft(getCardPersonalNoteDraftKey(scope, cardId), { text });
  notify();
  return durable;
}

export const isCardPersonalNoteDraftDurable = (scope: string, cardId: string) => isLocalDraftDurable(getCardPersonalNoteDraftKey(scope, cardId));

// A successful note save retires its old aliases while preserving drafts for
// other cards and every unsaved official field in the full annotation editor.
export function clearCardPersonalNoteDrafts(scope: string, cardId: string, cardName: string) {
  let retired = true;
  const meaningKey = getLegacyMeaningDraftKey(scope);
  const meanings = readLocalDraft<Record<string, string>>(meaningKey);
  if (meanings && Object.hasOwn(meanings, cardName)) {
    const remaining = { ...meanings };
    delete remaining[cardName];
    if (Object.keys(remaining).length) retired = writeLocalDraft(meaningKey, remaining) && retired;
    else retired = clearLocalDraft(meaningKey) && retired;
  }
  const editorKey = getCardAnnotationDraftKey(scope, cardId);
  const editor = readLocalDraft<Record<string, unknown>>(editorKey);
  if (editor && Object.hasOwn(editor, 'personalNotes')) {
    const remaining = { ...editor };
    delete remaining.personalNotes;
    delete remaining.personalNotesUnified;
    retired = writeLocalDraft(editorKey, remaining) && retired;
  }
  // If retiring an old alias fails, the newest shared draft remains the durable
  // fallback after a reload, instead of letting that old alias reappear.
  if (retired) clearLocalDraft(getCardPersonalNoteDraftKey(scope, cardId));
  notify();
}
