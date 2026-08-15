import { Suspense, lazy, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, User, ChevronRight, LogOut, Database, ShieldCheck, ArrowRight, LogIn, CheckCircle, AlertTriangle, Mail, Home, Download, MessageSquareText } from 'lucide-react';
import { TarotReading, SpreadDefinition, UserProfile } from './types';
import { OFFICIAL_SPREADS, PAVILION_PROVERBS } from './constants';
import { Modal } from './components/Modal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { checkIfMagicLink, verifyMagicLink, deleteUserAccount } from './lib/firebase';
import { getCachedUserProfile, getOrCreateUserProfile, hasPendingUserProfileUpdate, updateUserProfile, deleteUserAccount as deleteUserAccountData } from './lib/firebaseData';
import { isValidPassword } from './lib/utils';
import { HomeTab } from './components/tabs/HomeTab';
import { MainLayout } from './components/layouts/MainLayout';
import { SplashScreen } from './components/SplashScreen';
import { useReadings } from './hooks/useReadings';
import { useDailyFortune } from './hooks/useDailyFortune';
import { useOnboarding } from './context/OnboardingContext';
import { SmartTipBanner } from './components/onboarding/SmartTipBanner';
import { useSmartTips } from './hooks/useSmartTips';
import { usePersistentTab } from './hooks/usePersistentTab';
import { CloudSyncPanel } from './components/CloudSyncPanel';
import {
  getLegacyCustomSpreadNameMap,
  normalizeLegacyCustomSpreads,
  normalizeLegacyReadingSpreadNames,
} from './lib/spreadPersistence';
import { getAuthorDisplayName, syncReadingAuthorName } from './lib/readingAuthor';
import { warmTarotDeckImages } from './lib/tarotImagePreload';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useMobileFocusScroll } from './hooks/useMobileFocusScroll';
import { requestPwaInstallPrompt } from './hooks/usePwaInstallPrompt';
import { installCloudflareWebAnalytics, setAnalyticsAuthState, trackEvent } from './lib/analytics';
import { FeedbackModal } from './components/FeedbackModal';

const loadCardMetadataManager = () => import('./components/CardMetadataManager');
const loadReadingDetailModal = () => import('./components/ReadingDetailModal');
const loadAuth = () => import('./components/Auth');
const loadAddTab = () => import('./components/tabs/AddTab');
const loadPrivateTab = () => import('./components/tabs/PrivateTab');
const loadPublicTab = () => import('./components/tabs/PublicTab');
const loadProfileTab = () => import('./components/tabs/ProfileTab');

const CardMetadataManager = lazy(() => loadCardMetadataManager().then(module => ({ default: module.CardMetadataManager })));
const ReadingDetailModal = lazy(() => loadReadingDetailModal().then(module => ({ default: module.ReadingDetailModal })));
const Auth = lazy(() => loadAuth().then(module => ({ default: module.Auth })));
const AddTab = lazy(() => loadAddTab().then(module => ({ default: module.AddTab })));
const PrivateTab = lazy(() => loadPrivateTab().then(module => ({ default: module.PrivateTab })));
const PublicTab = lazy(() => loadPublicTab().then(module => ({ default: module.PublicTab })));
const ProfileTab = lazy(() => loadProfileTab().then(module => ({ default: module.ProfileTab })));

const SuspenseFallback = () => (
  <div className="min-h-[220px] space-y-3 rounded-[1.5rem] border border-forest-accent/7 bg-white/24 p-4" role="status" aria-live="polite">
    <div className="h-4 w-28 animate-pulse rounded-full bg-forest-accent/10" />
    <div className="grid gap-2">
      <div className="h-16 animate-pulse rounded-2xl bg-white/46" />
      <div className="h-16 animate-pulse rounded-2xl bg-white/34" />
      <div className="h-16 animate-pulse rounded-2xl bg-white/24" />
    </div>
    <p className="text-center text-[11px] font-medium text-forest-muted">正在展开内容…</p>
  </div>
);

const AuthRestoringScreen = () => (
  <div className="min-h-[100dvh] bg-forest-bg flex items-center justify-center px-6 text-center">
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="flex w-full max-w-xs flex-col items-center gap-4 rounded-[1.6rem] border border-forest-accent/8 bg-white/42 px-5 py-6 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="grid h-14 w-14 place-items-center rounded-[1.4rem] border border-forest-accent/8 bg-white/58 shadow-sm">
        <Sparkles size={24} className="text-forest-accent" />
      </div>
      <div className="space-y-1">
        <p className="font-serif text-2xl font-bold text-forest-ink">塔罗研习阁</p>
        <p className="text-sm font-medium text-forest-muted">正在恢复账号状态…</p>
      </div>
      <div className="grid w-full gap-2">
        <div className="h-2.5 animate-pulse rounded-full bg-forest-accent/8" />
        <div className="mx-auto h-2.5 w-2/3 animate-pulse rounded-full bg-forest-accent/6" />
      </div>
    </motion.div>
  </div>
);

// --- Auth Wrapper ---
type SnackbarState = {
  isOpen: boolean;
  message: string;
  showLoginAction?: boolean;
};

type AppTab = 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile';

const APP_TABS: AppTab[] = ['home', 'add', 'private', 'public', 'metadata', 'profile'];

const isAppTab = (value: string | null): value is AppTab => (
  !!value && APP_TABS.includes(value as AppTab)
);

const getLocalStorageValue = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalStorageValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 非关键偏好写入失败时，不影响主流程。
  }
};

const removeLocalStorageValue = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // 非关键偏好删除失败时，不影响主流程。
  }
};

function AppContent() {
  const { session, isLoading: isAuthLoading, isLocalFallback, isEmailVerified, signOut, updatePassword, sendVerificationEmail } = useAuth();
  const { checkAndUnlockAchievements } = useOnboarding();
  
  const [activeTab, setActiveTab] = usePersistentTab<AppTab>('tarot_active_tab', 'home', isAppTab);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedReadingDetail, setSelectedReadingDetail] = useState<TarotReading | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  
  // Login Prompts
  const [loginPrompt, setLoginPrompt] = useState<{ isOpen: boolean; title: string; content: string }>({
    isOpen: false,
    title: '',
    content: ''
  });

  // Migration Prompt
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCloudLoadingNotice, setShowCloudLoadingNotice] = useState(false);

  // Smart Prompts
  const [snackbar, setSnackbar] = useState<SnackbarState>({ isOpen: false, message: '' });
  const [isVerificationActionLoading, setIsVerificationActionLoading] = useState(false);
  
  // Account Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  // Password Change Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isPasswordUpdateLoading, setIsPasswordUpdateLoading] = useState(false);
  
  const [dailyProverb, setDailyProverb] = useState('');
  const [highlightedReadingId, setHighlightedReadingId] = useState<string | null>(null);
  const [metadataInitialCardId, setMetadataInitialCardId] = useState<string | undefined>(undefined);
  const highlightTimerRef = useRef<number | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);
  const activeTabRef = useRef<AppTab>(activeTab);
  const showAuthPageRef = useRef(showAuthPage);
  const isSidebarOpenRef = useRef(isSidebarOpen);
  const appHistoryReadyRef = useRef(false);
  const skipNextHistoryPushRef = useRef(false);
  const lastBackExitNoticeRef = useRef(0);
  const hasTrackedAppOpenRef = useRef(false);
  const previousAnalyticsUidRef = useRef<string | null | undefined>(undefined);
  const previousTrackedTabRef = useRef<AppTab | null>(null);
  const localFallbackNoticeShownRef = useRef(false);

  // Use custom hook for readings state
  const {
    readings,
    setReadings,
    spreads,
    setSpreads,
    cardMetadata,
    setCardMetadata,
    cardKeywordMemory,
    quizMemory,
    setQuizMemory,
    searchQuery,
    setSearchQuery,
    searchTags,
    setSearchTags,
    isProcessing,
    editingReading,
    setEditingReading,
    handleAddReading,
    handleExtractKeywordCandidates,
    handleConfirmKeywordCandidates,
    handleProcessAi,
    togglePublic,
    handleDeleteReading,
    handleEditReading,
    toggleTag,
    isCloudSyncPaused,
    cloudSyncInfo,
    handleManualCloudSync,
    syncNotice,
    clearSyncNotice,
  } = useReadings(session, isAuthLoading, isLocalFallback);
  const dailyFortune = useDailyFortune(session, isAuthLoading, isLocalFallback);
  useBodyScrollLock(isProcessing);
  useMobileFocusScroll();

  const [publicReadingsCache, setPublicReadingsCache] = useState<TarotReading[]>([]);

  useEffect(() => {
    installCloudflareWebAnalytics();
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    setAnalyticsAuthState(session);

    const currentUid = session?.uid || null;
    const previousUid = previousAnalyticsUidRef.current;
    if (previousUid !== undefined && previousUid !== currentUid) {
      trackEvent(currentUid ? 'login_success' : 'logout', {
        auth_state: currentUid ? 'signed_in' : 'guest',
      });
    }
    previousAnalyticsUidRef.current = currentUid;
  }, [isAuthLoading, session]);

  useEffect(() => {
    if (!hasEnteredApp || isAuthLoading || hasTrackedAppOpenRef.current) return;

    hasTrackedAppOpenRef.current = true;
    trackEvent('app_open', {
      auth_state: session?.uid ? 'signed_in' : 'guest',
    });
  }, [hasEnteredApp, isAuthLoading, session?.uid]);

  useEffect(() => {
    if (!hasEnteredApp) return;
    if (previousTrackedTabRef.current === activeTab) return;

    previousTrackedTabRef.current = activeTab;
    trackEvent('tab_opened', { tab: activeTab });
  }, [activeTab, hasEnteredApp]);

  useEffect(() => {
    if (snackbarTimerRef.current !== null) {
      window.clearTimeout(snackbarTimerRef.current);
      snackbarTimerRef.current = null;
    }

    if (!snackbar.isOpen) return;

    const duration = snackbar.showLoginAction || snackbar.message.startsWith('❌') ? 6500 : 4200;
    snackbarTimerRef.current = window.setTimeout(() => {
      setSnackbar(prev => ({ ...prev, isOpen: false }));
      snackbarTimerRef.current = null;
    }, duration);

    return () => {
      if (snackbarTimerRef.current !== null) {
        window.clearTimeout(snackbarTimerRef.current);
        snackbarTimerRef.current = null;
      }
    };
  }, [snackbar.isOpen, snackbar.message, snackbar.showLoginAction]);

  useEffect(() => {
    if (!syncNotice) return;

    setSnackbar({ isOpen: true, message: syncNotice });
    const timer = window.setTimeout(() => {
      clearSyncNotice();
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [clearSyncNotice, syncNotice]);

  useEffect(() => {
    if (!hasEnteredApp) return;

    if (!isLocalFallback) {
      localFallbackNoticeShownRef.current = false;
      return;
    }

    if (localFallbackNoticeShownRef.current) return;
    localFallbackNoticeShownRef.current = true;
    setSnackbar({
      isOpen: true,
      message: '云端暂时连不上，可能没开 VPN；已进入本地模式，记录会先保存在本机。',
    });
  }, [hasEnteredApp, isLocalFallback]);

  useEffect(() => {
    if (!hasEnteredApp) return;

    warmTarotDeckImages();
  }, [hasEnteredApp]);

  useEffect(() => {
    if (!hasEnteredApp) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleIds: number[] = [];
    const timers: number[] = [];

    const schedulePreload = (callback: () => void, timeout: number, fallbackDelay: number) => {
      if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
        idleIds.push(idleWindow.requestIdleCallback(callback, { timeout }));
        return;
      }

      timers.push(window.setTimeout(callback, fallbackDelay));
    };

    schedulePreload(() => {
      void Promise.allSettled([
        loadAddTab(),
        loadReadingDetailModal(),
      ]);
    }, 2200, 1800);

    schedulePreload(() => {
      void Promise.allSettled([
        loadPrivateTab(),
        loadPublicTab(),
        loadProfileTab(),
      ]);
    }, 6500, 5200);

    schedulePreload(() => {
      void loadCardMetadataManager();
    }, 9500, 8200);

    return () => {
      idleIds.forEach(id => idleWindow.cancelIdleCallback?.(id));
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [hasEnteredApp]);

  const resetPrivateSessionState = useCallback((forceHome = false) => {
    setProfile(null);
    setSelectedReadingDetail(null);
    setEditingReading(null);
    setShowLogoutConfirm(false);
    setIsSecurityModalOpen(false);
    setActiveTab(current => (forceHome || current === 'profile' ? 'home' : current));
  }, [setEditingReading]);

  const realReadings = useMemo(() => readings.filter(r => !r.isExample), [readings]);
  const readingCount = realReadings.length;
  const reviewedReadingCount = useMemo(
    () => realReadings.filter(reading => Boolean(reading.userFeedback?.trim())).length,
    [realReadings],
  );
  const hasPublicReading = realReadings.some(r => r.isPublic);
  const aiUsageCount = realReadings.filter(r => r.interpretation?.combination?.includes('AI') || r.processedByAi).length;
  
  useEffect(() => {
    checkAndUnlockAchievements(readingCount, hasPublicReading, aiUsageCount, 0);
  }, [readingCount, hasPublicReading, aiUsageCount, checkAndUnlockAchievements]);

  useEffect(() => () => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  const scrollPageToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      if (navigator.userAgent.toLowerCase().includes('jsdom')) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        return;
      }

      try {
        window.scrollTo({ top: 0, left: 0, behavior });
      } catch {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    });
  }, []);

  useEffect(() => {
    scrollPageToTop('smooth');
  }, [activeTab, scrollPageToTop]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    showAuthPageRef.current = showAuthPage;
  }, [showAuthPage]);

  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  const { currentTip, isVisible: isTipVisible, dismissTip } = useSmartTips(
    readingCount,
    false,
    false
  );

  const handleTipAction = () => {
    dismissTip();
    if (currentTip?.id === 'no-readings' || currentTip?.id === 'daily-reading') {
      setActiveTab('add');
    }
  };
  const isHomeTipDuplicate = activeTab === 'home' && (
    currentTip?.id === 'no-readings' || currentTip?.id === 'daily-reading'
  );

  const navigateToTab = useCallback((tab: AppTab) => {
    if (tab !== 'add') setEditingReading(null);
    if (tab !== 'metadata') setMetadataInitialCardId(undefined);
    dismissTip();
    setActiveTab(tab);
    scrollPageToTop('smooth');
  }, [dismissTip, scrollPageToTop, setEditingReading, setActiveTab]);

  const handleOpenCardLibrary = useCallback((cardId?: string) => {
    setMetadataInitialCardId(cardId);
    navigateToTab('metadata');
  }, [navigateToTab]);

  const handleManualCloudSyncWithProfile = useCallback(async () => {
    await handleManualCloudSync();

    if (!session?.uid) return;

    try {
      setProfile(await getOrCreateUserProfile(session));
    } catch (error) {
      console.error('Failed to refresh profile during manual sync:', error);
    }
  }, [handleManualCloudSync, session]);

  const handleEnterApp = useCallback(() => {
    trackEvent('splash_enter');
    setActiveTab('home');
    setHasEnteredApp(true);
    scrollPageToTop('auto');
  }, [scrollPageToTop, setActiveTab]);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    dismissTip();
  }, [dismissTip]);

  const openSidebar = useCallback(() => {
    dismissTip();
    setIsSidebarOpen(true);
  }, [dismissTip]);

  useEffect(() => {
    const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom');
    if (!hasEnteredApp || isJsdom) return;

    const createState = (tab: AppTab, root = false) => ({ tarotPavilionApp: true, tab, root });

    try {
      window.history.replaceState(createState(activeTabRef.current, true), '', window.location.href);
      window.history.pushState(createState(activeTabRef.current), '', window.location.href);
      appHistoryReadyRef.current = true;
    } catch {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { tarotPavilionApp?: boolean; tab?: string } | null;
      const currentTab = activeTabRef.current;
      const stateTab = state?.tab || null;
      const incomingTab: AppTab = isAppTab(stateTab) ? stateTab : 'home';

      if (showAuthPageRef.current) {
        setShowAuthPage(false);
        try {
          window.history.pushState(createState(currentTab), '', window.location.href);
        } catch {
          // 浏览器历史不可写时，至少关闭当前浮层。
        }
        return;
      }

      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
        try {
          window.history.pushState(createState(currentTab), '', window.location.href);
        } catch {
          // 浏览器历史不可写时，至少关闭侧边栏。
        }
        return;
      }

      if (incomingTab !== currentTab) {
        skipNextHistoryPushRef.current = true;
        setActiveTab(incomingTab);
        scrollPageToTop('auto');
        return;
      }

      if (currentTab !== 'home') {
        skipNextHistoryPushRef.current = true;
        setActiveTab('home');
        scrollPageToTop('auto');
        return;
      }

      const now = Date.now();
      if (now - lastBackExitNoticeRef.current < 1800) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
      }

      lastBackExitNoticeRef.current = now;
      setSnackbar({ isOpen: true, message: '再按一次返回，离开研习阁。' });
      try {
        window.history.pushState(createState('home'), '', window.location.href);
      } catch {
        // 提示已经出现，历史不可写时不阻断页面。
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      appHistoryReadyRef.current = false;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasEnteredApp, scrollPageToTop, setActiveTab]);

  useEffect(() => {
    const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom');
    if (!hasEnteredApp || !appHistoryReadyRef.current || isJsdom) return;

    const nextState = { tarotPavilionApp: true, tab: activeTab };

    if (skipNextHistoryPushRef.current) {
      skipNextHistoryPushRef.current = false;
      try {
        window.history.replaceState(nextState, '', window.location.href);
      } catch {
        // 忽略非关键历史写入失败。
      }
      return;
    }

    const currentState = window.history.state as { tarotPavilionApp?: boolean; tab?: string } | null;
    if (currentState?.tarotPavilionApp && currentState.tab === activeTab) return;

    try {
      window.history.pushState(nextState, '', window.location.href);
    } catch {
      // 忽略非关键历史写入失败。
    }
  }, [activeTab, hasEnteredApp]);

  const resetSignedOutView = useCallback(() => {
    resetPrivateSessionState(true);
    setSearchQuery('');
    setSearchTags([]);
    setIsSidebarOpen(false);
    setShowAuthPage(false);
    setLoginPrompt(prev => ({ ...prev, isOpen: false }));
  }, [resetPrivateSessionState, setSearchQuery, setSearchTags]);

  useEffect(() => {
    if (!isTipVisible) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-smart-tip-banner]')) return;
      dismissTip();
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, [dismissTip, isTipVisible]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!session) {
      resetSignedOutView();
      removeLocalStorageValue('has_navigated_on_login');
    }
  }, [resetSignedOutView, session, isAuthLoading]);

  useEffect(() => {
    if (!session?.uid || isAuthLoading || isLocalFallback) {
      setShowCloudLoadingNotice(false);
      return;
    }

    setShowCloudLoadingNotice(true);
    const timer = window.setTimeout(() => setShowCloudLoadingNotice(false), 2400);
    return () => window.clearTimeout(timer);
  }, [session?.uid, isAuthLoading, isLocalFallback]);

  // Daily Proverb & First Entry Scroll
  useEffect(() => {
    const today = new Date().toDateString();
    const savedDate = getLocalStorageValue('proverb_date');
    const savedProverb = getLocalStorageValue('proverb_content');

    if (savedDate === today && savedProverb) {
      setDailyProverb(savedProverb);
    } else {
      const randomProverb = PAVILION_PROVERBS[Math.floor(Math.random() * PAVILION_PROVERBS.length)];
      setDailyProverb(randomProverb);
      setLocalStorageValue('proverb_date', today);
      setLocalStorageValue('proverb_content', randomProverb);
    }
  }, [session]);

  // Profile loading
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.uid) {
        setProfile(null);
        return;
      }

      const cachedProfile = getCachedUserProfile(session.uid);
      if (cachedProfile) {
        setProfile(cachedProfile);
      }

      if (isLocalFallback) {
        return;
      }

      try {
        setProfile(await getOrCreateUserProfile(session));
      } catch (error) {
        console.error('Failed to load profile:', error);
        if (cachedProfile) {
          setProfile(cachedProfile);
        }
      }
    };

    loadProfile();
  }, [isLocalFallback, session]);

  // Magic link handling
  useEffect(() => {
    const handleMagicLink = async () => {
      const magicLinkData = checkIfMagicLink();
      if (magicLinkData) {
        try {
          await verifyMagicLink(magicLinkData.mode, magicLinkData.oobCode);
          setShowAuthPage(true);
        } catch (error) {
          console.error('Magic link verification failed:', error);
        }
      }
    };

    handleMagicLink();
  }, []);

  // Handle Migration - Migrate local data to Firebase
  const handleMigration = async (confirm: boolean) => {
    if (!confirm) {
      setShowMigrationPrompt(false);
      return;
    }

    setIsSyncing(true);
    try {
      // Get local data from localStorage
      const localReadings = getLocalStorageValue('tarot_readings');
      const guestReadings = getLocalStorageValue('tarot_guest_data');
      const localSpreads = getLocalStorageValue('tarot_spreads');
      let parsedLocalSpreads: unknown = [];

      try {
        parsedLocalSpreads = localSpreads ? JSON.parse(localSpreads) : [];
      } catch (error) {
        console.warn('Failed to parse local spreads:', error);
      }

      const localSpreadNameMap = Array.isArray(parsedLocalSpreads)
        ? getLegacyCustomSpreadNameMap(parsedLocalSpreads, OFFICIAL_SPREADS)
        : {};
      
      let migratedCount = 0;
      
      // Migrate readings
      const localReadingSources = [localReadings, guestReadings].filter(Boolean);
      if (localReadingSources.length > 0) {
        try {
          const readingsData = localReadingSources.flatMap(source => {
            const parsed = JSON.parse(source as string);
            return Array.isArray(parsed) ? parsed : [];
          });

          if (Array.isArray(readingsData)) {
            const migratedReadings = normalizeLegacyReadingSpreadNames<TarotReading>(
              readingsData.filter((reading: TarotReading) => !reading.isExample && reading.id),
              localSpreadNameMap,
            );
            if (migratedReadings.length > 0) {
              setReadings(prev => {
                const existingIds = new Set(prev.map(reading => reading.id));
                const newReadings = migratedReadings.filter((reading: TarotReading) => !existingIds.has(reading.id));
                migratedCount += newReadings.length;
                return [...newReadings, ...prev];
              });
            }
          }
        } catch (e) {
          console.warn('Failed to migrate local readings:', e);
        }
      }
      
      // Migrate spreads
      if (localSpreads) {
        try {
          const spreadsData = parsedLocalSpreads;
          if (Array.isArray(spreadsData)) {
            const migratedSpreads = normalizeLegacyCustomSpreads(spreadsData, OFFICIAL_SPREADS);
            setSpreads(prev => {
              const existingNames = new Set(prev.map(spread => spread.name));
              const newSpreads = migratedSpreads.filter((spread: SpreadDefinition) => !existingNames.has(spread.name));
              return [...prev, ...newSpreads];
            });
          }
        } catch (e) {
          console.warn('Failed to migrate local spreads:', e);
        }
      }
      
      setShowMigrationPrompt(false);
      setSnackbar({ isOpen: true, message: `✨ 已合并 ${migratedCount} 条本机记录，云端同步成功前会保留本地备份。` });
    } catch (error) {
      console.error('Migration failed:', error);
      setSnackbar({ isOpen: true, message: '❌ 迁移失败，请稍后再试。' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    const verificationPromptKey = session?.uid ? `tarot_email_verification_prompt_${session.uid}` : null;

    setActiveTab('home');
    resetPrivateSessionState(true);
    setSearchQuery('');
    setSearchTags([]);
    setIsSidebarOpen(false);
    setShowAuthPage(false);
    setLoginPrompt(prev => ({ ...prev, isOpen: false }));
    
    if (verificationPromptKey) {
      window.sessionStorage.removeItem(verificationPromptKey);
    }

    try {
      await signOut();
      setSnackbar({ isOpen: true, message: '您已安全离阁，期待下次相逢。' });
    } catch (error: any) {
      setSnackbar({ isOpen: true, message: `❌ ${error.message || '离阁失败，请稍后再试。'}` });
    }
  };

  // Handle Account Delete
  const handleDeleteAccount = async () => {
    if (!session?.uid) return;
    setIsDeletingAccount(true);
    
    try {
      await deleteUserAccountData(session.uid);
      await deleteUserAccount();
      
      setActiveTab('home');
      resetPrivateSessionState(true);
      setSearchQuery('');
      setSearchTags([]);
      setIsSidebarOpen(false);
      setShowAuthPage(false);
      setLoginPrompt(prev => ({ ...prev, isOpen: false }));
      
      setShowDeleteConfirm(false);
      setSnackbar({ isOpen: true, message: '账号已注销，感谢您在研习阁的时光。' });
    } catch (error: any) {
      setSnackbar({ isOpen: true, message: `❌ ${error.message || '注销失败，请稍后再试。'}` });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAuthSignedOut = () => {
    resetSignedOutView();
    setSnackbar({ isOpen: true, message: '您已安全离阁，期待下次相逢。' });
  };

  const handleSendVerificationFromSettings = async () => {
    setIsVerificationActionLoading(true);
    try {
      await sendVerificationEmail();
      setSnackbar({ isOpen: true, message: '✨ 验证邮件已发送，请查收邮箱。' });
    } catch (error: any) {
      setSnackbar({ isOpen: true, message: `❌ ${error.message || '发送验证邮件失败，请稍后再试。'}` });
    } finally {
      setIsVerificationActionLoading(false);
    }
  };

  // Handle add reading with snackbar
  const handleAddReadingWithSnackbar = async (newReading: any) => {
    const savedReading = await handleAddReading(newReading, profile, (msg: string) => {
      setSnackbar({ isOpen: true, message: msg });
    });

    if (savedReading?.id) {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      setHighlightedReadingId(savedReading.id);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedReadingId(null);
        highlightTimerRef.current = null;
      }, 5200);
    }

    setEditingReading(null);
    setSearchQuery('');
    setSearchTags([]);
    setSelectedReadingDetail(null);
    navigateToTab('private');
  };

  // Handle edit reading navigation
  const handleEditReadingNavigate = (reading: TarotReading) => {
    setSelectedReadingDetail(null);
    handleEditReading(reading);
    navigateToTab('add');
  };

  // Handle tag click in public view
  const handlePublicTagClick = (tag: string) => {
    setSearchTags([tag]);
    navigateToTab('private');
  };

  // Handle author click
  const handleAuthorClick = (author: string) => {
    setSnackbar({ isOpen: true, message: `${author} 的公开案例可在广场继续查看。` });
  };

  const ownAuthorName = getAuthorDisplayName(profile, session);

  const sidebarInsights = useMemo(() => {
    const toDayStart = (value?: string) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    };

    const todayStart = toDayStart(new Date().toISOString()) || 0;
    const dayStarts = realReadings
      .map(reading => toDayStart(reading.readingDate || reading.date))
      .filter((day): day is number => day !== null);

    return {
      todayCount: dayStarts.filter(day => day === todayStart).length,
    };
  }, [realReadings]);

  const navigateFromSidebar = useCallback((tab: AppTab) => {
    navigateToTab(tab);
    closeSidebar();
  }, [closeSidebar, navigateToTab]);

  const openAuthFromSidebar = useCallback(() => {
    setShowAuthPage(true);
    closeSidebar();
  }, [closeSidebar]);

  // Sidebar Content
  const sidebarContent = (
    <div className="flex min-h-full flex-col px-4 py-5">
      <div className="mb-5 flex items-center gap-3 px-1">
        <img
          src="/app-icon-192.png"
          alt="塔罗研习阁图标"
          className="h-11 w-11 rounded-2xl shadow-sm"
          draggable={false}
        />
        <div className="min-w-0">
          <h2 className="font-serif text-base font-semibold text-forest-ink">塔罗研习阁</h2>
          <p className="text-[10px] text-forest-muted">灵见手记 · 稳稳同步</p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => navigateFromSidebar('home')}
          className={`group flex min-h-12 w-full items-center justify-between rounded-2xl border px-3 transition-all ${
            activeTab === 'home'
              ? 'border-forest-accent/10 bg-forest-accent/8 text-forest-accent'
              : 'border-forest-accent/7 bg-white/34 text-forest-text hover:bg-white/58'
          }`}
        >
          <div className="flex items-center gap-3">
            <Home size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">回到研习台</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted transition-transform group-hover:translate-x-1" />
        </button>

        <CloudSyncPanel
          session={session}
          cloudSyncInfo={cloudSyncInfo}
          isCloudSyncPaused={isCloudSyncPaused}
          readingCount={readingCount}
          reviewedReadingCount={reviewedReadingCount}
          todayCount={sidebarInsights.todayCount}
          onManualSync={handleManualCloudSyncWithProfile}
          onLogin={openAuthFromSidebar}
          onOpenLibrary={() => navigateFromSidebar('private')}
          onStartReading={() => navigateFromSidebar('add')}
          showPrimaryAction={false}
        />

        <div className="space-y-1.5 rounded-[1.35rem] border border-forest-accent/7 bg-white/24 p-1.5">
          <button
            type="button"
            onClick={() => {
              trackEvent('pwa_install_requested', { source: 'sidebar' });
              requestPwaInstallPrompt({ autoInstall: true, force: true, source: 'sidebar' });
              closeSidebar();
            }}
            className="group flex min-h-11 w-full items-center justify-between rounded-xl px-2.5 text-forest-text transition-all hover:bg-white/54"
          >
            <div className="flex items-center gap-3">
              <Download size={17} className="text-forest-accent" />
              <div className="text-left">
                <span className="block text-sm font-medium">添加到手机桌面</span>
                <span className="text-[10px] text-forest-muted">像 App 一样打开</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-forest-muted transition-transform group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFeedbackModalOpen(true);
              closeSidebar();
            }}
            className="group flex min-h-11 w-full items-center justify-between rounded-xl px-2.5 text-forest-text transition-all hover:bg-white/54"
          >
            <div className="flex items-center gap-3">
              <MessageSquareText size={17} className="text-forest-accent" />
              <div className="text-left">
                <span className="block text-sm font-medium">反馈与建议</span>
                <span className="text-[10px] text-forest-muted">微信 / 邮箱都可以</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-forest-muted transition-transform group-hover:translate-x-1" />
          </button>

          {session && (
            <>
              <button
                type="button"
                onClick={() => navigateFromSidebar('profile')}
                className={`group flex min-h-11 w-full items-center justify-between rounded-xl px-2.5 transition-all hover:bg-white/54 ${
                  activeTab === 'profile' ? 'text-forest-accent' : 'text-forest-text'
                }`}
              >
                <div className="flex items-center gap-3">
                  <User size={17} className="text-forest-accent" />
                  <div className="text-left">
                    <span className="block text-sm font-medium">账号设置</span>
                    <span className="text-[10px] text-forest-muted">{ownAuthorName}</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-forest-muted transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => { setShowLogoutConfirm(true); closeSidebar(); }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-forest-muted transition-all hover:bg-white/54 hover:text-forest-accent"
              >
                <LogOut size={17} />
                <span className="text-sm font-medium">退出登录</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-auto px-2 pt-5 text-center">
        <p className="text-[10px] text-forest-muted/75">版本 v1.2.0 · 研精覃思</p>
      </div>
    </div>
  );

  // Auth Page
  if (showAuthPage) {
    return (
      <div className="relative bg-forest-bg min-h-screen">
        <button 
          onClick={() => setShowAuthPage(false)}
          className="absolute top-6 left-6 z-50 p-2 bg-white/80 backdrop-blur rounded-full shadow-lg border border-forest-border text-forest-muted hover:text-forest-accent transition-all"
        >
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <Suspense fallback={<SuspenseFallback />}>
          <Auth onClose={() => setShowAuthPage(false)} onSignedOut={handleAuthSignedOut} />
        </Suspense>
      </div>
    );
  }

  if (!hasEnteredApp) {
    return <SplashScreen onEnter={handleEnterApp} />;
  }

  if (isAuthLoading) {
    return <AuthRestoringScreen />;
  }

  return (
    <>
    <div>
      <MainLayout
        activeTab={activeTab}
        setActiveTab={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
          navigateToTab(tab);
        }}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={(open) => {
          if (open) openSidebar();
          else closeSidebar();
        }}
        sidebarContent={sidebarContent}
      >
      <AnimatePresence>
        {showCloudLoadingNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 flex items-center gap-2 rounded-xl border border-forest-accent/10 bg-white/80 px-3 py-2 text-xs text-forest-muted shadow-sm"
            role="status"
          >
            <Database size={14} className="shrink-0 text-forest-accent" />
            正在读取云端典籍；本机记录会先保留，完成后自动合并。
          </motion.div>
        )}
      </AnimatePresence>
      {/* Modals */}
      <Modal 
        isOpen={loginPrompt.isOpen} 
        onClose={() => setLoginPrompt(prev => ({ ...prev, isOpen: false }))}
        title={loginPrompt.title}
        icon={<ShieldCheck size={24} />}
      >
        <div className="space-y-6">
          <p>{loginPrompt.content}</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                setLoginPrompt(prev => ({ ...prev, isOpen: false }));
                setShowAuthPage(true);
              }}
              className="w-full py-3 bg-forest-pink text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-forest-pink/20"
            >
              <LogIn size={18} />
              立即登录
            </button>
            <button 
              onClick={() => setLoginPrompt(prev => ({ ...prev, isOpen: false }))}
              className="w-full py-3 text-forest-muted hover:text-forest-accent transition-colors text-sm"
            >
              以后再说
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="退出登录"
        icon={<LogOut size={24} className="text-forest-accent" />}
      >
        <div className="space-y-6 text-center">
          <div className="py-2 space-y-4">
            <p className="font-serif text-xl font-bold text-forest-ink">确认退出当前账号？</p>
            <p className="text-sm text-forest-muted leading-loose px-4">
              退出后仍可浏览本机内容；再次同步云端数据时需要重新登录。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => void handleLogout()}
              className="w-full py-3.5 bg-forest-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-forest-accent/20 hover:opacity-90 transition-all active:scale-[0.98]"
            >
              确认退出
            </button>
            <button 
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full py-3 text-forest-muted hover:text-forest-accent transition-colors text-xs font-bold"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>

      {/* Account Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="确认注销账号"
        icon={<AlertTriangle size={24} className="text-red-500" />}
      >
        <div className="space-y-6 text-center">
          <div className="py-4">
            <p className="text-lg font-bold text-red-600">此操作将永久删除您的账号！</p>
            <p className="text-sm text-forest-muted mt-2 leading-loose">
              删除后，您的所有研习记录、日运数据将被彻底清除，且无法恢复。<br/>
              请确认您的决定。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 bg-forest-bg text-forest-ink rounded-xl text-sm font-bold hover:bg-forest-accent/10 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isDeletingAccount ? '处理中...' : '确认注销'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showMigrationPrompt} 
        onClose={() => handleMigration(false)}
        title="✨ 发现本地记录"
        icon={<Database size={24} />}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-forest-ink font-medium">检测到您在本设备有未同步的研习记录或浏览手记。</p>
            <p className="text-sm text-forest-muted">是否将其同步到您的云端账户，以便多端继续使用？</p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => handleMigration(true)}
              disabled={isSyncing}
              className="w-full py-4 bg-forest-pink text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-forest-pink/20 disabled:opacity-50 hover:opacity-90 transition-all"
            >
              {isSyncing ? '正在归档...' : '是的，立即同步'}
              {!isSyncing && <ArrowRight size={18} />}
            </button>
            <button 
              onClick={() => handleMigration(false)}
              disabled={isSyncing}
              className="w-full py-3 text-forest-muted hover:text-forest-accent transition-colors text-xs font-medium disabled:opacity-50"
            >
              不需要，仅使用本地
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isSecurityModalOpen} 
        onClose={() => setIsSecurityModalOpen(false)} 
        title="账号安全"
      >
        <div className="space-y-4">
          {session && (
            <button
              onClick={() => {
                handleSendVerificationFromSettings();
              }}
              disabled={isEmailVerified || isVerificationActionLoading}
              className="w-full p-4 bg-white rounded-xl border border-forest-border/50 hover:border-forest-accent/50 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-forest-accent/10 flex items-center justify-center">
                    <Mail size={18} className="text-forest-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-forest-ink">邮箱管理</p>
                    <p className="text-xs text-forest-muted">{isEmailVerified ? '邮箱已验证' : '发送验证邮件'}</p>
                  </div>
                </div>
                {isEmailVerified ? (
                  <CheckCircle size={18} className="text-green-500" />
                ) : (
                  <ChevronRight size={18} className="text-forest-muted" />
                )}
              </div>
            </button>
          )}

          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full p-4 bg-white rounded-xl border border-forest-border/50 hover:border-forest-accent/50 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-forest-accent/10 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-forest-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-forest-ink">密码管理</p>
                  <p className="text-xs text-forest-muted">修改登录密码</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-forest-muted" />
            </div>
          </button>

          {session && (
            <button
              onClick={() => {
                setIsSecurityModalOpen(false);
                setShowDeleteConfirm(true);
              }}
              className="w-full p-4 bg-red-50 rounded-xl border border-red-200 hover:border-red-300 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-600">注销账户</p>
                    <p className="text-xs text-red-500/70">永久删除账号及所有记录</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-red-400" />
              </div>
            </button>
          )}

        </div>
      </Modal>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="修改密码"
      >
        <div className="space-y-6">
          <p className="text-xs text-forest-muted">
            为了您的阁中记录安全，请设置独立密码。
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-forest-muted font-bold ml-1">当前密码</label>
              <input 
                id="password-modal-current-input"
                type="password" 
                placeholder="请输入当前密码" 
                className="w-full px-5 py-3.5 bg-white border border-forest-accent/10 rounded-xl text-sm outline-none focus:ring-4 focus:ring-forest-accent/5 transition-all font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-forest-muted font-bold ml-1">新密码</label>
              <input 
                id="password-modal-new-input"
                type="password" 
                placeholder="不少于 6 位" 
                className="w-full px-5 py-3.5 bg-white border border-forest-accent/10 rounded-xl text-sm outline-none focus:ring-4 focus:ring-forest-accent/5 transition-all font-mono"
              />
            </div>
            <button 
              onClick={async () => {
                const currentInput = document.getElementById('password-modal-current-input') as HTMLInputElement;
                const input = document.getElementById('password-modal-new-input') as HTMLInputElement;
                const currentPwd = currentInput?.value;
                const pwd = input?.value;
                if (isPasswordUpdateLoading) return;
                if (!currentPwd) {
                  setSnackbar({ isOpen: true, message: '❌ 请先输入当前密码。' });
                  return;
                }
                if (!pwd || !isValidPassword(pwd)) {
                  setSnackbar({ isOpen: true, message: '❌ 密码强度不足，请至少输入 6 位。' });
                  return;
                }
                
                setIsPasswordUpdateLoading(true);
                
                try {
                  await updatePassword(currentPwd, pwd);
                  currentInput.value = '';
                  input.value = '';
                  setShowPasswordModal(false);
                  setSnackbar({ isOpen: true, message: '✨ 通行密码已更新。' });
                } catch (error: any) {
                  const errorMsg = error.message || '更新失败';
                  if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('interrupted')) {
                    setSnackbar({ isOpen: true, message: '❌ 网络连接失败，请检查网络设置或稍后再试。' });
                  } else {
                    setSnackbar({ isOpen: true, message: `❌ ${errorMsg}` });
                  }
                } finally {
                  setIsPasswordUpdateLoading(false);
                }
              }}
              id="password-modal-update-btn"
              disabled={isPasswordUpdateLoading}
              className="w-full py-3 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50"
            >
              {isPasswordUpdateLoading ? (
                <span className="mx-auto block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                '确认修改'
              )}
            </button>
          </div>
        </div>
      </Modal>

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSent={(message) => setSnackbar({ isOpen: true, message })}
      />

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 100, x: '-50%' }}
            drag="x"
            dragConstraints={{ left: 0, right: 100 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 50) setSnackbar(prev => ({ ...prev, isOpen: false }));
            }}
            className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[250] flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-forest-border bg-white/95 px-4 py-3 text-xs font-medium text-forest-text shadow-2xl backdrop-blur-md sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:w-auto sm:min-w-[320px] sm:text-sm"
          >
            <span className="flex-1">{snackbar.message}</span>
            <div className={`flex items-center gap-3 ${snackbar.showLoginAction ? 'border-l border-forest-border pl-4' : ''}`}>
              {snackbar.showLoginAction && (
                <button 
                  onClick={() => {
                    setSnackbar(prev => ({ ...prev, isOpen: false }));
                    setShowAuthPage(true);
                  }}
                  className="text-forest-pink font-bold hover:opacity-80 transition-opacity whitespace-nowrap"
                >
                  立即登录
                </button>
              )}
              <button 
                onClick={() => setSnackbar(prev => ({ ...prev, isOpen: false }))}
                className="text-forest-muted hover:text-forest-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center bg-forest-text/20 backdrop-blur-sm overscroll-contain"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4 px-8 py-6 bg-white rounded-2xl shadow-2xl"
            >
              <div className="w-12 h-12 border-4 border-forest-accent/20 border-t-forest-accent rounded-full animate-spin" />
              <p className="text-forest-ink font-medium">正在处理...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Tips Banner */}
      {currentTip && !isHomeTipDuplicate && (
        <SmartTipBanner
          tip={currentTip}
          isVisible={isTipVisible}
          onDismiss={dismissTip}
          onAction={handleTipAction}
        />
      )}

      {/* Tab Content */}
      <AnimatePresence initial={false}>
        {activeTab === 'home' && (
          <HomeTab
            session={session}
            profile={profile}
            dailyProverb={dailyProverb}
            readings={readings}
            cardMetadata={cardMetadata}
            quizMemory={quizMemory}
            onUpdateQuizMemory={setQuizMemory}
            isAuthLoading={isAuthLoading}
            dailyFortune={dailyFortune}
            onNavigate={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
              navigateToTab(tab);
            }}
            onOpenCardLibrary={handleOpenCardLibrary}
            onSearch={setSearchQuery}
            onSelectSpread={(spread: string, category?: string) => {
              const spreadDef = spreads.find(s => s.name === spread);
              if (spreadDef) {
                setEditingReading({
                  id: '',
                  userId: '',
                  date: new Date().toISOString(),
                  question: '',
                  cards: [],
                  interpretation: { singleCard: '', combination: '', summary: '' },
                  keywords: [],
                  spread: spread,
                  layoutType: spreadDef.layout,
                  slotLabels: spreadDef.slots,
                  slotPositions: spreadDef.slotPositions || [],
                  isPublic: false,
                  isAnonymous: false,
                  isForClient: false,
                  authorName: '',
                  isExample: false,
                  readingDate: new Date().toISOString(),
                  category: category || ''
                });
                navigateToTab('add');
              }
            }}
          />
        )}

        {activeTab === 'private' && (
          <Suspense fallback={<SuspenseFallback />}>
            <PrivateTab
              readings={readings}
              ownerName={ownAuthorName}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchTags={searchTags}
              onToggleTag={toggleTag}
              onNavigate={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
                navigateToTab(tab);
              }}
              onTogglePublic={togglePublic}
              onDelete={handleDeleteReading}
              onEdit={handleEditReadingNavigate}
              onViewDetails={setSelectedReadingDetail}
              onAuthorClick={handleAuthorClick}
              onProcessAi={handleProcessAi}
              onExtractKeywordCandidates={handleExtractKeywordCandidates}
              onConfirmKeywordCandidates={handleConfirmKeywordCandidates}
              cardMetadata={cardMetadata}
              highlightedReadingId={highlightedReadingId}
            />
          </Suspense>
        )}

        {activeTab === 'public' && (
          <Suspense fallback={<SuspenseFallback />}>
            <PublicTab
              readings={readings}
              cardMetadata={cardMetadata}
              onTagClick={handlePublicTagClick}
              onAuthorClick={handleAuthorClick}
              onProcessAi={handleProcessAi}
              initialPublicReadings={publicReadingsCache}
              onPublicReadingsLoaded={setPublicReadingsCache}
            />
          </Suspense>
        )}

        {activeTab === 'add' && (
          <Suspense fallback={<SuspenseFallback />}>
            <AddTab
              onSubmit={handleAddReadingWithSnackbar}
              isLoading={isProcessing}
              isLoggedIn={!!session}
              userId={session?.uid}
              spreads={spreads}
              onUpdateSpreads={setSpreads}
              cardMetadata={cardMetadata}
              cardKeywordMemory={cardKeywordMemory}
              onUpdateCardMetadata={setCardMetadata}
              initialData={editingReading}
              onCancel={() => {
                const wasEditing = !!editingReading;
                setEditingReading(null);
                navigateToTab(wasEditing ? 'private' : 'home');
              }}
            />
          </Suspense>
        )}

        {activeTab === 'profile' && (
          <Suspense fallback={<SuspenseFallback />}>
            <ProfileTab
              authorName={ownAuthorName}
              profile={profile}
              readings={realReadings}
              cardMetadata={cardMetadata}
              email={session?.email}
              isLoggedIn={!!session}
              isEmailVerified={isEmailVerified}
              onLogin={() => setShowAuthPage(true)}
              onLogout={() => setShowLogoutConfirm(true)}
              onOpenSecurity={() => setIsSecurityModalOpen(true)}
              onBackHome={() => navigateToTab('home')}
              onUpdateProfile={async (updated) => {
                try {
                  if (updated.password) {
                    throw new Error('请在账号安全中修改密码。');
                  }

                  if (Object.keys(updated).length > 0 && session?.uid) {
                    const nextProfile = await updateUserProfile(session.uid, updated);
                    const nextAuthorName = getAuthorDisplayName(nextProfile, session);
                    const profileCloudPending = hasPendingUserProfileUpdate(session.uid);

                    setProfile(nextProfile);
                    setReadings(prev => syncReadingAuthorName(prev, session.uid!, nextAuthorName));
                    setSnackbar({
                      isOpen: true,
                      message: profileCloudPending
                        ? '✨ 账号资料已先保存在本机，联网后会同步到云端。'
                        : '✨ 账号资料已更新。',
                    });
                    return;
                  }

                  setSnackbar({ isOpen: true, message: '✨ 账号资料已更新。' });
                } catch (error: any) {
                  setSnackbar({ isOpen: true, message: `❌ 更新失败: ${error.message}` });
                }
              }}
            />
          </Suspense>
        )}

        {activeTab === 'metadata' && (
          <motion.div key="metadata" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <Suspense fallback={<SuspenseFallback />}>
              <CardMetadataManager
                metadata={cardMetadata}
                onUpdate={setCardMetadata}
                readings={readings}
                dailyFortunes={dailyFortune.fortunes}
                cardKeywordMemory={cardKeywordMemory}
                isLoggedIn={!!session}
                userId={session?.uid}
                initialCardId={metadataInitialCardId}
                ownerName={ownAuthorName}
                onShowSnackbar={(msg) => {
                  setSnackbar({ isOpen: true, message: msg });
                }}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <ReadingDetailModal
          reading={selectedReadingDetail}
          onClose={() => setSelectedReadingDetail(null)}
          onEdit={handleEditReadingNavigate}
        />
      </Suspense>
      </MainLayout>
    </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
