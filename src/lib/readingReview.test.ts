import { describe, expect, it } from 'vitest';
import { TarotReading } from '../types';
import {
  buildReadingReviewPdfLines,
  exportReadingsToCsv,
  exportReadingsToMarkdown,
  getReadingCardFrequencies,
  getReadingReviewStats,
} from './readingReview';

const createReading = (overrides: Partial<TarotReading>): TarotReading => ({
  id: 'reading-1',
  userId: 'user-1',
  date: '2026-07-03T08:00:00.000Z',
  readingDate: '2026-07-03T08:00:00.000Z',
  question: '我该如何看待这件事？',
  spread: '三牌阵',
  cards: [
    { name: '愚者', isReversed: false, label: '起点' },
    { name: '战车', isReversed: true, label: '阻碍' },
  ],
  interpretation: {
    singleCard: '先看见自己的冲动。',
    combination: '从开放到推进。',
    summary: '先行动，再修正。',
  },
  keywords: ['行动', '复盘'],
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
  userFeedback: '晚上回看，确实对应到一次新尝试。\n但需要慢一点。',
  ...overrides,
});

describe('reading review export', () => {
  it('builds stats and ignores example readings', () => {
    const stats = getReadingReviewStats([
      createReading({ id: 'reviewed' }),
      createReading({ id: 'unreviewed', userFeedback: '' }),
      createReading({ id: 'client', isForClient: true, clientName: '小林' }),
      createReading({ id: 'example', isExample: true }),
    ]);

    expect(stats).toMatchObject({
      totalCount: 3,
      reviewedCount: 2,
      unreviewedCount: 1,
      clientCount: 1,
      selfCount: 2,
    });
  });

  it('counts card frequency with upright and reversed directions', () => {
    const stats = getReadingCardFrequencies([
      createReading({ id: 'a' }),
      createReading({
        id: 'b',
        cards: [
          { name: '愚者', isReversed: true },
          { name: '女祭司', isReversed: false },
        ],
      }),
    ]);

    expect(stats[0]).toMatchObject({
      cardName: '愚者',
      count: 2,
      uprightCount: 1,
      reversedCount: 1,
    });
  });

  it('exports csv and markdown with line breaks preserved', () => {
    const reading = createReading({
      id: 'export-1',
      aiAnswer: 'AI建议先观察。\n再行动。',
      aiAnswerMode: 'mentor',
    });
    const csv = exportReadingsToCsv([reading]);
    const markdown = exportReadingsToMarkdown([reading], '典籍复盘记录', '阿若');

    expect(csv).toContain('"我的复盘"');
    expect(csv).toContain('"AI参照"');
    expect(csv).toContain('"AI建议先观察。\n再行动。"');
    expect(csv).toContain('"晚上回看，确实对应到一次新尝试。\n但需要慢一点。"');
    expect(csv).toContain('"起点：愚者（正位）\n阻碍：战车（逆位）"');
    expect(markdown).toContain('# 阿若的典籍复盘记录');
    expect(markdown).toContain('## 2026/07/03｜我该如何看待这件事？');
    expect(markdown).toContain('### AI参照');
    expect(markdown).toContain('AI建议先观察。');
    expect(markdown).toContain('晚上回看，确实对应到一次新尝试。');
  });

  it('builds pdf lines with owner name and review summary', () => {
    const lines = buildReadingReviewPdfLines([
      createReading({ id: 'pdf-1', aiAnswer: 'AI建议先观察。' }),
    ], '塔罗研习阁｜典籍复盘', '阿若');

    expect(lines[0].text).toBe('阿若的典籍复盘');
    expect(lines.some(line => line.text.includes('记录 1 条 · 已复盘 1 条'))).toBe(true);
    expect(lines.some(line => line.text.includes('AI参照：AI建议先观察。'))).toBe(true);
    expect(lines.some(line => line.text.includes('我的复盘：晚上回看'))).toBe(true);
  });
});
