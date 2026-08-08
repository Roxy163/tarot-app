import { describe, expect, it } from 'vitest';
import { CardKeywordMemory, QuizMemoryEntry, SpreadDefinition, TarotCardMetadata, TarotReading } from '../types';
import {
  mergeCardMetadataSources,
  mergeKeywordMemorySources,
  mergeQuizMemorySources,
  mergeReadingsForSignedInUser,
  mergeSpreadSources,
} from './readingSessionMerge';

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

  it('merges cloud and local card metadata instead of choosing only one side', () => {
    const cloudMetadata: TarotCardMetadata[] = [{
      id: 'ar02',
      name: '女祭司',
      english: 'The High Priestess',
      astrology: { planet: '月亮' },
      keywords: ['直觉'],
      meaning: '云端正位',
    }];
    const localMetadata: TarotCardMetadata[] = [{
      id: 'ar02',
      name: '女祭司',
      english: 'The High Priestess',
      astrology: { zodiac: '巨蟹座' },
      keywords: ['秘密', '直觉'],
      reversedMeaning: '本地逆位',
    }];

    const merged = mergeCardMetadataSources([cloudMetadata, localMetadata]);

    expect(merged).toEqual([expect.objectContaining({
      id: 'ar02',
      meaning: '云端正位',
      reversedMeaning: '本地逆位',
      astrology: {
        planet: '月亮',
        zodiac: '巨蟹座',
      },
      keywords: ['直觉', '秘密'],
    })]);
  });

  it('merges cloud and local keyword memory for the same card', () => {
    const cloudMemory: CardKeywordMemory[] = [{
      cardName: '女祭司',
      updatedAt: '2026-07-01T08:00:00.000Z',
      keywords: [{
        keyword: '直觉',
        count: 1,
        readingIds: ['cloud-reading'],
        examples: ['云端例子'],
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T08:00:00.000Z',
      }],
    }];
    const localMemory: CardKeywordMemory[] = [{
      cardName: '女祭司',
      updatedAt: '2026-07-02T08:00:00.000Z',
      keywords: [{
        keyword: '直觉',
        count: 1,
        readingIds: ['local-reading'],
        examples: ['本地例子'],
        createdAt: '2026-07-02T08:00:00.000Z',
        updatedAt: '2026-07-02T08:00:00.000Z',
      }],
    }];

    const merged = mergeKeywordMemorySources([cloudMemory, localMemory]);

    expect(merged).toEqual([{
      cardName: '女祭司',
      updatedAt: '2026-07-02T08:00:00.000Z',
      keywords: [expect.objectContaining({
        keyword: '直觉',
        count: 2,
        readingIds: ['cloud-reading', 'local-reading'],
        examples: ['云端例子', '本地例子'],
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-02T08:00:00.000Z',
      })],
    }]);
  });

  it('skips incomplete legacy keyword entries while keeping valid memory', () => {
    const merged = mergeKeywordMemorySources([[
      {
        cardName: '女祭司',
        updatedAt: '2026-07-02T08:00:00.000Z',
        keywords: [
          { count: 1, readingIds: ['legacy-reading'], examples: [] },
          {
            keyword: '静默',
            count: 1,
            readingIds: undefined,
            examples: undefined,
            createdAt: '2026-07-02T08:00:00.000Z',
            updatedAt: '2026-07-02T08:00:00.000Z',
          },
        ],
      } as unknown as CardKeywordMemory,
    ]]);

    expect(merged).toEqual([{
      cardName: '女祭司',
      updatedAt: '2026-07-02T08:00:00.000Z',
      keywords: [expect.objectContaining({
        keyword: '静默',
        readingIds: [],
        examples: [],
      })],
    }]);
  });

  it('merges quiz attempt history from cloud and local memory', () => {
    const cloudMemory: QuizMemoryEntry = {
      cardId: 'ar00',
      cardName: '愚者',
      practiceCount: 1,
      unfamiliarCount: 0,
      wrongCount: 1,
      repeated: true,
      lastPracticedAt: '2026-07-18T08:00:00.000Z',
      createdAt: '2026-07-18T08:00:00.000Z',
      updatedAt: '2026-07-18T08:00:00.000Z',
      attempts: [{
        id: 'cloud-attempt',
        modeLabel: '看牌对应',
        prompt: '这张牌对应哪个元素？',
        answerLabel: '风',
        selectedLabel: '水',
        correct: false,
        createdAt: '2026-07-18T08:00:00.000Z',
      }],
    };
    const localMemory: QuizMemoryEntry = {
      ...cloudMemory,
      practiceCount: 2,
      wrongCount: 1,
      repeated: false,
      updatedAt: '2026-07-18T09:00:00.000Z',
      attempts: [{
        id: 'local-attempt',
        modeLabel: '文字找牌',
        prompt: '这段含义，更接近哪张牌？',
        answerLabel: '愚者',
        selectedLabel: '魔术师',
        correct: false,
        createdAt: '2026-07-18T09:00:00.000Z',
      }],
    };

    const merged = mergeQuizMemorySources([[cloudMemory], [localMemory]]);

    expect(merged[0].attempts?.map(attempt => attempt.id)).toEqual(['local-attempt', 'cloud-attempt']);
    expect(merged[0]).toMatchObject({
      practiceCount: 2,
      wrongCount: 1,
      repeated: false,
    });
  });
});
