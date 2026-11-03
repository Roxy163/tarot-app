import { describe, expect, it } from 'vitest';
import type { ReadingEditorSnapshot } from '../types';
import { appendEditorHistory, remapEditorSlots, restoreEditorHistory } from './readingEditorHistory';

const snapshot: ReadingEditorSnapshot = {
  cardSlots: [{ name: '太阳', label: '左侧', isReversed: false, x: -20, y: 40, rotation: 17, scale: 0.8 }, { name: '隐士', label: '右侧', isReversed: true, x: 190, y: 270, rotation: -12, scale: 1.2 }],
  cardInterpretations: ['太阳解读', '隐士解读'], cardQuestions: ['太阳疑问', '隐士疑问'],
  activeSlotIndex: 1, readingDetailSlotIndex: 0, designActiveSlot: 1,
  spread: '我的牌阵', layoutType: 'free', gridCols: 20, gridRows: 12, isEditingSession: true,
  newSpreadName: '未完成的新名字', freeLayoutSaveMode: 'adaptive', singleCard: '',
};

describe('reading editor undo associations', () => {
  it('moves notes, questions, and both active indices with their slots', () => {
    const next = remapEditorSlots(snapshot, [...snapshot.cardSlots].reverse(), [1, 0]);
    expect(next.cardInterpretations).toEqual(['隐士解读', '太阳解读']);
    expect(next.cardQuestions).toEqual(['隐士疑问', '太阳疑问']);
    expect([next.activeSlotIndex, next.readingDetailSlotIndex, next.designActiveSlot]).toEqual([0, 1, 0]);
    expect(next.cardSlots[0]).toEqual(snapshot.cardSlots[1]);
  });

  it('removes the deleted slot writing while keeping a new slot blank', () => {
    const remaining = remapEditorSlots(snapshot, [snapshot.cardSlots[1]]);
    expect(remaining.cardInterpretations).toEqual(['隐士解读']);
    expect(remaining.cardQuestions).toEqual(['隐士疑问']);
    expect(remaining.singleCard).toBe('隐士解读');
    const added = remapEditorSlots(snapshot, [...snapshot.cardSlots, { ...snapshot.cardSlots[1] }]);
    expect(added.cardInterpretations).toEqual(['太阳解读', '隐士解读', '']);
  });

  it('restores the entire snapshot without altering it, including name and saved geometry', () => {
    const history = appendEditorHistory([], snapshot);
    const before = JSON.stringify(snapshot);
    const modified = { ...snapshot, newSpreadName: '', cardSlots: [], cardInterpretations: [], cardQuestions: [] };
    expect(restoreEditorHistory(history[0], modified)).toEqual(snapshot);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('accepts a JSON-restored legacy slot-only history and matches existing writing by card', () => {
    const reordered = remapEditorSlots(snapshot, [...snapshot.cardSlots].reverse(), [1, 0]);
    const legacy = JSON.parse(JSON.stringify(snapshot.cardSlots));
    const restored = restoreEditorHistory(legacy, reordered);
    expect(restored.cardSlots).toEqual(snapshot.cardSlots);
    expect(restored.cardInterpretations).toEqual(snapshot.cardInterpretations);
    expect(restored.cardQuestions).toEqual(snapshot.cardQuestions);
  });
});
