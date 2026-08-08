import { describe, expect, it } from 'vitest';
import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import { parseGridPosition } from './spreadGridLayout';

describe('official spread definitions', () => {
  it('matches the requested cross spread labels and positions', () => {
    const crossSpread = OFFICIAL_SPREADS.find(spread => spread.name === '十字牌阵');

    expect(crossSpread?.slots).toEqual(['自身情况', '外在情况', '短期趋势', '阻碍挑战', '结果']);
    expect(crossSpread?.slotPositions).toEqual([
      'col-start-2 row-start-1',
      'col-start-2 row-start-3',
      'col-start-1 row-start-2',
      'col-start-3 row-start-2',
      'col-start-2 row-start-2',
    ]);
  });

  it('matches the choice spread labels and positions for two-option decisions', () => {
    const choiceSpread = OFFICIAL_SPREADS.find(spread => spread.name === '选择牌阵');

    expect(choiceSpread?.slots).toEqual([
      '现状',
      'A近期发展',
      'B近期发展',
      'A远期结果',
      'B远期结果',
    ]);
    expect(choiceSpread?.slotPositions).toEqual([
      'col-start-3 row-start-3',
      'col-start-2 row-start-2',
      'col-start-4 row-start-2',
      'col-start-1 row-start-1',
      'col-start-5 row-start-1',
    ]);
  });

  it('keeps official positions within their display template columns', () => {
    OFFICIAL_SPREADS.forEach(spread => {
      const template = LAYOUT_TEMPLATES[spread.layout];
      if (!template || !spread.slotPositions) return;

      const maxTemplateCol = Math.max(
        ...template.itemClasses
          .map(position => parseGridPosition(position)?.col || 0),
      );

      spread.slotPositions.forEach(position => {
        const parsed = parseGridPosition(position);
        expect(parsed, `${spread.name} has an invalid position: ${position}`).not.toBeNull();
        expect(parsed!.col, `${spread.name} position exceeds template columns: ${position}`).toBeLessThanOrEqual(maxTemplateCol);
        expect(parsed!.col).toBeGreaterThanOrEqual(1);
      });
    });
  });

  it('keeps dedicated official spread defaults aligned with their layout templates', () => {
    const dedicatedLayoutNames = new Set(['triangle', 'cross', 'choice', 'seasons', 'celtic', 'yearly']);

    OFFICIAL_SPREADS.forEach(spread => {
      const template = LAYOUT_TEMPLATES[spread.layout];
      if (!template || !dedicatedLayoutNames.has(spread.layout)) return;

      expect(spread.slots, `${spread.name} slot labels differ from template defaults`).toEqual(
        template.defaultSlots,
      );
      expect(spread.slotPositions, `${spread.name} positions differ from template defaults`).toEqual(
        template.itemClasses,
      );
    });
  });
});
