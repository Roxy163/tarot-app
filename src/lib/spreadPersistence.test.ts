import { describe, expect, it } from 'vitest';
import { ReadingSlotData, SpreadDefinition } from '../types';
import {
  createBlankSlotsForSpread,
  createSpreadDefinitionFromSlots,
  getSafeCustomSpreadName,
  restoreAllOfficialSpreads,
  restoreOfficialSpread,
  upsertSpreadDefinition,
} from './spreadPersistence';

const officialSpreads: SpreadDefinition[] = [
  { name: '单牌阵', layout: 'horizontal', slots: ['主牌'], slotPositions: ['col-start-3 row-start-2'] },
  {
    name: '三牌阵',
    layout: 'custom',
    slots: ['过去', '现在', '未来'],
    slotPositions: ['a', 'b', 'c'],
    rotatedSlots: [1],
  },
];

describe('spreadPersistence', () => {
  it('uses a custom suffix when saving from an official spread name', () => {
    expect(getSafeCustomSpreadName('单牌阵', '', officialSpreads)).toBe('单牌阵 (自定义)');
    expect(getSafeCustomSpreadName('单牌阵', '三牌阵', officialSpreads)).toBe('三牌阵 (自定义)');
    expect(getSafeCustomSpreadName('自定义牌阵', '', officialSpreads)).toBe('自定义牌阵');
  });

  it('creates a spread definition from slot labels, positions, rotation and free layout data', () => {
    const slots: ReadingSlotData[] = [
      { name: '愚者', isReversed: false, label: '核心', position: 'p1', isRotated: true, x: 12, y: 24, rotation: 15, scale: 1.1 },
      { name: '魔术师', isReversed: true, position: 'p2' },
    ];

    expect(createSpreadDefinitionFromSlots({
      name: '我的牌阵',
      layout: 'free',
      slots,
      gridCols: 7,
      gridRows: 6,
    })).toEqual({
      name: '我的牌阵',
      layout: 'free',
      slots: ['核心', '第2张'],
      slotPositions: ['p1', 'p2'],
      rotatedSlots: [0],
      gridCols: 7,
      gridRows: 6,
      freePositions: [
        { x: 12, y: 24, rotation: 15, scale: 1.1 },
        { x: undefined, y: undefined, rotation: undefined, scale: undefined },
      ],
    });
  });

  it('replaces an existing spread or appends a new one', () => {
    const replacement = { ...officialSpreads[0], slots: ['替换'] };
    expect(upsertSpreadDefinition(officialSpreads, replacement)).toEqual([
      replacement,
      officialSpreads[1],
    ]);

    const custom = { name: '新牌阵', layout: 'custom', slots: ['一'] };
    expect(upsertSpreadDefinition(officialSpreads, custom)).toEqual([
      ...officialSpreads,
      custom,
    ]);
  });

  it('restores one official spread without removing custom spreads', () => {
    const customOfficial = { ...officialSpreads[0], slots: ['被改坏的主牌'] };
    const customSpread = { name: '私人牌阵', layout: 'custom', slots: ['一'] };

    expect(restoreOfficialSpread([customOfficial, customSpread], officialSpreads, '单牌阵')).toEqual({
      official: officialSpreads[0],
      spreads: [officialSpreads[0], customSpread],
    });
  });

  it('restores all official spreads and preserves custom spreads', () => {
    const changedOfficial = { ...officialSpreads[1], slots: ['被改过'] };
    const customSpread = { name: '私人牌阵', layout: 'custom', slots: ['一'] };

    expect(restoreAllOfficialSpreads([changedOfficial, customSpread], officialSpreads)).toEqual([
      ...officialSpreads,
      customSpread,
    ]);
  });

  it('creates blank slots from an official spread definition', () => {
    expect(createBlankSlotsForSpread(officialSpreads[1])).toEqual([
      { name: '', isReversed: false, label: '过去', position: 'a', isRotated: false },
      { name: '', isReversed: false, label: '现在', position: 'b', isRotated: true },
      { name: '', isReversed: false, label: '未来', position: 'c', isRotated: false },
    ]);
  });
});
