import { describe, expect, it } from 'vitest';
import { ReadingSlotData, SpreadDefinition } from '../types';
import { mapSlotsToSpread, normalizeInterpretationsForSlots } from './readingSlotSync';
import { ensureFreeLayoutSlots } from './freeLayout';

const spreadDef: SpreadDefinition = {
  name: '测试牌阵',
  layout: 'custom',
  slots: ['过去', '现在', '未来'],
  slotPositions: ['col-start-1 row-start-1', 'col-start-2 row-start-1', 'col-start-3 row-start-1'],
  rotatedSlots: [1],
};

describe('readingSlotSync', () => {
  it('maps spread labels and positions while preserving picked cards by index', () => {
    const currentSlots: ReadingSlotData[] = [
      { name: '愚者', isReversed: true, label: '旧位置 A', position: 'old-a' },
      { name: '魔术师', isReversed: false, label: '旧位置 B', position: 'old-b' },
    ];

    expect(mapSlotsToSpread(currentSlots, spreadDef)).toEqual([
      {
        name: '愚者',
        isReversed: true,
        label: '过去',
        position: 'col-start-1 row-start-1',
        isRotated: false,
      },
      {
        name: '魔术师',
        isReversed: false,
        label: '现在',
        position: 'col-start-2 row-start-1',
        isRotated: true,
      },
      {
        name: '',
        isReversed: false,
        label: '未来',
        position: 'col-start-3 row-start-1',
        isRotated: false,
      },
    ]);
  });

  it('falls back to empty positions and unrotated slots when spread metadata is absent', () => {
    const simpleSpread: SpreadDefinition = {
      name: '简单牌阵',
      layout: 'horizontal',
      slots: ['主牌', '辅助'],
    };

    expect(mapSlotsToSpread([], simpleSpread)).toEqual([
      { name: '', isReversed: false, label: '主牌', position: '', isRotated: false },
      { name: '', isReversed: false, label: '辅助', position: '', isRotated: false },
    ]);
  });

  it('restores free layout coordinates when mapping to a saved custom spread', () => {
    const freeSpread: SpreadDefinition = {
      name: '自由牌阵',
      layout: 'free',
      slots: ['核心', '建议'],
      freePositions: [
        { x: 120, y: 80, rotation: 15, scale: 1.2 },
        { x: 260, y: 180, rotation: -30, scale: 0.9 },
      ],
    };

    expect(mapSlotsToSpread([{ name: '愚者', isReversed: true }], freeSpread)).toEqual([
      {
        name: '愚者',
        isReversed: true,
        label: '核心',
        position: '',
        isRotated: false,
        x: 120,
        y: 80,
        rotation: 15,
        scale: 1.2,
      },
      {
        name: '',
        isReversed: false,
        label: '建议',
        position: '',
        isRotated: false,
        x: 260,
        y: 180,
        rotation: -30,
        scale: 0.9,
      },
    ]);
  });

  it('can convert mapped grid slots into free layout slots', () => {
    const mappedSlots = mapSlotsToSpread([{ name: '愚者', isReversed: false }], spreadDef);
    const freeSlots = ensureFreeLayoutSlots(mappedSlots);

    expect(freeSlots).toHaveLength(3);
    expect(freeSlots[0].name).toBe('愚者');
    expect(freeSlots[0].position).toBe('');
    expect(freeSlots[0].x).toEqual(expect.any(Number));
    expect(freeSlots[0].y).toEqual(expect.any(Number));
    expect(freeSlots[0].rotation).toBe(0);
    expect(freeSlots[0].scale).toBe(1);
  });

  it('pads interpretations when the new spread has more slots', () => {
    expect(normalizeInterpretationsForSlots(['第一张'], 3)).toEqual(['第一张', '', '']);
  });

  it('trims interpretations when the new spread has fewer slots', () => {
    expect(normalizeInterpretationsForSlots(['一', '二', '三'], 2)).toEqual(['一', '二']);
  });
});
