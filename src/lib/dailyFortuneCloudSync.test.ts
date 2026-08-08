import { describe, expect, it } from 'vitest';
import { DailyFortune } from '../types';
import { mergeDailyFortuneSources } from './dailyFortuneCloudSync';

const fortune = (overrides: Partial<DailyFortune>): DailyFortune => ({
  id: 'fortune-1',
  userId: 'local',
  date: '2026-07-17',
  cardName: '愚者',
  isReversed: false,
  interpretation: '今天是充满可能性的一天。',
  keywords: ['愚者', '正位'],
  createdAt: '2026-07-17T08:00:00.000Z',
  updatedAt: '2026-07-17T08:00:00.000Z',
  isRevealed: true,
  ...overrides,
});

describe('dailyFortuneCloudSync', () => {
  it('keeps the newest record for the same date and scopes it to the signed-in user', () => {
    const merged = mergeDailyFortuneSources('user-1', [
      [fortune({ cardName: '愚者', updatedAt: '2026-07-17T08:00:00.000Z' })],
      [fortune({ id: 'fortune-local', cardName: '皇帝', updatedAt: '2026-07-17T20:00:00.000Z' })],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      userId: 'user-1',
      cardName: '皇帝',
    });
  });

  it('preserves filled reflection fields from the older side when the newer side lacks them', () => {
    const merged = mergeDailyFortuneSources('user-1', [
      [fortune({
        initialImpression: '第一眼觉得要慢下来',
        dailyReview: '晚上对应到一次真实沟通',
        reflection: '第一直觉：第一眼觉得要慢下来\n\n今日回看：晚上对应到一次真实沟通',
        updatedAt: '2026-07-17T12:00:00.000Z',
      })],
      [fortune({
        id: 'fortune-local',
        cardName: '皇帝',
        initialImpression: undefined,
        dailyReview: undefined,
        reflection: undefined,
        updatedAt: '2026-07-17T20:00:00.000Z',
      })],
    ]);

    expect(merged[0]).toMatchObject({
      cardName: '皇帝',
      initialImpression: '第一眼觉得要慢下来',
      dailyReview: '晚上对应到一次真实沟通',
      reflection: '第一直觉：第一眼觉得要慢下来\n\n今日回看：晚上对应到一次真实沟通',
    });
  });
});
