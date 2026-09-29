import { describe, expect, it } from 'vitest';
import { getOfficialTabletopLayout, getTabletopLayout } from './tabletopLayout';
import { OFFICIAL_SPREADS } from '../constants';

// User-approved geometry, 2026-09-30. Do not update this baseline merely to
// accommodate a refactor; changes require an explicit product decision.
// Coordinates are independent of production definitions to catch silent drift.
const approvedGeometry: Record<string, { card: number; unit: [number, number]; centers: number[][] }> = {
  '单牌阵': { card: 80, unit: [96, 164], centers: [[3, 2]] },
  '无牌阵三张': { card: 72, unit: [88, 150], centers: [[2, 2], [3, 2], [4, 2]] },
  '时间流牌阵': { card: 72, unit: [88, 150], centers: [[2, 2], [3, 2], [4, 2]] },
  '圣三角牌阵': { card: 72, unit: [88, 150], centers: [[3, 3], [2, 2], [4, 2]] },
  '选择牌阵': { card: 60, unit: [76, 129], centers: [[3, 3], [2, 2], [4, 2], [1, 1], [5, 1]] },
  '十字牌阵': { card: 60, unit: [76, 129], centers: [[2, 1], [2, 3], [1, 2], [3, 2], [2, 2]] },
  '四季牌阵': { card: 60, unit: [76, 129], centers: [[2, 2], [2, 1], [3, 2], [2, 3], [1, 2]] },
  '凯尔特十字牌阵': { card: 50, unit: [4.8, 4], centers: [[38, 50], [38, 50], [38, 78], [20, 50], [38, 22], [56, 50], [78, 88], [78, 63], [78, 38], [78, 13]] },
  '年运十二宫牌阵': { card: 50, unit: [4.8, 3.6], centers: [[7, 50], [19, 70], [34, 82], [50, 86], [66, 81], [81, 70], [93, 50], [81, 30], [66, 19], [50, 14], [34, 19], [19, 30], [50, 49]] },
};

describe('all official tabletop layouts', () => {
  const slotsFor = (spread: typeof OFFICIAL_SPREADS[number]) => spread.slots.map((label, index) => ({
    name: '', label, isReversed: false, position: spread.slotPositions[index],
  }));

  it('requires an approved baseline for every official spread, including new additions', () => {
    expect(OFFICIAL_SPREADS.map(s => s.name).sort()).toEqual(Object.keys(approvedGeometry).sort());
  });

  it.each(OFFICIAL_SPREADS)('$name retains the approved silhouette and card-to-gap proportions', spread => {
    const approved = approvedGeometry[spread.name];
    for (const [width, height] of [[275, 568], [345, 844], [780, 390], [960, 800]]) {
      const cloth = getOfficialTabletopLayout(spread.name, spread.layout, slotsFor(spread), width, height)!;
      expect(cloth.points).toHaveLength(approved.centers.length);
      approved.centers.forEach(([x, y], index) => {
        expect((cloth.points[index].x - cloth.points[0].x) / cloth.cardWidth)
          .toBeCloseTo((x - approved.centers[0][0]) * approved.unit[0] / approved.card, 5);
        expect((cloth.points[index].y - cloth.points[0].y) / cloth.cardWidth)
          .toBeCloseTo((y - approved.centers[0][1]) * approved.unit[1] / approved.card, 5);
      });
    }
  });

  it.each(OFFICIAL_SPREADS)('$name fits portrait, landscape and desktop without empty grid margins', spread => {
    for (const [width, height] of [[275, 568], [345, 844], [780, 390], [960, 800]]) {
      const cloth = getOfficialTabletopLayout(spread.name, spread.layout, slotsFor(spread), width, height)!;
      expect(cloth).not.toBeNull();
      expect(cloth.width).toBeLessThanOrEqual(width + 0.01);
      expect(cloth.height).toBeLessThanOrEqual(Math.min(380, height * 0.52) + 0.01);
      expect(cloth.cardWidth).toBeGreaterThan(0);
      expect(cloth.points).toHaveLength(spread.slots.length);
      const xs = cloth.points.map(p => p.x);
      const ys = cloth.points.map(p => p.y);
      expect(Math.min(...xs) - Math.max(44, cloth.cardWidth) / 2).toBeCloseTo(8);
      expect(cloth.width - Math.max(...xs) - Math.max(44, cloth.cardWidth) / 2).toBeCloseTo(8);
      expect(Math.min(...ys) - Math.max(56, cloth.cardHeight) / 2).toBeCloseTo(8);
      expect(cloth.height - Math.max(...ys) - Math.max(56, cloth.cardHeight) / 2).toBeCloseTo(28);
    }
  });

  it('does not reinterpret a custom or edited spread as an official layout', () => {
    const spread = OFFICIAL_SPREADS.find(s => s.name === '选择牌阵')!;
    const slots = slotsFor(spread);
    expect(getOfficialTabletopLayout('我的选择牌阵', spread.layout, slots, 320, 568)).toBeNull();
    expect(getOfficialTabletopLayout(spread.name, 'free', slots, 320, 568)).toBeNull();
    expect(getOfficialTabletopLayout(spread.name, spread.layout, slots.slice(1), 320, 568)).toBeNull();
    slots[0].position = 'col-start-1 row-start-4';
    expect(getOfficialTabletopLayout(spread.name, spread.layout, slots, 320, 568)).toBeNull();
  });
});

describe('official tabletop silhouette and page height', () => {
  for (const layout of ['celtic', 'yearly'] as const) {
    it.each([[275, 568], [320, 844], [390, 844], [600, 720], [900, 900]])(
      `${layout} keeps the complete cloth within %ipx and a %ipx screen`,
      (width, height) => {
        const cloth = getTabletopLayout(layout, width, height);
        expect(cloth.width).toBeLessThanOrEqual(width + 0.01);
        expect(cloth.height).toBeLessThanOrEqual(Math.min(380, height * 0.52) + 0.01);
        expect(cloth.cardWidth).toBeLessThanOrEqual(50);
        const cards = cloth.points.map((point, index) => {
          const rotated = layout === 'celtic' && index === 1;
          const w = rotated ? cloth.cardHeight : cloth.cardWidth;
          const h = rotated ? cloth.cardWidth : cloth.cardHeight;
          return { left: point.x - w / 2, right: point.x + w / 2, top: point.y - h / 2, bottom: point.y + h / 2 };
        });
        cards.forEach((card, index) => {
          expect(card.left).toBeGreaterThanOrEqual(0);
          expect(card.right).toBeLessThanOrEqual(cloth.width);
          expect(card.top).toBeGreaterThanOrEqual(0);
          expect(card.bottom + 20).toBeLessThanOrEqual(cloth.height + 0.001);
          cards.slice(index + 1).forEach((other, offset) => {
            if (layout === 'celtic' && index === 0 && offset === 0) return;
            const separated = card.right <= other.left || other.right <= card.left
              || card.bottom <= other.top || other.bottom <= card.top;
            expect(separated, `${layout} cards ${index + 1} and ${index + offset + 2} overlap`).toBe(true);
          });
        });
      },
    );

    it(`${layout} preserves every pair's direction and relative distance when resized`, () => {
      const original = getTabletopLayout(layout, 900, 1000);
      for (const [width, height] of [[275, 568], [600, 500], [390, 844]]) {
        const resized = getTabletopLayout(layout, width, height);
        const scale = resized.cardWidth / original.cardWidth;
        original.points.forEach((point, index) => {
          const dx = point.x - original.points[0].x;
          const dy = point.y - original.points[0].y;
          expect(resized.points[index].x - resized.points[0].x).toBeCloseTo(dx * scale);
          expect(resized.points[index].y - resized.points[0].y).toBeCloseTo(dy * scale);
        });
      }
    });
  }

  it('keeps the original broad yearly ring rather than flattening its top and bottom arcs', () => {
    const { points: p } = getTabletopLayout('yearly', 900, 900);
    const spanX = p[6].x - p[0].x;
    const spanY = p[3].y - p[9].y;
    expect(spanY / spanX).toBeCloseTo((72 * 0.75) / 86);
    expect((p[11].y - p[9].y) / spanY).toBeCloseTo(16 / 72);
    expect((p[1].x - p[0].x) / spanX).toBeCloseTo(12 / 86);
  });

  it('keeps the Celtic cross and staff in their original proportions', () => {
    const { points: p } = getTabletopLayout('celtic', 900, 900);
    expect(p[0]).toEqual(p[1]);
    const crossWidth = p[5].x - p[3].x;
    expect((p[2].y - p[4].y) / crossWidth).toBeCloseTo((56 * 400) / (36 * 480));
    expect((p[6].x - p[0].x) / crossWidth).toBeCloseTo(40 / 36);
    expect((p[8].y - p[9].y) / (p[6].y - p[9].y)).toBeCloseTo(1 / 3);
  });
});
