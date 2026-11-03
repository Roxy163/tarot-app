import { describe, expect, it } from 'vitest';
import { OFFICIAL_SPREADS } from '../constants';
import type { TarotReading } from '../types';
import { getReadingReviewLayout } from './readingReviewLayout';
import { getOfficialTabletopLayout } from './tabletopLayout';

const base: TarotReading = { id: 'review', userId: 'guest', date: '2026-11-03', question: '复盘', spread: '', cards: [], interpretation: { singleCard: '', combination: '', summary: '' }, keywords: [], isPublic: false, isAnonymous: false, authorName: '测试' };
describe('saved reading geometry', () => {
  it.each(OFFICIAL_SPREADS)('$name reuses the confirmed tabletop geometry in four viewports', spread => {
    const reading = { ...base, spread: spread.name, layoutType: spread.layout, cards: spread.slots.map((label, index) => ({ name: '隐士', isReversed: index % 2 === 0, label, position: spread.slotPositions[index], isRotated: spread.rotatedSlots?.includes(index) || false })) };
    const before = JSON.stringify(reading);
    for (const [width, height] of [[288, 568], [358, 844], [812, 390], [848, 800]]) {
      const result = getReadingReviewLayout(reading, width, height);
      const expected = getOfficialTabletopLayout(spread.name, spread.layout, reading.cards, width, height)!;
      expect(result.official).toBe(true);
      expect(result.width).toBe(expected.width);
      expect(result.height).toBe(expected.height);
      result.cards.forEach((card, index) => {
        expect([card.x, card.y, card.width]).toEqual([expected.points[index].x, expected.points[index].y, expected.cardWidth]);
      });
    }
    expect(JSON.stringify(reading)).toBe(before);
  });

  it('does not replace saved positions or a legacy free layout with an official template', () => {
    const reading = { ...base, spread: '时间流牌阵', slotPositions: ['col-start-1 row-start-1', 'col-start-5 row-start-3', 'col-start-3 row-start-4'], cards: [0, 1, 2].map(() => ({ name: '太阳', isReversed: false })) };
    const layout = getReadingReviewLayout(reading, 288, 568);
    expect(layout.official).toBe(false);
    expect(layout.cards[1].x - layout.cards[0].x).toBeCloseTo(2 * (layout.cards[2].x - layout.cards[0].x));
    const free = getReadingReviewLayout({ ...reading, cards: reading.cards.map((card, index) => ({ ...card, x: index * 100, y: index * 60 })) }, 288, 568);
    expect(free.official).toBe(false);
    expect(free.cards[1].y - free.cards[0].y).toBeCloseTo(free.cards[2].y - free.cards[1].y);
  });

  it('recognizes the legacy Celtic layout name without changing an edited layout', () => {
    const spread = OFFICIAL_SPREADS.find(item => item.layout === 'celtic')!;
    const reading = { ...base, spread: spread.name, layoutType: 'celtic-cross', cards: spread.slots.map(() => ({ name: '隐士', isReversed: false })) };
    expect(getReadingReviewLayout(reading, 288, 568).official).toBe(true);
    expect(getReadingReviewLayout({ ...reading, slotPositions: ['col-start-7 row-start-7'] }, 288, 568).official).toBe(false);
  });

  it('fits rotated/scaled cards and negative coordinates without changing centers, order or overlap', () => {
    const reading = { ...base, layoutType: 'free', cards: [
      { name: '太阳', isReversed: false, x: -420, y: -240, rotation: 45, scale: 1.8 },
      { name: '隐士', isReversed: true, x: -420, y: -240, rotation: -30, scale: 0.7 },
      { name: '力量', isReversed: false, x: 300, y: 190, rotation: 90, scale: 2 },
    ] };
    const before = JSON.stringify(reading);
    for (const [width, height] of [[288, 568], [358, 844], [812, 390], [848, 800]]) {
      const result = getReadingReviewLayout(reading, width, height);
      expect(result.width).toBeLessThanOrEqual(width);
      expect(result.height).toBeLessThanOrEqual(Math.min(380, height * 0.52));
      expect(result.cards[0].x).toBe(result.cards[1].x);
      expect(result.cards[0].y).toBe(result.cards[1].y);
      result.cards.forEach(card => {
        const angle = card.rotation * Math.PI / 180;
        const halfWidth = (Math.abs(Math.cos(angle) * card.width) + Math.abs(Math.sin(angle) * card.height)) / 2;
        const halfHeight = (Math.abs(Math.sin(angle) * card.width) + Math.abs(Math.cos(angle) * card.height)) / 2;
        expect(card.x - halfWidth).toBeGreaterThanOrEqual(0);
        expect(card.x + halfWidth).toBeLessThanOrEqual(result.width);
        expect(card.y - halfHeight).toBeGreaterThanOrEqual(0);
        expect(card.y + halfHeight).toBeLessThanOrEqual(result.height);
      });
    }
    expect(JSON.stringify(reading)).toBe(before);
  });
});
