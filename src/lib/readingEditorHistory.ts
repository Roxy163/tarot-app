import type { ReadingEditorHistoryEntry, ReadingEditorSnapshot, ReadingSlotData } from '../types';
import { HISTORY_LIMIT } from './readingSlotOperations';

export const appendEditorHistory = (history: ReadingEditorHistoryEntry[], snapshot: ReadingEditorSnapshot) => (
  [...history, snapshot].slice(-HISTORY_LIMIT)
);

// Runtime layout edits retain references for unchanged slots. Match those
// first, then an edited slot at the same index; new/copy slots start unwritten.
export function getSlotSources(before: ReadingSlotData[], after: ReadingSlotData[]) {
  const used = new Set<number>();
  const sources = after.map(slot => {
    const index = before.findIndex((previous, i) => previous === slot && !used.has(i));
    if (index >= 0) used.add(index);
    return index;
  });
  return sources.map((source, index) => {
    if (source >= 0 || index >= before.length || used.has(index)) return source;
    used.add(index);
    return index;
  });
}

export function remapEditorSlots(current: ReadingEditorSnapshot, cardSlots: ReadingSlotData[], sources = getSlotSources(current.cardSlots, cardSlots)): ReadingEditorSnapshot {
  const remapIndex = (index: number) => {
    if (index < 0) return -1;
    const mapped = sources.indexOf(index);
    return mapped >= 0 ? mapped : Math.max(0, Math.min(index, cardSlots.length - 1));
  };
  const cardInterpretations = sources.map(source => source < 0 ? '' : current.cardInterpretations[source] || '');
  return {
    ...current, cardSlots, cardInterpretations,
    cardQuestions: sources.map(source => source < 0 ? '' : current.cardQuestions[source] || ''),
    activeSlotIndex: remapIndex(current.activeSlotIndex),
    readingDetailSlotIndex: remapIndex(current.readingDetailSlotIndex),
    designActiveSlot: cardSlots.length ? remapIndex(current.designActiveSlot) : -1,
    singleCard: cardSlots.length === 1 ? cardInterpretations[0] || '' : current.singleCard,
  };
}

export function restoreEditorHistory(entry: ReadingEditorHistoryEntry, current: ReadingEditorSnapshot): ReadingEditorSnapshot {
  if (!Array.isArray(entry)) return entry;
  // A legacy entry has no writing snapshot. Recover only associations that
  // can be identified in the current draft, never borrow another card's note.
  const used = new Set<number>();
  const sources = entry.map(slot => {
    let source = current.cardSlots.findIndex((card, index) => !used.has(index) && JSON.stringify(card) === JSON.stringify(slot));
    if (source < 0) source = current.cardSlots.findIndex((card, index) => !used.has(index) && card.name === slot.name && card.label === slot.label);
    if (source >= 0) used.add(source);
    return source;
  });
  return remapEditorSlots(current, entry, sources);
}
