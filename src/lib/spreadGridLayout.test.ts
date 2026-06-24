import { describe, expect, it } from 'vitest';
import { ReadingSlotData } from '../types';
import {
  centerGridSlots,
  formatGridPosition,
  getCenteringDelta,
  getGridBounds,
  parseGridPosition,
  shiftGridSlots,
} from './spreadGridLayout';

const slots: ReadingSlotData[] = [
  { name: '', isReversed: false, position: 'col-start-1 row-start-1' },
  { name: '', isReversed: false, position: 'col-start-2 row-start-3' },
  { name: '', isReversed: false },
  { name: '', isReversed: false, position: 'free-position' },
];

describe('spreadGridLayout', () => {
  it('parses and formats grid positions', () => {
    expect(parseGridPosition('col-start-4 row-start-2')).toEqual({ col: 4, row: 2 });
    expect(parseGridPosition('free-position')).toBeNull();
    expect(formatGridPosition({ col: 3, row: 5 })).toBe('col-start-3 row-start-5');
  });

  it('shifts positioned slots and clamps to grid bounds', () => {
    expect(shiftGridSlots(slots, 2, -1, 3, 3)).toEqual([
      { name: '', isReversed: false, position: 'col-start-3 row-start-1' },
      { name: '', isReversed: false, position: 'col-start-3 row-start-2' },
      { name: '', isReversed: false },
      { name: '', isReversed: false, position: 'free-position' },
    ]);
  });

  it('computes bounds from positioned slots only', () => {
    expect(getGridBounds(slots)).toEqual({
      minCol: 1,
      maxCol: 2,
      minRow: 1,
      maxRow: 3,
    });
    expect(getGridBounds([{ name: '', isReversed: false }])).toBeNull();
  });

  it('computes the delta needed to center a spread', () => {
    expect(getCenteringDelta(slots, 5, 5)).toEqual({ dx: 1, dy: 1 });
  });

  it('centers grid slots without changing unpositioned slots', () => {
    expect(centerGridSlots(slots, 5, 5)).toEqual([
      { name: '', isReversed: false, position: 'col-start-2 row-start-2' },
      { name: '', isReversed: false, position: 'col-start-3 row-start-4' },
      { name: '', isReversed: false },
      { name: '', isReversed: false, position: 'free-position' },
    ]);
  });

  it('returns the same array when there is no valid position or centering is unnecessary', () => {
    const unpositioned = [{ name: '', isReversed: false }];
    const centered = [{ name: '', isReversed: false, position: 'col-start-3 row-start-3' }];

    expect(centerGridSlots(unpositioned, 5, 5)).toBe(unpositioned);
    expect(centerGridSlots(centered, 5, 5)).toBe(centered);
  });
});
