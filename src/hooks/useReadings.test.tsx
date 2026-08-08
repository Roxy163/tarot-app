import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReadings } from './useReadings';
import {
  getUserCardKeywordMemory,
  getUserCardMetadata,
  getUserQuizMemory,
  getUserReadings,
  getUserSpreads,
  replaceUserReadings,
  saveUserCardKeywordMemory,
  saveUserCardMetadata,
  saveUserQuizMemory,
  saveUserSpreads,
} from '../lib/firebaseData';

vi.mock('../lib/firebaseData', () => ({
  getUserCardKeywordMemory: vi.fn(),
  getUserCardMetadata: vi.fn(),
  getUserQuizMemory: vi.fn(),
  getUserReadings: vi.fn(),
  getUserSpreads: vi.fn(),
  replaceUserReadings: vi.fn(),
  saveUserCardKeywordMemory: vi.fn(),
  saveUserCardMetadata: vi.fn(),
  saveUserQuizMemory: vi.fn(),
  saveUserSpreads: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  extractKeywords: vi.fn(() => []),
  recognizeCards: vi.fn(() => []),
  suggestReadingKeywords: vi.fn(() => []),
}));

describe('useReadings cloud sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getUserReadings).mockResolvedValue([]);
    vi.mocked(getUserSpreads).mockResolvedValue([]);
    vi.mocked(getUserCardMetadata).mockResolvedValue([]);
    vi.mocked(getUserCardKeywordMemory).mockResolvedValue([]);
    vi.mocked(getUserQuizMemory).mockResolvedValue([]);
    vi.mocked(replaceUserReadings).mockResolvedValue({
      totalReadings: 0,
      previousReadings: 0,
      privateReadingsWritten: 0,
      privateReadingsDeleted: 0,
      publicReadingsSaved: 0,
      publicReadingsDeleted: 0,
    });
    vi.mocked(saveUserSpreads).mockResolvedValue();
    vi.mocked(saveUserCardMetadata).mockResolvedValue();
    vi.mocked(saveUserCardKeywordMemory).mockResolvedValue();
    vi.mocked(saveUserQuizMemory).mockResolvedValue();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('does not rewrite settings to cloud immediately after an unchanged signed-in load', async () => {
    const { result } = renderHook(() => useReadings({ uid: 'user-1', email: 'user@example.com' }, false));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.syncNotice).toBeNull();
    expect(saveUserQuizMemory).not.toHaveBeenCalled();
    expect(saveUserSpreads).not.toHaveBeenCalled();
    expect(saveUserCardMetadata).not.toHaveBeenCalled();
    expect(saveUserCardKeywordMemory).not.toHaveBeenCalled();
  });

  it('keeps quiz memory local and quiet if a later background setting save fails', async () => {
    vi.mocked(saveUserQuizMemory).mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useReadings({ uid: 'user-1', email: 'user@example.com' }, false));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      result.current.setQuizMemory([
        {
          cardId: 'ar00',
          cardName: '愚者',
          practiceCount: 1,
          unfamiliarCount: 0,
          wrongCount: 0,
          repeated: false,
          createdAt: '2026-07-18T08:00:00.000Z',
          updatedAt: '2026-07-18T08:00:00.000Z',
        },
      ]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(saveUserQuizMemory).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('tarot_quiz_memory_user-1') || '[]')).toHaveLength(1);
    expect(result.current.syncNotice).toBeNull();
    expect(result.current.cloudSyncInfo.status).toBe('error');
  });

  it('uses local signed-in data quietly when initial cloud load is offline', async () => {
    vi.mocked(getUserReadings).mockRejectedValueOnce(Object.assign(
      new Error('Failed to get document because the client is offline.'),
      { code: 'unavailable' },
    ));

    const { result } = renderHook(() => useReadings({ uid: 'user-1', email: 'user@example.com' }, false));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.syncNotice).toBeNull();
    expect(result.current.cloudSyncInfo.status).toBe('error');
    expect(result.current.cloudSyncInfo.lastError).toBe('当前网络暂时连不上云端；本机数据已保留，联网后点「重新同步」。');
  });
});
