import { describe, expect, it } from 'vitest';
import type { TarotReading } from '../types';
import {
  buildReadingArchiveIndex,
  getArchiveIndexReadings,
  readingMatchesArchiveIndexFilter,
} from './readingArchiveIndex';

const createReading = (overrides: Partial<TarotReading>): TarotReading => ({
  id: 'reading-1',
  userId: 'user-1',
  date: '2026-07-03T08:00:00.000Z',
  readingDate: '2026-07-03T08:00:00.000Z',
  question: '我该如何处理工作选择？',
  spread: '三牌阵',
  cards: [
    { name: '战车', isReversed: false },
    { name: '圣杯二', isReversed: true },
  ],
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  manualTags: [],
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
  ...overrides,
});

describe('readingArchiveIndex', () => {
  it('ignores examples when real readings exist', () => {
    const readings = [
      createReading({ id: 'example', question: '示例', isExample: true }),
      createReading({ id: 'real', question: '真实记录' }),
    ];

    expect(getArchiveIndexReadings(readings).map(reading => reading.id)).toEqual(['real']);
  });

  it('groups readings by card with upright, reversed and reviewed counts', () => {
    const index = buildReadingArchiveIndex([
      createReading({
        id: 'a',
        userFeedback: '已复盘',
        cards: [{ name: '战车', isReversed: false }],
        updatedAt: '2026-07-05T00:00:00.000Z',
      }),
      createReading({
        id: 'b',
        cards: [{ name: '战车', isReversed: true }],
        updatedAt: '2026-07-08T00:00:00.000Z',
      }),
    ]);

    expect(index.cards[0]).toMatchObject({
      cardName: '战车',
      count: 2,
      uprightCount: 1,
      reversedCount: 1,
      reviewedCount: 1,
    });
  });

  it('groups readings by spread and user-written tags only', () => {
    const index = buildReadingArchiveIndex([
      createReading({
        id: 'choice',
        spread: '选择牌阵',
        manualTags: ['工作', '选择'],
        keywords: ['AI生成词'],
        userFeedback: '已复盘',
      }),
      createReading({
        id: 'legacy-tag',
        spread: '选择牌阵',
        category: '工作、辞职',
        manualTags: [],
        keywords: ['AI主题词'],
      }),
    ]);

    expect(index.spreads[0]).toMatchObject({ spread: '选择牌阵', count: 2, reviewedCount: 1 });
    expect(index.tags.map(item => item.tag)).toEqual(expect.arrayContaining(['工作', '选择', '辞职']));
    expect(index.tags.map(item => item.tag)).not.toEqual(expect.arrayContaining(['AI生成词', 'AI主题词']));
  });

  it('matches filters by card, spread, tag and question text', () => {
    const reading = createReading({
      spread: '选择牌阵',
      manualTags: ['工作'],
      question: '三个月内要不要辞职？',
      cards: [{ name: '星币骑士', isReversed: true }],
    });

    expect(readingMatchesArchiveIndexFilter(reading, { type: 'card', value: '星币骑士', label: '' })).toBe(true);
    expect(readingMatchesArchiveIndexFilter(reading, { type: 'spread', value: '选择牌阵', label: '' })).toBe(true);
    expect(readingMatchesArchiveIndexFilter(reading, { type: 'tag', value: '工作', label: '' })).toBe(true);
    expect(readingMatchesArchiveIndexFilter(reading, { type: 'question', value: '辞职', label: '' })).toBe(true);
    expect(readingMatchesArchiveIndexFilter(reading, { type: 'card', value: '愚者', label: '' })).toBe(false);
  });
});
