import { describe, expect, it, vi } from 'vitest';
import { DailyFortune } from '../types';
import {
  buildDailyFortunePdfLines,
  exportDailyFortunesToCsv,
  exportDailyFortunesToMarkdown,
  getDailyFortuneMonthlyCardStats,
  getDailyFortunesByCard,
} from './dailyFortuneReview';

const fortune = (overrides: Partial<DailyFortune>): DailyFortune => ({
  id: overrides.id || 'fortune-1',
  userId: 'local',
  date: overrides.date || '2026-07-01',
  cardName: overrides.cardName || '女祭司',
  isReversed: overrides.isReversed || false,
  interpretation: overrides.interpretation || '信任你的直觉。',
  keywords: overrides.keywords || ['女祭司', overrides.isReversed ? '逆位' : '正位'],
  source: overrides.source || 'app-draw',
  createdAt: overrides.createdAt || `${overrides.date || '2026-07-01'}T08:00:00.000Z`,
  ...overrides,
});

describe('daily fortune review helpers', () => {
  it('groups daily fortunes by card with monthly and direction counts', () => {
    const groups = getDailyFortunesByCard([
      fortune({ id: 'a', date: '2026-07-01', cardName: '女祭司' }),
      fortune({ id: 'b', date: '2026-07-02', cardName: '女祭司', isReversed: true, savedToCardAnnotationAt: '2026-07-02T21:00:00.000Z' }),
      fortune({ id: 'c', date: '2026-06-30', cardName: '愚者' }),
    ], '2026-07');

    expect(groups[0]).toMatchObject({
      cardName: '女祭司',
      totalCount: 2,
      currentMonthCount: 2,
      savedToAnnotationCount: 1,
      uprightCount: 1,
      reversedCount: 1,
    });
  });

  it('calculates current month card frequencies and reversed counts', () => {
    const stats = getDailyFortuneMonthlyCardStats([
      fortune({ id: 'a', date: '2026-07-01', cardName: '女祭司' }),
      fortune({ id: 'b', date: '2026-07-02', cardName: '女祭司', isReversed: true }),
      fortune({ id: 'c', date: '2026-06-30', cardName: '女祭司' }),
      fortune({ id: 'd', date: '2026-07-03', cardName: '愚者' }),
    ], '2026-07');

    expect(stats).toEqual([
      { cardName: '女祭司', count: 2, uprightCount: 1, reversedCount: 1 },
      { cardName: '愚者', count: 1, uprightCount: 1, reversedCount: 0 },
    ]);
  });

  it('exports markdown and csv while preserving split reflections and line breaks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T08:00:00.000Z'));

    const records = [
      fortune({
        id: 'a',
        date: '2026-07-02',
        cardName: '女祭司',
        initialImpression: '先停下来\n观察。',
        dailyReview: '晚上对应到一次判断。',
        reflection: '第一直觉：先停下来\n观察。\n\n今日回看：晚上对应到一次判断。',
        savedToCardAnnotationAt: '2026-07-02T22:00:00.000Z',
      }),
      fortune({
        id: 'legacy',
        date: '2026-07-01',
        cardName: '愚者',
        reflection: '旧记录只有一段复盘。',
      }),
    ];

    const markdown = exportDailyFortunesToMarkdown(records, '测试日运');
    const csv = exportDailyFortunesToCsv(records);

    expect(markdown).toContain('# 测试日运');
    expect(markdown).toContain('## 2026-07-02｜女祭司（正位）');
    expect(markdown).toContain('先停下来\n观察。');
    expect(markdown).toContain('旧记录只有一段复盘。');
    expect(csv).toContain('"第一直觉"');
    expect(csv).toContain('"先停下来\n观察。"');
    expect(csv).toContain('"旧记录只有一段复盘。"');

    vi.useRealTimers();
  });

  it('builds daily fortune pdf lines with the owner name for belonging', () => {
    const lines = buildDailyFortunePdfLines([
      fortune({
        id: 'a',
        date: '2026-07-02',
        cardName: '女祭司',
        initialImpression: '先停下来观察。',
      }),
    ], '塔罗研习阁｜日运复盘', '阿若');

    expect(lines[0].text).toBe('阿若的日运复盘');
    expect(lines.some(line => line.text === '阁主：阿若')).toBe(true);
  });

  it('uses apprentice pavilion owner as the default pdf owner name for guests', () => {
    const lines = buildDailyFortunePdfLines([]);

    expect(lines[0].text).toBe('见习阁主的日运复盘');
    expect(lines.some(line => line.text === '阁主：见习阁主')).toBe(true);
  });
});
