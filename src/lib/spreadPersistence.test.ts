import { describe, expect, it } from 'vitest';
import { ReadingSlotData, SpreadDefinition } from '../types';
import {
  createBlankSlotsForSpread,
  createSpreadDefinitionFromSlots,
  getSafeCustomSpreadName,
  mergeOfficialSpreadsWithCustom,
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
    expect(getSafeCustomSpreadName('单牌阵', '  单牌阵  ', officialSpreads)).toBe('单牌阵 (自定义)');
    expect(getSafeCustomSpreadName('', '  ', officialSpreads)).toBe('');
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

  it('leaves spreads untouched when asked to restore an unknown official spread', () => {
    const customSpread = { name: '私人牌阵', layout: 'custom', slots: ['一'] };
    const currentSpreads = [officialSpreads[0], customSpread];

    expect(restoreOfficialSpread(currentSpreads, officialSpreads, '不存在的牌阵')).toEqual({
      official: null,
      spreads: currentSpreads,
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

  it('always prefers current official definitions while preserving custom spreads', () => {
    const staleOfficial = {
      ...officialSpreads[0],
      slots: ['旧版本主牌'],
      slotPositions: ['old-position'],
    };
    const customSpread = {
      name: '私人牌阵',
      layout: 'free',
      slots: ['一', '二'],
      slotPositions: ['col-start-1 row-start-1', 'col-start-2 row-start-1'],
      freePositions: [
        { x: 20, y: 40, rotation: 10, scale: 1.1 },
        { x: 120, y: 140, rotation: -20, scale: 0.8 },
      ],
    };

    expect(mergeOfficialSpreadsWithCustom([staleOfficial, customSpread], officialSpreads)).toEqual([
      ...officialSpreads,
      customSpread,
    ]);
    expect(mergeOfficialSpreadsWithCustom(null, officialSpreads)).toEqual(officialSpreads);
  });

  it('ignores malformed saved spread entries instead of interrupting spread loading', () => {
    const customSpread: SpreadDefinition = {
      name: '有效自定义',
      layout: 'custom',
      slots: ['一'],
      slotPositions: ['col-start-1 row-start-1'],
    };

    expect(mergeOfficialSpreadsWithCustom([
      null,
      { name: '缺 layout', slots: ['一'] },
      { name: '缺 slots', layout: 'custom' },
      customSpread,
    ], officialSpreads)).toEqual([
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
