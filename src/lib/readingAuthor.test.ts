import { describe, expect, it } from 'vitest';
import { TarotReading } from '../types';
import { getAuthorDisplayName, syncReadingAuthorName } from './readingAuthor';

const createReading = (overrides: Partial<TarotReading>): TarotReading => ({
  id: overrides.id || 'reading-1',
  userId: 'user-1',
  date: '2026-07-01T08:00:00.000Z',
  question: '问题',
  cards: [],
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  spread: '单牌阵',
  isPublic: false,
  isAnonymous: false,
  authorName: '旧名字',
  ...overrides,
});

describe('reading author helpers', () => {
  it('uses profile names before falling back to email', () => {
    expect(getAuthorDisplayName({ display_name: 'Roxy' }, { email: 'mail@example.com' })).toBe('Roxy');
    expect(getAuthorDisplayName({ nickname: '旧昵称' }, { email: 'mail@example.com' })).toBe('旧昵称');
    expect(getAuthorDisplayName(null, { email: 'reader@example.com' })).toBe('reader');
  });

  it('syncs existing signed-in readings after the display name changes', () => {
    const readings = [
      createReading({ id: 'own-public', isPublic: true }),
      createReading({ id: 'own-anonymous', isAnonymous: true, authorName: '匿名研习者' }),
      createReading({ id: 'other-user', userId: 'user-2' }),
      createReading({ id: 'example', isExample: true }),
    ];

    const result = syncReadingAuthorName(readings, 'user-1', '新名字');

    expect(result.find(reading => reading.id === 'own-public')).toMatchObject({
      authorName: '新名字',
      updatedAt: expect.any(String),
    });
    expect(result.find(reading => reading.id === 'own-anonymous')?.authorName).toBe('匿名研习者');
    expect(result.find(reading => reading.id === 'other-user')?.authorName).toBe('旧名字');
    expect(result.find(reading => reading.id === 'example')?.authorName).toBe('旧名字');
  });
});
