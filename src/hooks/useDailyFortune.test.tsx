import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDailyFortune } from './useDailyFortune';

describe('useDailyFortune', () => {
  beforeEach(() => {
    localStorage.clear();
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
