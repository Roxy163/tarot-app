import { describe, expect, it } from 'vitest';
import type { ReadingSpreadSnapshot } from '../types';
import { buildSpreadSwitch, countRemovedSpreadContent, spreadSnapshotContent } from './readingSpreadSwitch';

const snapshot: ReadingSpreadSnapshot = {
  question: '保留自由摆牌', category: '记录', spread: '我的布局', layoutType: 'free',
  cardSlots: [{ name: '愚者', isReversed: false, x: -120, y: 40, rotation: 17, scale: 0.8 }, { name: '隐士', isReversed: true, x: 190, y: 270 }],
  cardInterpretations: ['第一张的文字', '第二张的文字'], cardQuestions: ['', '第二张的问题'], history: [],
  activeSlotIndex: 1, readingDetailSlotIndex: 1, gridCols: 7, gridRows: 8, isEditingSession: true,
};
describe('spread switching snapshots', () => {
  it('counts only removed positions with content and preserves the original full snapshot without mutations', () => {
    const before = structuredClone(snapshot);
    const target = { name: '单牌阵', layout: 'single', slots: ['主牌'] };
    expect(countRemovedSpreadContent(snapshot, target)).toBe(1);
    const after = buildSpreadSwitch(snapshot, target, '日运');
    expect(after.cardSlots).toHaveLength(1);
    expect(after.cardInterpretations).toEqual(['第一张的文字']);
    expect(snapshot).toEqual(before);
    expect(before.cardSlots[0]).toMatchObject({ x: -120, rotation: 17, scale: 0.8 });
    expect(before.cardQuestions[1]).toBe('第二张的问题');
  });
  it('ignores focus changes but detects edits before overwriting with undo', () => {
    expect(spreadSnapshotContent({ ...snapshot, activeSlotIndex: 0 })).toBe(spreadSnapshotContent(snapshot));
    expect(spreadSnapshotContent({ ...snapshot, cardInterpretations: ['新内容'] })).not.toBe(spreadSnapshotContent(snapshot));
    expect(countRemovedSpreadContent({ ...snapshot, cardSlots: [], cardInterpretations: [], cardQuestions: ['', '只写问题'] }, { name: '单牌阵', layout: 'single', slots: ['主牌'] })).toBe(1);
  });
});
