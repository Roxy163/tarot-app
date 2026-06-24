import { describe, expect, it } from 'vitest';
import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import { parseGridPosition } from './spreadGridLayout';

describe('official spread definitions', () => {
  it('keeps cross spread positions within its three-column display template', () => {
    const crossSpread = OFFICIAL_SPREADS.find(spread => spread.name === '十字牌阵');
    const template = LAYOUT_TEMPLATES.cross;

    expect(crossSpread).toBeDefined();
    const maxTemplateCol = Math.max(
      ...template.itemClasses
        .map(position => parseGridPosition(position)?.col || 0),
    );

    crossSpread?.slotPositions?.forEach(position => {
      const parsed = parseGridPosition(position);
      expect(parsed).not.toBeNull();
      expect(parsed!.col).toBeGreaterThanOrEqual(1);
      expect(parsed!.col).toBeLessThanOrEqual(maxTemplateCol);
    });
  });
});
