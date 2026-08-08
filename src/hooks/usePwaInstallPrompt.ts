import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'tarot_pwa_install_prompt_dismissed_at';
const READY_KEY = 'tarot_pwa_install_prompt_ready_at';
const PROMPT_REQUEST_EVENT = 'tarot:pwa-install-prompt-requested';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface PromptRequestDetail {
  autoInstall?: boolean;
  force?: boolean;
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

const wasRecentlyDismissed = () => {
  if (typeof window === 'undefined') return false;

  try {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
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

const rememberDismissed = () => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // 忽略存储失败；不影响用户继续使用应用。
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
    localStorage.setItem(READY_KEY, String(Date.now()));
    if (options.force) {
      localStorage.removeItem(DISMISS_KEY);
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
  const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed());
  const [promptRequested, setPromptRequested] = useState(() => hasPromptBeenRequested());
  const [isStandalone, setIsStandalone] = useState(() => (
    typeof window !== 'undefined' ? isStandaloneDisplay() : false
  ));
  const isIos = useMemo(() => (
    typeof window !== 'undefined' ? isLikelyIos() : false
  ), []);

  const dismiss = useCallback(() => {
    rememberDismissed();
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    const event = installEventRef.current;
    if (!event) return false;

    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        setIsStandalone(true);
      } else {
        dismiss();
      }
      return true;
    } catch {
      return false;
    } finally {
      installEventRef.current = null;
      setInstallEvent(null);
    }
  }, [dismiss]);

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const syncStandalone = () => setIsStandalone(isStandaloneDisplay());
    media?.addEventListener?.('change', syncStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installEventRef.current = event as BeforeInstallPromptEvent;
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handlePromptRequest = (event: Event) => {
      const detail = (event as CustomEvent<PromptRequestDetail>).detail;
      setPromptRequested(true);
      if (detail?.force) {
        setDismissed(false);
      }
      if (detail?.autoInstall && installEventRef.current) {
        void install();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === READY_KEY) {
        setPromptRequested(hasPromptBeenRequested());
      }
      if (event.key === DISMISS_KEY) {
        setDismissed(wasRecentlyDismissed());
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', syncStandalone);
    window.addEventListener(PROMPT_REQUEST_EVENT, handlePromptRequest);
    window.addEventListener('storage', handleStorage);

    return () => {
      media?.removeEventListener?.('change', syncStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', syncStandalone);
      window.removeEventListener(PROMPT_REQUEST_EVENT, handlePromptRequest);
      window.removeEventListener('storage', handleStorage);
    };
  }, [install]);

  return {
    canInstall: Boolean(installEvent),
    dismiss,
    install,
    isIos,
    isStandalone,
    shouldShow: !isStandalone && !dismissed && promptRequested,
  };
}
