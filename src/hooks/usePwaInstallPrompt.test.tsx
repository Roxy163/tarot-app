import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPwaInstallPrompt, usePwaInstallPrompt } from './usePwaInstallPrompt';

describe('usePwaInstallPrompt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('clears the install event when the browser install prompt fails', async () => {
    const prompt = vi.fn().mockRejectedValue(new Error('prompt blocked'));
    const fakeEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    };
    fakeEvent.prompt = prompt;
    fakeEvent.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });

    const { result } = renderHook(() => usePwaInstallPrompt());

    await act(async () => {
      window.dispatchEvent(fakeEvent);
    });

    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      const installed = await result.current.install();
      expect(installed).toBe(false);
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('can request native install without showing the fallback banner', () => {
    const { result } = renderHook(() => usePwaInstallPrompt());

    act(() => {
      requestPwaInstallPrompt({ autoInstall: true, suppressBanner: true, source: 'sidebar' });
    });

    expect(result.current.shouldShow).toBe(false);
  });
});
