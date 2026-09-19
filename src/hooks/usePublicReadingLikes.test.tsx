import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublicReadingLikes } from './usePublicReadingLikes';
import { getPublicReadingLike, setPublicReadingLike } from '../lib/firebaseData';
import type { PublicReadingLikeState } from '../types';

vi.mock('../lib/firebaseData', () => ({ getPublicReadingLike: vi.fn(), setPublicReadingLike: vi.fn() }));
describe('public like request isolation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('ignores a slow initial read after a successful like', async () => {
    let resolveInitial!: (value: PublicReadingLikeState) => void;
    vi.mocked(getPublicReadingLike).mockImplementationOnce(() => new Promise(resolve => { resolveInitial = resolve; }))
      .mockResolvedValue({ liked: false, count: 1 });
    vi.mocked(setPublicReadingLike).mockResolvedValue({ liked: true, count: 2 });
    const { result } = renderHook(() => usePublicReadingLikes(['r'], 'alice'));
    await act(() => result.current.toggle('r'));
    await act(async () => resolveInitial({ liked: false, count: 1 }));
    expect(result.current.likes.r).toEqual({ liked: true, count: 2 });
  });

  it('keeps the old account response out of the new account', async () => {
    let resolveWrite!: (value: PublicReadingLikeState) => void;
    vi.mocked(getPublicReadingLike).mockResolvedValue({ liked: false, count: 0 });
    vi.mocked(setPublicReadingLike).mockImplementation(() => new Promise(resolve => { resolveWrite = resolve; }));
    const { result, rerender } = renderHook(({ uid }) => usePublicReadingLikes(['r'], uid), { initialProps: { uid: 'alice' } });
    await waitFor(() => expect(result.current.likes.r).toEqual({ liked: false, count: 0 }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.toggle('r'); });
    await waitFor(() => expect(setPublicReadingLike).toHaveBeenCalled());
    rerender({ uid: 'bob' });
    await act(async () => { resolveWrite({ liked: true, count: 1 }); await pending; });
    expect(result.current.likes.r?.liked).toBe(false);
  });
});
