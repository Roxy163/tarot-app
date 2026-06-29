import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingSlotData } from '../types';
import { useLongPressClear } from './useLongPressClear';

const createSlots = (): ReadingSlotData[] => [
  { name: '愚者', isReversed: true, label: '主牌' },
  { name: '魔术师', isReversed: false, label: '辅助' },
];

describe('useLongPressClear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window.navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(() => true),
    });
    vi.spyOn(window.navigator, 'vibrate').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clears the pressed slot after 600ms and resets reversed state', () => {
    const setCardSlots = vi.fn();
    const slots = createSlots();
    const { result } = renderHook(() => useLongPressClear({ cardSlots: slots, setCardSlots }));

    act(() => {
      result.current.handleLongPressStart(0);
      vi.advanceTimersByTime(599);
    });

    expect(setCardSlots).not.toHaveBeenCalled();
    expect(result.current.isLongPressActive).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(setCardSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '主牌' },
      { name: '魔术师', isReversed: false, label: '辅助' },
    ]);
    expect(window.navigator.vibrate).toHaveBeenCalledWith(50);
    expect(result.current.isLongPressActive).toBe(true);
  });

  it('does not clear when long press ends before 600ms', () => {
    const setCardSlots = vi.fn();
    const slots = createSlots();
    const { result } = renderHook(() => useLongPressClear({ cardSlots: slots, setCardSlots }));

    act(() => {
      result.current.handleLongPressStart(0);
      vi.advanceTimersByTime(300);
      result.current.handleLongPressEnd();
      vi.advanceTimersByTime(600);
    });

    expect(setCardSlots).not.toHaveBeenCalled();
    expect(window.navigator.vibrate).not.toHaveBeenCalled();
    expect(result.current.isLongPressActive).toBe(false);
  });

  it('does not clear an empty slot', () => {
    const setCardSlots = vi.fn();
    const slots: ReadingSlotData[] = [{ name: '', isReversed: false, label: '空位' }];
    const { result } = renderHook(() => useLongPressClear({ cardSlots: slots, setCardSlots }));

    act(() => {
      result.current.handleLongPressStart(0);
      vi.advanceTimersByTime(600);
    });

    expect(setCardSlots).not.toHaveBeenCalled();
    expect(window.navigator.vibrate).not.toHaveBeenCalled();
    expect(result.current.isLongPressActive).toBe(false);
  });

  it('cancels a pending long press when a different slot starts pressing', () => {
    const setCardSlots = vi.fn();
    const slots = createSlots();
    const { result } = renderHook(() => useLongPressClear({ cardSlots: slots, setCardSlots }));

    act(() => {
      result.current.handleLongPressStart(0);
      vi.advanceTimersByTime(300);
      result.current.handleLongPressStart(1);
      vi.advanceTimersByTime(599);
    });

    expect(setCardSlots).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(setCardSlots).toHaveBeenCalledWith([
      { name: '愚者', isReversed: true, label: '主牌' },
      { name: '', isReversed: false, label: '辅助' },
    ]);
    expect(window.navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it('allows the consumed long press flag to be cleared after click handling', () => {
    const setCardSlots = vi.fn();
    const slots = createSlots();
    const { result } = renderHook(() => useLongPressClear({ cardSlots: slots, setCardSlots }));

    act(() => {
      result.current.handleLongPressStart(0);
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isLongPressActive).toBe(true);

    act(() => {
      result.current.clearLongPressActive();
    });

    expect(result.current.isLongPressActive).toBe(false);
  });
});
