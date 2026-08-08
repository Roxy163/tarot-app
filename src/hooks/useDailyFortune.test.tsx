import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDailyFortune } from './useDailyFortune';
import { getLocalStorageBackupKey } from '../lib/safeLocalStorage';
import { getUserDailyFortunes, saveUserDailyFortunes } from '../lib/firebaseData';

vi.mock('../lib/firebaseData', () => ({
  getUserDailyFortunes: vi.fn(),
  saveUserDailyFortunes: vi.fn(),
}));

describe('useDailyFortune', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getUserDailyFortunes).mockResolvedValue([]);
    vi.mocked(saveUserDailyFortunes).mockResolvedValue();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('marks system daily draws with app-draw source', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.reshuffleDailyFortune();
    });

    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0].source).toBe('app-draw');
  });

  it('creates physical daily records from a selected real-world card', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', true, 'physical-draw');
    });

    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0]).toMatchObject({
      cardName: '女祭司',
      isReversed: true,
      source: 'physical-draw',
    });
  });

  it('recovers daily records from backup if primary local data is corrupted', () => {
    localStorage.setItem('tarot_daily_fortunes', '{broken-json');
    localStorage.setItem(getLocalStorageBackupKey('tarot_daily_fortunes'), JSON.stringify([
      {
        id: 'fortune-backup',
        userId: 'local',
        date: '2026-07-02',
        cardName: '女祭司',
        isReversed: false,
        interpretation: '备份记录',
        keywords: ['女祭司', '正位'],
        source: 'physical-draw',
        createdAt: '2026-07-02T08:00:00.000Z',
        isRevealed: true,
      },
    ]));

    const { result } = renderHook(() => useDailyFortune());

    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0].id).toBe('fortune-backup');
  });

  it('does not rewrite daily fortunes to cloud immediately after an unchanged signed-in load', async () => {
    renderHook(() => useDailyFortune({ uid: 'user-1' }, false));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(saveUserDailyFortunes).not.toHaveBeenCalled();
  });

  it('merges signed-in cloud records with the user-scoped local cache and saves the merged result', async () => {
    vi.mocked(getUserDailyFortunes).mockResolvedValue([
      {
        id: 'fortune-cloud',
        userId: 'user-1',
        date: '2026-07-02',
        cardName: '女祭司',
        isReversed: false,
        interpretation: '云端旧记录',
        keywords: ['女祭司', '正位'],
        initialImpression: '早上觉得要安静观察',
        source: 'physical-draw',
        createdAt: '2026-07-02T07:00:00.000Z',
        updatedAt: '2026-07-02T07:00:00.000Z',
        isRevealed: true,
      },
    ]);
    localStorage.setItem('tarot_daily_fortunes_user-1', JSON.stringify([
      {
        id: 'fortune-local',
        userId: 'user-1',
        date: '2026-07-02',
        cardName: '皇帝',
        isReversed: true,
        interpretation: '本机新记录',
        keywords: ['皇帝', '逆位'],
        source: 'physical-draw',
        createdAt: '2026-07-02T08:00:00.000Z',
        updatedAt: '2026-07-02T20:00:00.000Z',
        isRevealed: true,
      },
    ]));

    const { result } = renderHook(() => useDailyFortune({ uid: 'user-1' }, false));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0]).toMatchObject({
      userId: 'user-1',
      cardName: '皇帝',
      initialImpression: '早上觉得要安静观察',
    });
    expect(JSON.parse(localStorage.getItem('tarot_daily_fortunes_user-1') || '[]')[0]).toMatchObject({
      cardName: '皇帝',
      initialImpression: '早上觉得要安静观察',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(saveUserDailyFortunes).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({
        cardName: '皇帝',
        initialImpression: '早上觉得要安静观察',
      }),
    ]);
  });

  it('migrates daily guest records to cloud only when they are marked as guest-owned', async () => {
    localStorage.setItem('tarot_daily_fortunes_owner', 'guest');
    localStorage.setItem('tarot_daily_fortunes', JSON.stringify([
      {
        id: 'fortune-guest',
        userId: 'local',
        date: '2026-07-02',
        cardName: '女祭司',
        isReversed: false,
        interpretation: '访客日运',
        keywords: ['女祭司', '正位'],
        source: 'physical-draw',
        createdAt: '2026-07-02T08:00:00.000Z',
        updatedAt: '2026-07-02T08:00:00.000Z',
        isRevealed: true,
      },
    ]));

    const { result } = renderHook(() => useDailyFortune({ uid: 'user-1' }, false));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.fortunes[0]).toMatchObject({
      userId: 'user-1',
      cardName: '女祭司',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(saveUserDailyFortunes).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({ id: 'fortune-guest', userId: 'user-1' }),
    ]);
    expect(localStorage.getItem('tarot_daily_fortunes')).toBeNull();
    expect(localStorage.getItem('tarot_daily_fortunes_owner')).toBeNull();
  });

  it('keeps unarchived fortunes out of the archive and allows empty archive saves', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar09', false, 'physical-draw');
    });

    expect(result.current.getArchivedFortunes()).toHaveLength(0);

    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, '');
    });

    const archived = result.current.getArchivedFortunes();
    expect(archived).toHaveLength(1);
    expect(archived[0].archivedAt).toBe('2026-07-02T08:00:00.000Z');
    expect(archived[0].reflection).toBe('');
  });

  it('updates archived daily reflection text', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('pepa', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, '第一直觉');
    });
    act(() => {
      result.current.updateDailyFortuneReflection(result.current.fortunes[0].id, '晚上对应到工作进展');
    });

    expect(result.current.getArchivedFortunes()[0].reflection).toBe('晚上对应到工作进展');
  });

  it('stores split daily reflection fields and keeps a combined reflection for compatibility', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, {
        initialImpression: '第一眼觉得要慢下来',
        dailyReview: '晚上对应到一次真实沟通',
      });
    });

    expect(result.current.getArchivedFortunes()[0]).toMatchObject({
      initialImpression: '第一眼觉得要慢下来',
      dailyReview: '晚上对应到一次真实沟通',
      reflection: '第一直觉：第一眼觉得要慢下来\n\n今日回看：晚上对应到一次真实沟通',
    });
  });

  it('builds compatible reflection text when only one split field is filled', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, {
        initialImpression: '',
        dailyReview: '今天暂未看见明显对应',
      });
    });

    expect(result.current.getArchivedFortunes()[0]).toMatchObject({
      initialImpression: '',
      dailyReview: '今天暂未看见明显对应',
      reflection: '今日回看：今天暂未看见明显对应',
    });
  });

  it('updates the physical daily card without losing reflection or archive state', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, '第一印象\n复盘内容');
    });

    const fortuneId = result.current.fortunes[0].id;
    act(() => {
      result.current.updateDailyFortuneCard(fortuneId, 'ar04', true);
    });

    expect(result.current.fortunes[0]).toMatchObject({
      id: fortuneId,
      cardName: '皇帝',
      isReversed: true,
      source: 'physical-draw',
      reflection: '第一印象\n复盘内容',
      archivedAt: '2026-07-02T08:00:00.000Z',
      keywords: ['皇帝', '逆位'],
    });
  });

  it('keeps split daily reflection fields when changing the physical card', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, {
        initialImpression: '第一眼很安静',
        dailyReview: '晚上回看是沉默观察',
      });
    });

    const fortuneId = result.current.fortunes[0].id;
    act(() => {
      result.current.updateDailyFortuneCard(fortuneId, 'ar04', true);
    });

    expect(result.current.fortunes[0]).toMatchObject({
      id: fortuneId,
      cardName: '皇帝',
      initialImpression: '第一眼很安静',
      dailyReview: '晚上回看是沉默观察',
      reflection: '第一直觉：第一眼很安静\n\n今日回看：晚上回看是沉默观察',
    });
  });

  it('marks written daily fortunes as saved to card annotations', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, {
        initialImpression: '第一眼很安静',
        dailyReview: '晚上回看是沉默观察',
      });
    });

    const fortuneId = result.current.fortunes[0].id;
    act(() => {
      result.current.saveDailyFortuneToCardAnnotation(fortuneId);
    });

    expect(result.current.fortunes[0]).toMatchObject({
      savedToCardAnnotationAt: '2026-07-02T08:00:00.000Z',
      cardAnnotationNote: '第一直觉：第一眼很安静\n\n今日回看：晚上回看是沉默观察',
    });
  });

  it('does not mark empty daily fortunes as saved to card annotations', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.saveDailyFortuneToCardAnnotation(result.current.fortunes[0].id);
    });

    expect(result.current.fortunes[0].savedToCardAnnotationAt).toBeUndefined();
  });

  it('can replace today fortune through numbered redraw without keeping the old card', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    expect(result.current.fortunes[0].cardName).toBe('女祭司');

    act(() => {
      result.current.generateDailyFortuneWithNumber(1, 9, true);
    });

    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0].source).toBe('app-draw');
    expect(result.current.fortunes[0].cardName).not.toBe('女祭司');
  });
});
