import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { getCurrentUser, onAuthStateChangedListener, sendCurrentUserEmailVerification, signUpWithEmail } from '../lib/firebase';
import type { User } from 'firebase/auth';

vi.mock('../lib/firebase', () => ({
  signOutUser: vi.fn(),
  onAuthStateChangedListener: vi.fn((callback: (user: null) => void) => { callback(null); return vi.fn(); }),
  getCurrentUser: vi.fn(() => null),
  signInWithPassword: vi.fn(),
  signUpWithEmail: vi.fn(),
  saveLoginHistory: vi.fn(),
  getLastLoginInfo: () => null,
  sendPasswordReset: vi.fn(),
  updateUserPassword: vi.fn(),
  sendCurrentUserEmailVerification: vi.fn(),
  refreshCurrentUser: vi.fn(),
  ensureAuthPersistence: vi.fn().mockResolvedValue(undefined),
}));

describe('signup verification delivery', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([true, false])('reports mail delivery as %s while preserving the created account', async sent => {
    const account = { uid: 'new-user', emailVerified: false };
    vi.mocked(signUpWithEmail).mockResolvedValue({ user: account } as Awaited<ReturnType<typeof signUpWithEmail>>);
    if (sent) vi.mocked(sendCurrentUserEmailVerification).mockResolvedValue();
    else vi.mocked(sendCurrentUserEmailVerification).mockRejectedValue(new Error('network unavailable'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    let delivered: boolean | undefined;
    await act(async () => { delivered = await result.current.signUp('new@example.com', 'password123'); });
    expect(delivered).toBe(sent);
    expect(result.current.session?.uid).toBe('new-user');
    expect(result.current.isEmailVerified).toBe(false);
  });
});

describe('bounded startup loading', () => {
  let notify: (user: User | null) => void;
  let fail: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getCurrentUser).mockReturnValue(null);
    vi.mocked(onAuthStateChangedListener).mockImplementation((callback, onError) => {
      notify = callback;
      fail = () => onError?.(new Error('offline'));
      return vi.fn();
    });
  });
  afterEach(() => vi.useRealTimers());

  it('does not impose a minimum wait when authentication is ready', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => notify(null));
    expect(result.current.isLoading).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.isLocalFallback).toBe(false);
  });

  it('continues locally after a slow connection and accepts the later authenticated account', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => vi.advanceTimersByTime(2200));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLocalFallback).toBe(true);
    expect(result.current.session).toBeNull();
    act(() => notify({ uid: 'returning-reader', emailVerified: true } as User));
    expect(result.current.session?.uid).toBe('returning-reader');
    expect(result.current.isLocalFallback).toBe(false);
  });

  it('keeps the known account scope on connection failure', () => {
    vi.mocked(getCurrentUser).mockReturnValue({ uid: 'cached-reader', emailVerified: true } as User);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => fail());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLocalFallback).toBe(true);
    expect(result.current.session?.uid).toBe('cached-reader');
  });
});
