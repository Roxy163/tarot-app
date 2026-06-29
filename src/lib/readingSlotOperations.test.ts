import { describe, expect, it } from 'vitest';
import { ReadingSlotData } from '../types';
import {
  HISTORY_LIMIT,
  addReadingSlot,
  applyGridSlotPositionClick,
  appendSlotHistory,
  removeReadingSlot,
  selectCardForSlot,
  swapReadingSlots,
  toggleSlotReversal,
  updateReadingSlotLabel,
} from './readingSlotOperations';

const slots: ReadingSlotData[] = [
  { name: '愚者', isReversed: false, label: '一' },
  { name: '魔术师', isReversed: true, label: '二' },
];

describe('readingSlotOperations', () => {
  it('keeps only the latest history entries', () => {
    const history = Array.from({ length: HISTORY_LIMIT }, (_, index) => [
      { name: `牌 ${index}`, isReversed: false },
    ]);
    const nextHistory = appendSlotHistory(history, slots);

    expect(nextHistory).toHaveLength(HISTORY_LIMIT);
    expect(nextHistory[0]).toEqual([{ name: '牌 1', isReversed: false }]);
    expect(nextHistory.at(-1)).toBe(slots);
  });

  it('selects a card for an existing slot without mutating the original array', () => {
    const nextSlots = selectCardForSlot(slots, 1, '女祭司', false);

    expect(nextSlots).toEqual([
      { name: '愚者', isReversed: false, label: '一' },
      { name: '女祭司', isReversed: false, label: '二' },
    ]);
    expect(slots[1].name).toBe('魔术师');
  });

  it('returns the same array when selecting a missing slot', () => {
    expect(selectCardForSlot(slots, 9, '女祭司', false)).toBe(slots);
  });

  it('toggles reversal for an existing slot', () => {
    expect(toggleSlotReversal(slots, 0)[0].isReversed).toBe(true);
    expect(toggleSlotReversal(slots, 1)[1].isReversed).toBe(false);
  });

  it('adds a blank slot with the next default label', () => {
    expect(addReadingSlot(slots)).toEqual([
      ...slots,
      { name: '', isReversed: false, label: '第3张' },
    ]);
  });

  it('removes a slot but never removes the final remaining slot', () => {
    expect(removeReadingSlot(slots, 0)).toEqual([
      { name: '魔术师', isReversed: true, label: '二' },
    ]);
    expect(removeReadingSlot([slots[0]], 0)).toEqual([slots[0]]);
    expect(removeReadingSlot(slots, 8)).toBe(slots);
  });

  it('swaps slots only when both indexes are valid', () => {
    expect(swapReadingSlots(slots, 0, 1)).toEqual([slots[1], slots[0]]);
    expect(swapReadingSlots(slots, 0, 8)).toBe(slots);
    expect(swapReadingSlots(slots, 1, 1)).toBe(slots);
  });

  it('updates a slot label without mutating the original slot', () => {
    const nextSlots = updateReadingSlotLabel(slots, 0, '核心');

    expect(nextSlots[0].label).toBe('核心');
    expect(slots[0].label).toBe('一');
  });

  it('adds a positioned slot and marks horizontal layouts for custom conversion', () => {
    expect(applyGridSlotPositionClick([], -1, 3, 2, 'horizontal')).toEqual({
      slots: [{ name: '', isReversed: false, position: 'col-start-3 row-start-2', label: '牌 1' }],
      activeSlotIndex: 0,
      shouldConvertHorizontalLayout: true,
      changed: true,
    });
  });

  it('positions the first blank slot instead of adding another one', () => {
    const blankSlot: ReadingSlotData[] = [{ name: '', isReversed: false, label: '未命名' }];
    const result = applyGridSlotPositionClick(blankSlot, 0, 2, 2, 'custom');

    expect(result).toEqual({
      slots: [{ name: '', isReversed: false, label: '牌 1', position: 'col-start-2 row-start-2' }],
      activeSlotIndex: 0,
      shouldConvertHorizontalLayout: false,
      changed: true,
    });
    expect(blankSlot[0].position).toBeUndefined();
  });

  it('selects an existing slot at a clicked position without changing slots', () => {
    const positionedSlots = [
      { name: '', isReversed: false, label: '一', position: 'col-start-1 row-start-1' },
      { name: '', isReversed: false, label: '二', position: 'col-start-2 row-start-1' },
    ];
    const result = applyGridSlotPositionClick(positionedSlots, 0, 2, 1, 'custom');

    expect(result.slots).toBe(positionedSlots);
    expect(result.activeSlotIndex).toBe(1);
    expect(result.changed).toBe(false);
  });

  it('adds a stacked slot when clicking the active occupied position', () => {
    const positionedSlots = [
      { name: '', isReversed: false, label: '一', position: 'col-start-1 row-start-1' },
    ];

    expect(applyGridSlotPositionClick(positionedSlots, 0, 1, 1, 'custom')).toEqual({
      slots: [
        positionedSlots[0],
        { name: '', isReversed: false, position: 'col-start-1 row-start-1', label: '叠放牌 2' },
      ],
      activeSlotIndex: 1,
      shouldConvertHorizontalLayout: false,
      changed: true,
    });
  });

  it('cycles between stacked slots without changing the slot array', () => {
    const stackedSlots = [
      { name: '', isReversed: false, label: '一', position: 'col-start-1 row-start-1' },
      { name: '', isReversed: false, label: '二', position: 'col-start-1 row-start-1' },
    ];
    const result = applyGridSlotPositionClick(stackedSlots, 0, 1, 1, 'custom');

    expect(result.slots).toBe(stackedSlots);
    expect(result.activeSlotIndex).toBe(1);
    expect(result.changed).toBe(false);
  });
});
