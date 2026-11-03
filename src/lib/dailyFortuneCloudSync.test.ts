import { describe, expect, it } from 'vitest';
import { DailyFortune } from '../types';
import { markDailyFortuneDeleted, mergeDailyFortuneSources } from './dailyFortuneCloudSync';

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

  it('never revives a deleted identity from a stale device even when that device edits later', () => {
    const deleted = markDailyFortuneDeleted(fortune({ reflection: '不保留的文字' }), '2026-07-17T12:00:00Z');
    const merged = mergeDailyFortuneSources('user-1', [
      [deleted], [fortune({ reflection: '旧设备又编辑', updatedAt: '2026-07-18T12:00:00Z' })],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ deletedAt: '2026-07-17T12:00:00Z', userId: 'user-1' });
    expect(merged[0].reflection).toBeUndefined();
  });

  it('keeps a deleted annotation example alongside a new draw on the same date', () => {
    const deleted = markDailyFortuneDeleted(fortune({
      savedToCardAnnotationAt: '2026-07-17T10:00:00Z', dailyReview: '值得留下的经历', cardAnnotationNote: '归入的完整例证',
    }), '2026-07-17T12:00:00Z');
    const merged = mergeDailyFortuneSources('user-1', [[deleted], [fortune({
      id: 'new-draw', cardName: '皇帝', createdAt: '2026-07-17T13:00:00Z', updatedAt: '2026-07-17T13:00:00Z',
    })]]);
    expect(merged).toHaveLength(2);
    expect(merged.find(item => item.id === 'fortune-1')).toMatchObject({ dailyReview: '值得留下的经历', cardAnnotationNote: '归入的完整例证', deletedAt: '2026-07-17T12:00:00Z' });
    expect(merged.find(item => item.id === 'new-draw')?.deletedAt).toBeUndefined();
  });

  it('does not restore an older duplicate of the deleted day with another legacy identity', () => {
    const deleted = markDailyFortuneDeleted(fortune({}), '2026-07-17T12:00:00Z');
    const merged = mergeDailyFortuneSources('user-1', [[deleted], [fortune({ id: 'old-cloud-id' })]]);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBeDefined();
  });

  it('does not revive a legacy identity created before deletion even if a stale device edits it afterward', () => {
    const deleted = markDailyFortuneDeleted(fortune({
      savedToCardAnnotationAt: '2026-07-17T10:00:00Z', dailyReview: '删除日运后保留的例证原文',
    }), '2026-07-17T12:00:00Z');
    const editedDuplicate = fortune({
      id: 'other-device-legacy-id', createdAt: '2026-07-17T08:30:00Z',
      updatedAt: '2026-07-18T13:00:00Z', dailyReview: '旧设备删除之后才提交的修改',
    });
    for (const sources of [[[deleted], [editedDuplicate]], [[editedDuplicate], [deleted]]]) {
      const merged = mergeDailyFortuneSources('user-1', sources);
      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({ id: deleted.id, deletedAt: deleted.deletedAt, dailyReview: '删除日运后保留的例证原文' });
    }
  });

  it('keeps a genuine new draw created after the day’s deletion beside its retained example', () => {
    const deleted = markDailyFortuneDeleted(fortune({ savedToCardAnnotationAt: '2026-07-17T10:00:00Z' }), '2026-07-17T12:00:00Z');
    const redraw = fortune({
      id: 'new-after-deletion', cardName: '皇帝', createdAt: '2026-07-17T12:00:01Z', updatedAt: '2026-07-17T13:00:00Z',
      dailyReview: '新抽牌自己的回看',
    });
    const stale = fortune({ id: 'legacy-other-id', updatedAt: '2026-07-18T14:00:00Z' });
    const merged = mergeDailyFortuneSources('user-1', [[redraw, stale], [deleted]]);
    expect(merged).toHaveLength(2);
    expect(merged.find(item => item.id === redraw.id)).toMatchObject({ cardName: '皇帝', dailyReview: '新抽牌自己的回看' });
    expect(merged.find(item => item.id === redraw.id)?.deletedAt).toBeUndefined();
    expect(merged.find(item => item.id === deleted.id)?.savedToCardAnnotationAt).toBe(deleted.savedToCardAnnotationAt);
  });
});
