import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDailyFortune } from './useDailyFortune';
import { getLocalStorageBackupKey, getLocalStorageLatestBackupKey } from '../lib/safeLocalStorage';
import { getUserDailyFortunes, saveUserDailyFortunes } from '../lib/firebaseData';
import type { DailyFortune } from '../types';

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

  it('does not reveal a successful draw if the local primary write fails', () => {
    const { result } = renderHook(() => useDailyFortune());
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => act(() => { result.current.createDailyFortuneFromCard('ar09', false); })).toThrow();
    expect(result.current.fortunes).toEqual([]);
    storage.mockRestore();
  });

  it('keeps an old draw without manual archiving visible after remounting on the next day', () => {
    const first = renderHook(() => useDailyFortune());
    act(() => { first.result.current.createDailyFortuneFromCard('ar09', false); });
    first.unmount();
    vi.setSystemTime(new Date('2026-07-03T08:00:00Z'));
    const second = renderHook(() => useDailyFortune());
    expect(second.result.current.getToday()).toBeUndefined();
    expect(second.result.current.getArchivedFortunes()).toHaveLength(1);
    expect(second.result.current.getArchivedFortunes()[0].cardName).toBe('隐士');
  });

  it('uses local midnight and includes the final day in monthly summaries', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 1, 30));
    const { result } = renderHook(() => useDailyFortune());
    act(() => { result.current.createDailyFortuneFromCard('ar00', false); });
    expect(result.current.getToday()?.date).toBe('2026-09-30');
    expect(result.current.getMonthlySummary(2026, 8)).not.toBeNull();
    expect(result.current.getMonthlySummary(2026, 7)).toBeNull();
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

  it('uses signed-in local daily fortunes when auth is in local fallback', async () => {
    localStorage.setItem('tarot_daily_fortunes_user-1', JSON.stringify([
      {
        id: 'fortune-local-fallback',
        userId: 'user-1',
        date: '2026-07-02',
        cardName: '女祭司',
        isReversed: false,
        interpretation: '无 VPN 时先读本机日运',
        keywords: ['女祭司', '正位'],
        source: 'physical-draw',
        createdAt: '2026-07-02T08:00:00.000Z',
        updatedAt: '2026-07-02T08:00:00.000Z',
        isRevealed: true,
      },
    ]));

    const { result } = renderHook(() => useDailyFortune({ uid: 'user-1' }, false, true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(getUserDailyFortunes).not.toHaveBeenCalled();
    expect(saveUserDailyFortunes).not.toHaveBeenCalled();
    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0].id).toBe('fortune-local-fallback');
  });

  it.each(['resolve', 'reject'] as const)('keeps edits made before a slow cloud read can %s', async outcome => {
    const stored: DailyFortune = {
      id: 'local-first', userId: 'user-1', date: '2026-07-02', cardName: '女祭司',
      isReversed: false, interpretation: '', keywords: [], source: 'physical-draw',
      createdAt: '2026-07-02T07:00:00.000Z', updatedAt: '2026-07-02T07:00:00.000Z', isRevealed: true,
    };
    localStorage.setItem('tarot_daily_fortunes_user-1', JSON.stringify([stored]));
    let finish!: (items: DailyFortune[]) => void;
    let fail!: (error: Error) => void;
    vi.mocked(getUserDailyFortunes).mockReturnValue(new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
    const { result } = renderHook(() => useDailyFortune({ uid: 'user-1' }));
    expect(result.current.getToday()?.id).toBe('local-first');
    act(() => { result.current.archiveDailyFortune('local-first', { initialImpression: '云端还没回来，我已经写下。' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(saveUserDailyFortunes).not.toHaveBeenCalled();
    await act(async () => {
      if (outcome === 'resolve') finish([stored]);
      else fail(new Error('offline'));
    });
    expect(result.current.getToday()?.initialImpression).toBe('云端还没回来，我已经写下。');
    expect(JSON.parse(localStorage.getItem('tarot_daily_fortunes_user-1')!)[0].initialImpression).toBe('云端还没回来，我已经写下。');
  });

  it('does not mark a daily reflection saved when browser storage rejects it', () => {
    const { result } = renderHook(() => useDailyFortune());
    act(() => { result.current.createDailyFortuneFromCard('ar02', false); });
    const id = result.current.getToday()!.id;
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key.startsWith('tarot_daily_fortunes')) throw new Error('storage full');
      return setItem.call(this, key, value);
    });
    expect(() => { act(() => { result.current.archiveDailyFortune(id, '应保留在表单'); }); }).toThrow('本机保存失败');
    expect(result.current.getToday()?.archivedAt).toBeUndefined();
    expect(result.current.getToday()?.reflection).toBeUndefined();
  });

  it('preserves a new draw when the cloud responds before the next React commit', async () => {
    let finish!: (items: DailyFortune[]) => void;
    vi.mocked(getUserDailyFortunes).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useDailyFortune({ uid: 'user-1' }));
    await act(async () => {
      result.current.createDailyFortuneFromCard('ar02', false);
      finish([]);
    });
    expect(result.current.getToday()?.cardName).toBe('女祭司');
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
    localStorage.setItem(getLocalStorageLatestBackupKey('tarot_daily_fortunes'), localStorage.getItem('tarot_daily_fortunes')!);
    localStorage.setItem(getLocalStorageBackupKey('tarot_daily_fortunes'), localStorage.getItem('tarot_daily_fortunes')!);

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
    expect(localStorage.getItem(getLocalStorageLatestBackupKey('tarot_daily_fortunes'))).toBeNull();
    expect(localStorage.getItem(getLocalStorageBackupKey('tarot_daily_fortunes'))).toBeNull();
    expect(localStorage.getItem('tarot_daily_fortunes_owner')).toBeNull();
  });

  it('makes a draw immediately available in the archive without requiring notes or manual archiving', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar09', false, 'physical-draw');
    });

    expect(result.current.getArchivedFortunes()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('tarot_daily_fortunes')!)).toHaveLength(1);

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

  it('deletes selected daily fortune records from local state', () => {
    const { result } = renderHook(() => useDailyFortune());

    act(() => {
      result.current.createDailyFortuneFromCard('ar02', false, 'physical-draw');
    });
    act(() => {
      result.current.archiveDailyFortune(result.current.fortunes[0].id, {
        initialImpression: '第一眼很安静',
        dailyReview: '晚上对应到沉默观察',
      });
    });

    const fortuneId = result.current.fortunes[0].id;

    act(() => {
      result.current.deleteDailyFortunes([fortuneId]);
    });

    expect(result.current.fortunes).toHaveLength(0);
    expect(result.current.getToday()).toBeUndefined();
  });

  it('keeps the full annotated example after deleting its daily record, redrawing and remounting', () => {
    const first = renderHook(() => useDailyFortune());
    act(() => { first.result.current.createDailyFortuneFromCard('ar02', false); });
    const id = first.result.current.getToday()!.id;
    act(() => {
      first.result.current.archiveDailyFortune(id, { initialImpression: '早上安静观察', dailyReview: '晚上对应到一次真实沟通' });
      first.result.current.saveDailyFortuneToCardAnnotation(id);
      first.result.current.deleteDailyFortune(id);
    });
    expect(first.result.current.fortunes).toEqual([]);
    expect(first.result.current.getToday()).toBeUndefined();
    expect(first.result.current.getArchivedFortunes()).toEqual([]);
    expect(first.result.current.getMonthlySummary(2026, 6)).toBeNull();
    expect(first.result.current.annotationExamples[0]).toMatchObject({ id, initialImpression: '早上安静观察', dailyReview: '晚上对应到一次真实沟通', deletedAt: '2026-07-02T08:00:00.000Z' });
    expect(first.result.current.allFortunes).toHaveLength(1);

    act(() => { first.result.current.createDailyFortuneFromCard('ar04', true); });
    expect(first.result.current.getToday()?.cardName).toBe('皇帝');
    expect(first.result.current.annotationExamples[0].id).toBe(id);
    first.unmount();
    const second = renderHook(() => useDailyFortune());
    expect(second.result.current.fortunes).toHaveLength(1);
    expect(second.result.current.annotationExamples[0].dailyReview).toBe('晚上对应到一次真实沟通');
    expect(second.result.current.allFortunes).toHaveLength(2);
  });

  it('keeps an annotated example when today is redrawn without an explicit deletion first', () => {
    const { result } = renderHook(() => useDailyFortune());
    act(() => { result.current.createDailyFortuneFromCard('ar02', false); });
    const id = result.current.getToday()!.id;
    act(() => {
      result.current.archiveDailyFortune(id, '仍要保留的经验');
      result.current.saveDailyFortuneToCardAnnotation(id);
      result.current.createDailyFortuneFromCard('ar04', true);
    });
    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.getToday()?.cardName).toBe('皇帝');
    expect(result.current.annotationExamples[0]).toMatchObject({ id, reflection: '仍要保留的经验', deletedAt: '2026-07-02T08:00:00.000Z' });
  });

  it('clears personal text from a deleted record that was never saved as an example', () => {
    const { result } = renderHook(() => useDailyFortune());
    act(() => { result.current.createDailyFortuneFromCard('ar02', false); });
    const id = result.current.getToday()!.id;
    act(() => {
      result.current.archiveDailyFortune(id, { initialImpression: '删除的直觉', dailyReview: '删除的回看' });
      result.current.deleteDailyFortune(id);
    });
    expect(result.current.fortunes).toEqual([]);
    expect(result.current.annotationExamples).toEqual([]);
    const stored = JSON.parse(localStorage.getItem('tarot_daily_fortunes')!)[0];
    expect(stored).toMatchObject({ id, deletedAt: '2026-07-02T08:00:00.000Z' });
    expect(stored).not.toHaveProperty('initialImpression');
    expect(stored).not.toHaveProperty('dailyReview');
    expect(stored).not.toHaveProperty('reflection');
  });

  it.each(['delete', 'annotation'] as const)('keeps the original record and reports a failed %s when local storage rejects the write', operation => {
    const { result } = renderHook(() => useDailyFortune());
    act(() => { result.current.createDailyFortuneFromCard('ar02', false); });
    const id = result.current.getToday()!.id;
    act(() => { result.current.archiveDailyFortune(id, '写好的复盘'); });
    const before = localStorage.getItem('tarot_daily_fortunes');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'tarot_daily_fortunes') throw new Error('storage full');
      return setItem.call(this, key, value);
    });
    expect(() => act(() => {
      if (operation === 'delete') result.current.deleteDailyFortune(id);
      else result.current.saveDailyFortuneToCardAnnotation(id);
    })).toThrow('本机保存失败');
    expect(result.current.fortunes).toHaveLength(1);
    expect(result.current.fortunes[0]).toMatchObject({ id, reflection: '写好的复盘' });
    expect(result.current.fortunes[0].deletedAt).toBeUndefined();
    expect(result.current.fortunes[0].savedToCardAnnotationAt).toBeUndefined();
    expect(localStorage.getItem('tarot_daily_fortunes')).toBe(before);
  });

  it('keeps a deleted example when a slow initial cloud read returns the old visible record', async () => {
    const stored: DailyFortune = {
      id: 'local-example', userId: 'user-1', date: '2026-07-02', cardName: '女祭司',
      isReversed: false, interpretation: '', keywords: [], reflection: '保留的复盘',
      createdAt: '2026-07-02T07:00:00Z', updatedAt: '2026-07-02T07:00:00Z',
    };
    localStorage.setItem('tarot_daily_fortunes_user-1', JSON.stringify([stored]));
    let finish!: (items: DailyFortune[]) => void;
    vi.mocked(getUserDailyFortunes).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useDailyFortune({ uid: 'user-1' }));
    act(() => {
      result.current.saveDailyFortuneToCardAnnotation(stored.id);
      result.current.deleteDailyFortune(stored.id);
    });
    await act(async () => { finish([stored]); });
    expect(result.current.fortunes).toEqual([]);
    expect(result.current.annotationExamples[0]).toMatchObject({ id: stored.id, reflection: '保留的复盘', savedToCardAnnotationAt: '2026-07-02T08:00:00.000Z', deletedAt: '2026-07-02T08:00:00.000Z' });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(saveUserDailyFortunes).toHaveBeenCalledWith('user-1', [expect.objectContaining({ id: stored.id, deletedAt: '2026-07-02T08:00:00.000Z' })]);
  });

  it('does not revive a locally deleted record after remounting against an old cloud snapshot', async () => {
    const first = renderHook(() => useDailyFortune({ uid: 'user-1' }));
    await act(async () => { await Promise.resolve(); });
    act(() => { first.result.current.createDailyFortuneFromCard('ar02', false); });
    const old = first.result.current.getToday()!;
    act(() => { first.result.current.deleteDailyFortune(old.id); });
    first.unmount();
    vi.mocked(getUserDailyFortunes).mockResolvedValue([old]);
    const second = renderHook(() => useDailyFortune({ uid: 'user-1' }));
    await act(async () => { await Promise.resolve(); });
    expect(second.result.current.fortunes).toEqual([]);
    expect(second.result.current.allFortunes).toHaveLength(1);
    expect(second.result.current.allFortunes[0].deletedAt).toBeDefined();
  });

  it('isolates retained examples across account changes and rejects callbacks from the old account', async () => {
    const { result, rerender } = renderHook(({ uid }) => useDailyFortune({ uid }), { initialProps: { uid: 'user-1' } });
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.createDailyFortuneFromCard('ar02', false); });
    const id = result.current.getToday()!.id;
    act(() => {
      result.current.archiveDailyFortune(id, '账号一的例证');
      result.current.saveDailyFortuneToCardAnnotation(id);
      result.current.deleteDailyFortune(id);
    });
    const oldDelete = result.current.deleteDailyFortune;
    const oldSave = result.current.saveDailyFortuneToCardAnnotation;
    rerender({ uid: 'user-2' });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.fortunes).toEqual([]);
    expect(result.current.annotationExamples).toEqual([]);
    expect(result.current.allFortunes).toEqual([]);
    expect(() => oldDelete(id)).toThrow('记录正在恢复');
    expect(() => oldSave(id)).toThrow('记录正在恢复');
    expect(JSON.parse(localStorage.getItem('tarot_daily_fortunes_user-1')!)[0].reflection).toBe('账号一的例证');
  });
});
