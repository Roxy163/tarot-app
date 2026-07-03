import { describe, expect, it } from 'vitest';
import { SpreadDefinition, TarotReading } from '../types';
import { mergeReadingsForSignedInUser, mergeSpreadSources } from './readingSessionMerge';

const createReading = (overrides: Partial<TarotReading>): TarotReading => ({
  id: 'reading-1',
  userId: 'anonymous',
  date: '2026-07-01T08:00:00.000Z',
  question: '问题',
  cards: [],
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  spread: '单牌阵',
  isPublic: false,
  isAnonymous: false,
  isForClient: false,
  authorName: '研习者',
  ...overrides,
});

describe('reading session merge', () => {
  it('merges cloud, signed-in cache, and guest readings without dropping local records', () => {
    const merged = mergeReadingsForSignedInUser('user-1', [
      [createReading({ id: 'cloud-reading', question: '云端记录' })],
      [createReading({ id: 'local-user-reading', question: '登录缓存记录' })],
      [createReading({ id: 'guest-reading', question: '访客本地记录' })],
    ]);

    expect(merged.map(reading => reading.id)).toEqual([
      'cloud-reading',
      'local-user-reading',
      'guest-reading',
    ]);
    expect(merged.every(reading => reading.userId === 'user-1')).toBe(true);
  });

  it('keeps the newest version when the same reading exists locally and in cloud', () => {
    const merged = mergeReadingsForSignedInUser('user-1', [
      [createReading({
        id: 'same-reading',
        question: '云端旧版本',
        updatedAt: '2026-07-01T08:00:00.000Z',
      })],
      [createReading({
        id: 'same-reading',
        question: '本地新版本',
        updatedAt: '2026-07-02T08:00:00.000Z',
      })],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'same-reading',
      question: '本地新版本',
      userId: 'user-1',
    });
  });

  it('preserves local custom spreads when cloud spreads already exist', () => {
    const officialSpreads: SpreadDefinition[] = [
      { name: '单牌阵', layout: 'horizontal', slots: ['主牌'] },
    ];
    const cloudSpread: SpreadDefinition = {
      name: '云端牌阵',
      layout: 'free',
      slots: ['一'],
    };
    const localSpread: SpreadDefinition = {
      name: '本地牌阵',
      layout: 'free',
      slots: ['一'],
    };

    const merged = mergeSpreadSources([[cloudSpread], [localSpread]], officialSpreads);

    expect(merged.map(spread => spread.name)).toEqual(['单牌阵', '云端牌阵', '本地牌阵']);
  });
});
