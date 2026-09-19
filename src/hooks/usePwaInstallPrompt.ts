import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '../lib/analytics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'tarot_pwa_install_prompt_dismissed_at';
const READY_KEY = 'tarot_pwa_install_prompt_ready_at';
const PROMPT_REQUEST_EVENT = 'tarot:pwa-install-prompt-requested';
const PREFERENCE_KEY = 'tarot_pwa_install_reminder';
const PREFERENCE_EVENT = 'tarot:pwa-install-preference-changed';
const INSTALL_USED_EVENT = 'tarot:pwa-install-event-used';
export type InstallReminderPreference = 'auto' | 'never' | 'installed';

interface PromptRequestDetail {
  autoInstall?: boolean;
  force?: boolean;
  suppressBanner?: boolean;
  source?: string;
}

const isStandaloneDisplay = () => (
  window.matchMedia?.('(display-mode: standalone)').matches
  || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
);

const isLikelyIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() || '';
  return /iphone|ipad|ipod/.test(userAgent)
    || (platform.includes('mac') && window.navigator.maxTouchPoints > 1);
};

const readReminderPreference = (): InstallReminderPreference => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const preference = localStorage.getItem(PREFERENCE_KEY);
    if (preference === 'auto' || preference === 'never' || preference === 'installed') return preference;
    // Respect earlier dismissals too; they no longer expire after 14 days.
    return Number(localStorage.getItem(DISMISS_KEY) || 0) > 0 ? 'never' : 'auto';
  } catch {
    return 'auto';
  }
};

const hasPromptBeenRequested = () => {
  if (typeof window === 'undefined') return false;

  try {
    return Number(localStorage.getItem(READY_KEY) || 0) > 0;
  } catch {
    return false;
  }
};

const rememberPromptRequested = () => {
  try {
    if (!localStorage.getItem(READY_KEY)) {
      localStorage.setItem(READY_KEY, String(Date.now()));
    }
  } catch {
    // 忽略存储失败；提示仍可在当前页面弹出。
  }
};

export const requestPwaInstallPrompt = (options: PromptRequestDetail = {}) => {
  if (typeof window === 'undefined') return;

  try {
    if (!options.suppressBanner) {
      localStorage.setItem(READY_KEY, String(Date.now()));
    }
  } catch {
    // 忽略存储失败；继续派发当前页面事件。
  }

  window.dispatchEvent(new CustomEvent<PromptRequestDetail>(PROMPT_REQUEST_EVENT, {
    detail: options,
  }));
};

export const markPwaInstallPromptReady = (source = 'milestone') => {
  if (typeof window === 'undefined') return;

  rememberPromptRequested();
  window.dispatchEvent(new CustomEvent<PromptRequestDetail>(PROMPT_REQUEST_EVENT, {
    detail: { force: false, source },
  }));
};

export function usePwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const installSourceRef = useRef<string>('unknown');
  const [reminderPreference, setPreferenceState] = useState(readReminderPreference);
  const [promptRequested, setPromptRequested] = useState(() => hasPromptBeenRequested());
  const [isStandalone, setIsStandalone] = useState(() => (
    typeof window !== 'undefined' ? isStandaloneDisplay() : false
  ));
  const isIos = useMemo(() => (
    typeof window !== 'undefined' ? isLikelyIos() : false
  ), []);

  const setReminderPreference = useCallback((preference: InstallReminderPreference) => {
    let persisted = true;
    try { localStorage.setItem(PREFERENCE_KEY, preference); }
    catch { persisted = false; }
    setPreferenceState(preference);
    window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: preference }));
    return persisted;
  }, []);
  const dismiss = useCallback(() => setReminderPreference('never'), [setReminderPreference]);

  const install = useCallback(async () => {
    const event = installEventRef.current;
    if (!event) return false;
    // The same native event is observed by the guide and banner, but can be used once.
    window.dispatchEvent(new Event(INSTALL_USED_EVENT));

    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        setReminderPreference('installed');
        trackEvent('pwa_install_result', {
          status: 'accepted',
          source: installSourceRef.current,
          platform: choice.platform || 'web',
        });
      } else {
        dismiss();
        trackEvent('pwa_install_result', {
          status: 'dismissed',
          source: installSourceRef.current,
          platform: choice.platform || 'web',
        });
      }
      return true;
    } catch {
      trackEvent('pwa_install_result', {
        status: 'failed',
        source: installSourceRef.current,
      });
      return false;
    } finally {
      installEventRef.current = null;
      setInstallEvent(null);
    }
  }, [dismiss, setReminderPreference]);

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const syncStandalone = () => {
      const standalone = isStandaloneDisplay();
      setIsStandalone(standalone);
      if (standalone) setReminderPreference('installed');
    };
    media?.addEventListener?.('change', syncStandalone);
    const clearInstallEvent = () => {
      installEventRef.current = null;
      setInstallEvent(null);
    };
    const handleInstalled = () => {
      // Installing from a browser tab does not change that tab's display mode.
      clearInstallEvent();
      setReminderPreference('installed');
    };
    const handlePreference = (event: Event) => {
      setPreferenceState((event as CustomEvent<InstallReminderPreference>).detail);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installEventRef.current = event as BeforeInstallPromptEvent;
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handlePromptRequest = (event: Event) => {
      const detail = (event as CustomEvent<PromptRequestDetail>).detail;
      if (!detail?.suppressBanner) {
        setPromptRequested(true);
      }
      installSourceRef.current = detail?.source || 'unknown';
      if (detail?.autoInstall && installEventRef.current) {
        void install();
      } else if (detail?.autoInstall && !installEventRef.current) {
        trackEvent('pwa_install_result', {
          status: 'unavailable',
          source: installSourceRef.current,
        });
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === READY_KEY || event.key === null) {
        setPromptRequested(hasPromptBeenRequested());
      }
      if (event.key === DISMISS_KEY || event.key === PREFERENCE_KEY || event.key === null) {
        setPreferenceState(readReminderPreference());
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener(PREFERENCE_EVENT, handlePreference);
    window.addEventListener(INSTALL_USED_EVENT, clearInstallEvent);
    window.addEventListener(PROMPT_REQUEST_EVENT, handlePromptRequest);
    window.addEventListener('storage', handleStorage);
    syncStandalone();

    return () => {
      media?.removeEventListener?.('change', syncStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener(PREFERENCE_EVENT, handlePreference);
      window.removeEventListener(INSTALL_USED_EVENT, clearInstallEvent);
      window.removeEventListener(PROMPT_REQUEST_EVENT, handlePromptRequest);
      window.removeEventListener('storage', handleStorage);
    };
  }, [install, setReminderPreference]);

  return {
    canInstall: Boolean(installEvent) && !isStandalone,
    dismiss,
    install,
    isIos,
    isStandalone,
    reminderPreference,
    setReminderPreference,
    shouldShow: !isStandalone && reminderPreference === 'auto' && promptRequested,
  };
}
