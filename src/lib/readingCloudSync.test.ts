import { describe, expect, it } from 'vitest';
import { TarotReading } from '../types';
import { canMirrorPublicReading, createUserReadingSyncPlan, getReadingVersionTime, pickNewestReading } from './readingCloudSync';

const createReading = (overrides: Partial<TarotReading>): TarotReading => ({
  id: 'reading-1',
  userId: 'old-user',
  date: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
  question: '问题',
  spread: '单牌阵',
  cards: [{ name: '愚者', isReversed: false }],
  interpretation: {
    singleCard: '解读',
    combination: '',
    summary: '',
  },
  keywords: [],
  isPublic: false,
  authorName: '研习阁主',
  isAnonymous: false,
  ...overrides,
});

describe('readingCloudSync', () => {
  it('requires a real card list before mirroring a reading publicly', () => {
    expect(canMirrorPublicReading(createReading({ cards: [{ name: '愚者', isReversed: false }] }))).toBe(true);
    expect(canMirrorPublicReading(createReading({ cards: [] }))).toBe(false);
  });

  it('uses updatedAt before date and readingDate for version comparison', () => {
    expect(getReadingVersionTime(createReading({
      date: '2026-06-20T00:00:00.000Z',
      readingDate: '2026-06-21T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    }))).toBe(new Date('2026-06-22T00:00:00.000Z').getTime());
  });

  it('keeps the newest cloud reading when incoming local data is stale', () => {
    const incoming = createReading({ updatedAt: '2026-06-20T00:00:00.000Z', question: '本地旧问题' });
    const previous = createReading({ updatedAt: '2026-06-21T00:00:00.000Z', question: '云端新问题' });

    expect(pickNewestReading(incoming, previous)).toBe(previous);
  });

  it('writes only new or changed readings while preserving ownership', () => {
    const unchanged = createReading({ id: 'same', userId: 'uid-1', updatedAt: '2026-06-20T00:00:00.000Z' });
    const changedPrevious = createReading({ id: 'changed', userId: 'uid-1', updatedAt: '2026-06-20T00:00:00.000Z', question: '旧问题' });
    const changedIncoming = createReading({ id: 'changed', userId: 'other-user', updatedAt: '2026-06-21T00:00:00.000Z', question: '新问题' });
    const newIncoming = createReading({ id: 'new', userId: 'other-user', updatedAt: '2026-06-21T00:00:00.000Z' });
    const plan = createUserReadingSyncPlan('uid-1', [unchanged, changedIncoming, newIncoming], [unchanged, changedPrevious]);

    expect(plan.readingsToWrite.map(reading => reading.id)).toEqual(['changed', 'new']);
    expect(plan.readingsToWrite.every(reading => reading.userId === 'uid-1')).toBe(true);
    expect(plan.readingsToDelete).toEqual([]);
  });

  it('keeps newer cloud content without leaking stale ownership', () => {
    const staleIncoming = createReading({
      id: 'cloud-newer',
      userId: 'local-user',
      updatedAt: '2026-06-20T00:00:00.000Z',
      question: '本地旧问题',
    });
    const newerPrevious = createReading({
      id: 'cloud-newer',
      userId: 'old-owner',
      updatedAt: '2026-06-21T00:00:00.000Z',
      question: '云端新问题',
      isPublic: true,
    });
    const plan = createUserReadingSyncPlan('uid-1', [staleIncoming], [newerPrevious]);

    expect(plan.mergedReadings).toEqual([{ ...newerPrevious, userId: 'uid-1' }]);
    expect(plan.publicReadingsToSave).toEqual([{ ...newerPrevious, userId: 'uid-1' }]);
    expect(plan.readingsToWrite).toEqual([{ ...newerPrevious, userId: 'uid-1' }]);
  });

  it('does not resurrect a public mirror from stale local data', () => {
    const stalePublicIncoming = createReading({
      id: 'private-newer',
      isPublic: true,
      updatedAt: '2026-06-20T00:00:00.000Z',
    });
    const newerPrivatePrevious = createReading({
      id: 'private-newer',
      isPublic: false,
      updatedAt: '2026-06-21T00:00:00.000Z',
    });
    const plan = createUserReadingSyncPlan('uid-1', [stalePublicIncoming], [newerPrivatePrevious]);

    expect(plan.mergedReadings).toEqual([{ ...newerPrivatePrevious, userId: 'uid-1' }]);
    expect(plan.publicReadingsToSave).toEqual([]);
    expect(plan.publicReadingIdsToDelete).toEqual([]);
  });

  it('does not delete cloud readings merely because they are absent from the current local cache', () => {
    const kept = createReading({ id: 'kept', userId: 'uid-1' });
    const deletedPrivate = createReading({ id: 'deleted-private', userId: 'uid-1', isPublic: false });
    const deletedPublic = createReading({ id: 'deleted-public', userId: 'uid-1', isPublic: true });
    const plan = createUserReadingSyncPlan('uid-1', [kept], [kept, deletedPrivate, deletedPublic]);

    expect(plan.readingsToDelete).toEqual([]);
    expect(plan.publicReadingIdsToDelete).toEqual([]);
  });

  it('plans user reading deletions and public mirror removals only for explicit deletes', () => {
    const kept = createReading({ id: 'kept', userId: 'uid-1' });
    const deletedPrivate = createReading({ id: 'deleted-private', userId: 'uid-1', isPublic: false });
    const deletedPublic = createReading({ id: 'deleted-public', userId: 'uid-1', isPublic: true });
    const plan = createUserReadingSyncPlan(
      'uid-1',
      [kept],
      [kept, deletedPrivate, deletedPublic],
      { deletedReadingIds: ['deleted-private', 'deleted-public'] },
    );

    expect(plan.readingsToDelete.map(reading => reading.id)).toEqual(['deleted-private', 'deleted-public']);
    expect(plan.publicReadingIdsToDelete).toEqual(['deleted-public']);
  });

  it('updates public mirrors and removes mirrors when a reading becomes private', () => {
    const stillPublic = createReading({ id: 'public', isPublic: true });
    const nowPrivateIncoming = createReading({ id: 'private-now', isPublic: false, updatedAt: '2026-06-21T00:00:00.000Z' });
    const previouslyPublic = createReading({ id: 'private-now', isPublic: true, updatedAt: '2026-06-20T00:00:00.000Z' });
    const plan = createUserReadingSyncPlan('uid-1', [stillPublic, nowPrivateIncoming], [stillPublic, previouslyPublic]);

    expect(plan.publicReadingsToSave.map(reading => reading.id)).toEqual(['public']);
    expect(plan.publicReadingIdsToDelete).toEqual(['private-now']);
  });

  it('does not mirror incomplete public readings while still writing them privately', () => {
    const incompletePublic = createReading({
      id: 'legacy-empty',
      isPublic: true,
      cards: [],
      updatedAt: '2026-06-21T00:00:00.000Z',
    });
    const previousPublic = createReading({
      id: 'legacy-empty',
      isPublic: true,
      updatedAt: '2026-06-20T00:00:00.000Z',
    });

    const plan = createUserReadingSyncPlan('uid-1', [incompletePublic], [previousPublic]);

    expect(plan.readingsToWrite.map(reading => reading.id)).toEqual(['legacy-empty']);
    expect(plan.publicReadingsToSave).toEqual([]);
    expect(plan.publicReadingIdsToDelete).toEqual(['legacy-empty']);
  });
});
