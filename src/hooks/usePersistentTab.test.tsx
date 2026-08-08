import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePersistentTab } from './usePersistentTab';

const isKnownTab = (value: string | null): value is 'home' | 'profile' => (
  value === 'home' || value === 'profile'
);

describe('usePersistentTab', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('falls back safely when localStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => usePersistentTab('tab-key', 'home', isKnownTab));

    expect(result.current[0]).toBe('home');
  });

  it('keeps the current tab usable when localStorage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const { result } = renderHook(() => usePersistentTab('tab-key', 'home', isKnownTab));

    act(() => {
      result.current[1]('profile');
    });

    expect(result.current[0]).toBe('profile');
  });
});
