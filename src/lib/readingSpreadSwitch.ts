import type { ReadingSpreadSnapshot, SpreadDefinition } from '../types';
import { ensureFreeLayoutSlots } from './freeLayout';
import { mapSlotsToSpread } from './readingSlotSync';

export function countRemovedSpreadContent(current: ReadingSpreadSnapshot, spread: SpreadDefinition) {
  const length = Math.max(current.cardSlots.length, current.cardInterpretations.length, current.cardQuestions.length);
  return Array.from({ length }, (_, index) => index).filter(index => index >= spread.slots.length && (
    current.cardSlots[index]?.name?.trim() || current.cardInterpretations[index]?.trim() || current.cardQuestions[index]?.trim()
  )).length;
}

export function buildSpreadSwitch(current: ReadingSpreadSnapshot, spread: SpreadDefinition, category?: string): ReadingSpreadSnapshot {
  const slots = mapSlotsToSpread(current.cardSlots, spread);
  const cardSlots = spread.layout === 'free' ? ensureFreeLayoutSlots(slots) : slots;
  return {
    ...current, spread: spread.name, layoutType: spread.layout,
    category: category || current.category,
    question: category === '日运' && !current.question.trim() ? '今日抽牌记录' : current.question,
    cardSlots,
    cardInterpretations: cardSlots.map((_, index) => current.cardInterpretations[index] || ''),
    cardQuestions: cardSlots.map((_, index) => current.cardQuestions[index] || ''),
    activeSlotIndex: 0, readingDetailSlotIndex: Math.max(0, cardSlots.findIndex(slot => slot.name.trim())),
    gridCols: spread.gridCols || 5, gridRows: spread.gridRows || 5, isEditingSession: false,
  };
}

export function spreadSnapshotContent(snapshot: ReadingSpreadSnapshot) {
  const { activeSlotIndex: _active, readingDetailSlotIndex: _detail, history: _history, ...content } = snapshot;
  return JSON.stringify(content);
}
