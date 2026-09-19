import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markPwaInstallPromptReady, requestPwaInstallPrompt, usePwaInstallPrompt } from './usePwaInstallPrompt';

describe('usePwaInstallPrompt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('respects old dismissals beyond 14 days and allows changing the preference explicitly', () => {
    localStorage.setItem('tarot_pwa_install_prompt_dismissed_at', String(Date.now() - 60 * 86400000));
    const { result } = renderHook(() => usePwaInstallPrompt());
    act(() => requestPwaInstallPrompt({ force: true }));
    expect(result.current.shouldShow).toBe(false);
    expect(result.current.reminderPreference).toBe('never');
    act(() => result.current.setReminderPreference('auto'));
    expect(result.current.shouldShow).toBe(true);
  });

  it('keeps reminders dismissed across remounts and later milestones', () => {
    const first = renderHook(() => usePwaInstallPrompt());
    act(() => markPwaInstallPromptReady());
    expect(first.result.current.shouldShow).toBe(true);
    act(() => first.result.current.dismiss());
    first.unmount();
    const second = renderHook(() => usePwaInstallPrompt());
    act(() => markPwaInstallPromptReady());
    expect(second.result.current.shouldShow).toBe(false);
  });

  it('remembers appinstalled even when the original tab remains in browser mode', () => {
    const { result, unmount } = renderHook(() => usePwaInstallPrompt());
    act(() => window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.isStandalone).toBe(false);
    expect(result.current.reminderPreference).toBe('installed');
    unmount();
    const next = renderHook(() => usePwaInstallPrompt());
    act(() => markPwaInstallPromptReady());
    expect(next.result.current.shouldShow).toBe(false);
  });

  it('remembers launches from the home screen for later browser visits', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const first = renderHook(() => usePwaInstallPrompt());
    expect(first.result.current.reminderPreference).toBe('installed');
    first.unmount();
    vi.unstubAllGlobals();
    const next = renderHook(() => usePwaInstallPrompt());
    act(() => markPwaInstallPromptReady());
    expect(next.result.current.shouldShow).toBe(false);
  });

  it('synchronizes the banner and guide in the same page and settings from other tabs', () => {
    const guide = renderHook(() => usePwaInstallPrompt());
    const banner = renderHook(() => usePwaInstallPrompt());
    act(() => markPwaInstallPromptReady());
    act(() => guide.result.current.setReminderPreference('installed'));
    expect(banner.result.current.shouldShow).toBe(false);
    act(() => {
      localStorage.setItem('tarot_pwa_install_reminder', 'auto');
      window.dispatchEvent(new StorageEvent('storage', { key: 'tarot_pwa_install_reminder' }));
    });
    expect(banner.result.current.shouldShow).toBe(true);
    expect(guide.result.current.reminderPreference).toBe('auto');
  });

  it('consumes a native install event once across all hook instances', async () => {
    const guide = renderHook(() => usePwaInstallPrompt());
    const banner = renderHook(() => usePwaInstallPrompt());
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    act(() => window.dispatchEvent(event));
    await act(async () => {
      await Promise.all([guide.result.current.install(), banner.result.current.install()]);
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(banner.result.current.canInstall).toBe(false);
    expect(banner.result.current.reminderPreference).toBe('installed');
    expect(guide.result.current.isStandalone).toBe(false);
  });

  it('suppresses reminders in the current page and reports when persistence fails', () => {
    const guide = renderHook(() => usePwaInstallPrompt());
    const banner = renderHook(() => usePwaInstallPrompt());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    act(() => {
      markPwaInstallPromptReady();
      expect(guide.result.current.setReminderPreference('never')).toBe(false);
    });
    expect(banner.result.current.shouldShow).toBe(false);
  });
});
