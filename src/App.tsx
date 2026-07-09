import React, { Suspense, lazy, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Globe, Sparkles, X, User, ChevronRight, Info, LogOut, Database, ShieldCheck, ArrowRight, LogIn, Book, Upload, Moon, CheckCircle, AlertTriangle, Mail, Home } from 'lucide-react';
import { TarotReading, SpreadDefinition, TarotCardMetadata, UserProfile } from './types';
import { OFFICIAL_SPREADS, PAVILION_PROVERBS, TAROT_CARDS } from './constants';
import { Modal } from './components/Modal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { checkIfMagicLink, verifyMagicLink, deleteUserAccount } from './lib/firebase';
import { getOrCreateUserProfile, updateUserProfile, replaceUserReadings, saveUserSpreads, saveUserCardMetadata, deleteUserAccount as deleteUserAccountData } from './lib/firebaseData';
import { isValidPassword } from './lib/utils';
import { HomeTab } from './components/tabs/HomeTab';
import { MainLayout } from './components/layouts/MainLayout';
import { useReadings } from './hooks/useReadings';
import { useOnboarding } from './context/OnboardingContext';
import { SmartTipBanner } from './components/onboarding/SmartTipBanner';
import { FeatureSpotlightGuide, FeatureSpotlightStep } from './components/onboarding/FeatureSpotlightGuide';
import { useSmartTips } from './hooks/useSmartTips';
import { usePersistentTab } from './hooks/usePersistentTab';
import {
  getLegacyCustomSpreadNameMap,
  normalizeLegacyCustomSpreads,
  normalizeLegacyReadingSpreadNames,
} from './lib/spreadPersistence';
import { createTarotExportPdfBlob } from './lib/pdfExport';
import { getAuthorDisplayName, syncReadingAuthorName } from './lib/readingAuthor';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';

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
  <div className="min-h-[220px] flex items-center justify-center text-forest-muted text-xs font-bold">
    正在展开阁中卷册...
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

const FEATURE_SPOTLIGHT_STORAGE_KEY = 'tarot_feature_spotlight_seen_v3';

const FEATURE_SPOTLIGHT_STEPS: FeatureSpotlightStep[] = [
  {
    target: '[data-tour="daily-draw"]',
    title: '先抽今天的一张牌',
    description: '洗牌输入数字，也可录入现实牌。',
    mobileNote: 'right-top',
  },
  {
    target: '[data-tour="daily-review"]',
    title: '回看每日对应',
    description: '晚上看这张牌对应了什么事。',
    mobileNote: 'right-middle',
  },
  {
    target: '[data-tour="library-review"]',
    title: '进入典籍复盘',
    description: '回看自己的手记和客户记录。',
    mobileNote: 'right-middle',
  },
  {
    target: '[data-tour="card-annotations"]',
    title: '整理你的牌义',
    description: '把新理解写进单牌注疏。',
    mobileNote: 'below-center',
  },
];

function AppContent() {
  const { session, isLoading: isAuthLoading, isEmailVerified, signOut, updatePassword, sendVerificationEmail, refreshUser } = useAuth();
  const { state: onboardingState, checkAndUnlockAchievements } = useOnboarding();
  
  const [activeTab, setActiveTab] = usePersistentTab<AppTab>('tarot_active_tab', 'home', isAppTab);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedReadingDetail, setSelectedReadingDetail] = useState<TarotReading | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Login Prompts
  const [loginPrompt, setLoginPrompt] = useState<{ isOpen: boolean; title: string; content: string }>({
    isOpen: false,
    title: '',
    content: ''
  });

  // Migration Prompt
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Smart Prompts
  const [snackbar, setSnackbar] = useState<SnackbarState>({ isOpen: false, message: '' });
  const [isVerificationActionLoading, setIsVerificationActionLoading] = useState(false);
  
  // Account Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [hasNavigatedOnLogin, setHasNavigatedOnLogin] = useState(false);
  
  // Password Change Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Narrative Elements
  const [showPromotionCeremony, setShowPromotionCeremony] = useState<{ isOpen: boolean; rank: string }>({ isOpen: false, rank: '' });
  const [dailyProverb, setDailyProverb] = useState('');
  const [formQuestion, setFormQuestion] = useState('');
  const [hasCards, setHasCards] = useState(false);
  const [highlightedReadingId, setHighlightedReadingId] = useState<string | null>(null);
  const [isFeatureSpotlightOpen, setIsFeatureSpotlightOpen] = useState(false);
  const highlightTimerRef = useRef<number | null>(null);
  const snackbarTimerRef = useRef<number | null>(null);

  // Use custom hook for readings state
  const {
    readings,
    setReadings,
    spreads,
    setSpreads,
    cardMetadata,
    setCardMetadata,
    cardKeywordMemory,
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
    syncNotice,
    clearSyncNotice,
  } = useReadings(session, isAuthLoading);
  useBodyScrollLock(isProcessing || showPromotionCeremony.isOpen);

  const [publicReadingsCache, setPublicReadingsCache] = useState<TarotReading[]>([]);

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
    const preloadTabs = () => {
      void Promise.allSettled([
        loadAddTab(),
        loadPrivateTab(),
        loadPublicTab(),
        loadProfileTab(),
        loadCardMetadataManager(),
        loadReadingDetailModal(),
      ]);
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(preloadTabs, { timeout: 2500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timer = window.setTimeout(preloadTabs, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const resetPrivateSessionState = useCallback((forceHome = false) => {
    setProfile(null);
    setSelectedAuthor(null);
    setSelectedReadingDetail(null);
    setEditingReading(null);
    setShowLogoutConfirm(false);
    setIsSecurityModalOpen(false);
    setActiveTab(current => (forceHome || current === 'profile' ? 'home' : current));
  }, [setEditingReading]);

  const realReadings = useMemo(() => readings.filter(r => !r.isExample), [readings]);
  const readingCount = realReadings.length;
  const customSpreadCount = useMemo(
    () => spreads.filter(spread => !OFFICIAL_SPREADS.some(official => official.name === spread.name)).length,
    [spreads],
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
    if (!onboardingState.hasCompletedFirstEntry || activeTab !== 'home') return;
    if (localStorage.getItem(FEATURE_SPOTLIGHT_STORAGE_KEY) === 'true') return;

    const timer = window.setTimeout(() => {
      setIsFeatureSpotlightOpen(true);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [activeTab, onboardingState.hasCompletedFirstEntry]);

  const finishFeatureSpotlight = useCallback(() => {
    localStorage.setItem(FEATURE_SPOTLIGHT_STORAGE_KEY, 'true');
    setIsFeatureSpotlightOpen(false);
  }, []);

  const { currentTip, isVisible: isTipVisible, dismissTip } = useSmartTips(
    readingCount,
    !!formQuestion,
    hasCards
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
    dismissTip();
    setActiveTab(tab);
    scrollPageToTop('smooth');
  }, [dismissTip, scrollPageToTop, setEditingReading, setActiveTab]);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    dismissTip();
  }, [dismissTip]);

  const openSidebar = useCallback(() => {
    dismissTip();
    setIsSidebarOpen(true);
  }, [dismissTip]);

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
      setHasNavigatedOnLogin(false);
      localStorage.removeItem('has_navigated_on_login');
    } else if (!hasNavigatedOnLogin && !localStorage.getItem('has_navigated_on_login')) {
      setHasNavigatedOnLogin(true);
      localStorage.setItem('has_navigated_on_login', 'true');
      setActiveTab('profile');
    }
  }, [resetSignedOutView, session, hasNavigatedOnLogin, isAuthLoading]);

  // Daily Proverb & First Entry Scroll
  useEffect(() => {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('proverb_date');
    const savedProverb = localStorage.getItem('proverb_content');

    if (savedDate === today && savedProverb) {
      setDailyProverb(savedProverb);
    } else {
      const randomProverb = PAVILION_PROVERBS[Math.floor(Math.random() * PAVILION_PROVERBS.length)];
      setDailyProverb(randomProverb);
      localStorage.setItem('proverb_date', today);
      localStorage.setItem('proverb_content', randomProverb);
    }
  }, [session]);

  // Security check for restricted pages
  useEffect(() => {
    if (isAuthLoading) return;

    if (!session && activeTab === 'profile') {
      setActiveTab('home');
      setLoginPrompt({
        isOpen: true,
        title: '🔒 阁主印鉴受限',
        content: '“阁主印鉴”记录着您的位阶晋升与私人注疏。请执印入阁后查看您的专属成就。'
      });
    }
  }, [activeTab, session, isAuthLoading]);

  // Profile loading
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.uid) {
        setProfile(null);
        return;
      }

      try {
        setProfile(await getOrCreateUserProfile(session));
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };

    loadProfile();
  }, [session]);

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
      const localReadings = localStorage.getItem('tarot_readings');
      const guestReadings = localStorage.getItem('tarot_guest_data');
      const localSpreads = localStorage.getItem('tarot_spreads');
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

  const handleRefreshVerificationFromSettings = async () => {
    setIsVerificationActionLoading(true);
    try {
      await refreshUser();
      setSnackbar({ isOpen: true, message: '✨ 邮箱验证状态已刷新。' });
    } catch (error: any) {
      setSnackbar({ isOpen: true, message: `❌ ${error.message || '刷新验证状态失败，请稍后再试。'}` });
    } finally {
      setIsVerificationActionLoading(false);
    }
  };

  // Handle Export Data
  const handleExportData = () => {
    try {
      const exportData = {
        readings: readings.filter(r => !r.isExample),
        spreads,
        cardMetadata,
        profile,
        exportDate: new Date().toISOString(),
        version: '1.2.0'
      };
      
      const blob = createTarotExportPdfBlob(exportData);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tarot_pavilion_export_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSnackbar({ isOpen: true, message: '✨ 典籍 PDF 已撰录成册，请妥善保存。' });
    } catch (error) {
      console.error('Export failed:', error);
      setSnackbar({ isOpen: true, message: '❌ PDF 撰录失败，请稍后再试。' });
    }
  };

  // Handle Import Data
  const handleImportData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        let importedCount = 0;
        const uid = session?.uid;
        const importedSpreadNameMap = Array.isArray(importedData.spreads)
          ? getLegacyCustomSpreadNameMap(importedData.spreads, OFFICIAL_SPREADS)
          : {};
        
        if (importedData.readings && Array.isArray(importedData.readings)) {
          const importableReadings = normalizeLegacyReadingSpreadNames<TarotReading>(
            importedData.readings.filter((reading: TarotReading) => (
              !reading.isExample && reading.question && reading.cards && reading.cards.length > 0
            )),
            importedSpreadNameMap,
          );

          if (importableReadings.length > 0) {
            const currentReadings = readings.filter((r: TarotReading) => !r.isExample);
            const existingIds = new Set(currentReadings.map(reading => reading.id));
            const newReadings = importableReadings.filter((reading: TarotReading) => !existingIds.has(reading.id));
            const nextReadings = [...newReadings, ...currentReadings];

            importedCount += newReadings.length;
            setReadings(prev => [...newReadings, ...prev]);

            if (uid) {
              await replaceUserReadings(uid, nextReadings);
            }
          }
        }
        
        if (importedData.spreads && Array.isArray(importedData.spreads)) {
          const existingNames = new Set(spreads.map((s: SpreadDefinition) => s.name));
          const importedSpreads = normalizeLegacyCustomSpreads(importedData.spreads, OFFICIAL_SPREADS);
          const newSpreads = importedSpreads.filter((s: SpreadDefinition) => !existingNames.has(s.name));
          const nextSpreads = [...spreads, ...newSpreads];

          importedCount += newSpreads.length;
          setSpreads(nextSpreads);
          
          if (uid) {
            await saveUserSpreads(uid, nextSpreads);
          }
        }
        
        if (importedData.cardMetadata && Array.isArray(importedData.cardMetadata)) {
          const existingNames = new Set(cardMetadata.map((m: TarotCardMetadata) => m.name));
          const newMetadata = importedData.cardMetadata.filter((m: TarotCardMetadata) => !existingNames.has(m.name));
          const nextMetadata = [...cardMetadata, ...newMetadata];

          importedCount += newMetadata.length;
          setCardMetadata(nextMetadata);
          
          if (uid) {
            await saveUserCardMetadata(uid, nextMetadata);
          }
        }
        
        setSnackbar({ isOpen: true, message: `✨ 成功导入 ${importedCount} 条记录。` });
      } catch (error) {
        console.error('Import failed:', error);
        setSnackbar({ isOpen: true, message: '❌ 载入失败，请检查文件格式。' });
      }
    };
    input.click();
  };

  // Check Rank Promotion
  const checkRankPromotion = (count: number) => {
    const ranks: { threshold: number; rank: string }[] = [
      { threshold: 3, rank: '初窥门径' },
      { threshold: 7, rank: '登堂入室' },
      { threshold: 15, rank: '融会贯通' },
      { threshold: 30, rank: '炉火纯青' },
      { threshold: 50, rank: '登峰造极' },
    ];

    const achievedRank = ranks.find(r => count >= r.threshold);
    if (achievedRank) {
      const lastRank = localStorage.getItem('last_rank');
      if (lastRank !== achievedRank.rank) {
        localStorage.setItem('last_rank', achievedRank.rank);
        setShowPromotionCeremony({ isOpen: true, rank: achievedRank.rank });
      }
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
    setSelectedAuthor(author);
    navigateToTab('profile');
  };

  const ownAuthorName = getAuthorDisplayName(profile, session);
  const isViewingOwnProfile = !selectedAuthor || selectedAuthor === ownAuthorName;
  const profileReadings = useMemo(() => {
    if (isViewingOwnProfile) return readings;

    const byId = new Map<string, TarotReading>();
    [...publicReadingsCache, ...readings].forEach(reading => {
      if (!reading.isPublic && reading.userId === 'public') return;
      byId.set(reading.id, reading);
    });

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [isViewingOwnProfile, publicReadingsCache, readings]);

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

  // Sidebar Content
  const sidebarContent = (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-forest-accent to-forest-pink flex items-center justify-center">
          <Sparkles className="text-white" size={20} />
        </div>
        <div>
          <h2 className="font-serif font-bold text-forest-ink">塔罗研习阁</h2>
          <p className="text-[10px] text-forest-muted">灵见手记 · 智慧传承</p>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => navigateFromSidebar('home')}
          className={`w-full min-h-12 flex items-center justify-between p-3 rounded-xl transition-all group ${
            activeTab === 'home' ? 'bg-forest-accent/10 text-forest-accent' : 'bg-white hover:bg-forest-accent/5 text-forest-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <Home size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">回到研习台</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>

        <section className="rounded-2xl bg-forest-bg/70 border border-forest-accent/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-forest-muted font-bold uppercase tracking-widest">数据保险箱</p>
              <p className="text-sm text-forest-ink font-bold mt-1">
                {session ? '云端身份已连接' : '访客本机暂存'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              session
                ? (isCloudSyncPaused ? 'bg-amber-100 text-amber-600' : 'bg-forest-accent/10 text-forest-accent')
                : 'bg-forest-muted/10 text-forest-muted'
            }`}>
              {session && !isCloudSyncPaused ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            </div>
          </div>

          <div className="rounded-xl bg-white/70 border border-forest-accent/5 p-3">
            <p className={`text-xs font-bold ${isCloudSyncPaused ? 'text-amber-700' : 'text-forest-accent'}`}>
              {session
                ? (isCloudSyncPaused ? '云端暂不可用，本机记录已保留' : '云端同步保护已开启')
                : '登录后可跨设备同步典籍'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-forest-muted">
              {session
                ? '典籍会合并云端与本机记录，不会因为新设备本地为空就覆盖云端。'
                : '当前记录只保存在这台设备，登录后再合并到云端。'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/70 border border-forest-accent/5 p-2">
              <p className="font-serif text-lg font-bold text-forest-accent">{readingCount}</p>
              <p className="text-[9px] font-bold text-forest-muted">典籍</p>
            </div>
            <div className="rounded-xl bg-white/70 border border-forest-accent/5 p-2">
              <p className="font-serif text-lg font-bold text-forest-accent">{customSpreadCount}</p>
              <p className="text-[9px] font-bold text-forest-muted">自建牌阵</p>
            </div>
            <div className="rounded-xl bg-white/70 border border-forest-accent/5 p-2">
              <p className="font-serif text-lg font-bold text-forest-accent">{sidebarInsights.todayCount}</p>
              <p className="text-[9px] font-bold text-forest-muted">今日</p>
            </div>
          </div>

          <button
            onClick={() => navigateFromSidebar(readingCount > 0 ? 'private' : 'add')}
            className="w-full min-h-11 px-4 rounded-xl bg-forest-accent text-white text-sm font-bold hover:bg-forest-accent/90 transition-colors flex items-center justify-center gap-2"
          >
            {readingCount > 0 ? '进入典籍复盘' : '写第一条手记'}
            <ChevronRight size={16} />
          </button>
        </section>

        <section className="space-y-2">
          <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest">备份与恢复</p>
        <button 
          onClick={() => {
            if (!session) {
              setLoginPrompt({
                isOpen: true,
                title: '🔒 开启数据导出功能',
                content: '登录后，您可以一键导出所有的占卜记录与研习心得。'
              });
              closeSidebar();
              return;
            }
            handleExportData();
            closeSidebar();
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
        >
          <div className="flex items-center gap-3">
            <Database size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">下载典籍 PDF</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => { handleImportData(); closeSidebar(); }}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
        >
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">载入 JSON 备份</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        </section>

        <section className="space-y-2">
          <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest">账号与设置</p>
          <div className="space-y-1 rounded-2xl bg-white border border-forest-accent/10 p-1.5 shadow-sm">
            {session ? (
              <>
            <button
              onClick={() => {
                setSelectedAuthor(profile?.display_name || profile?.nickname || session.email?.split('@')[0]);
                navigateToTab('profile');
                closeSidebar();
              }}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
                activeTab === 'profile' ? 'bg-forest-accent/5 text-forest-accent' : 'hover:bg-forest-accent/5 text-forest-text'
              }`}
            >
              <div className="flex items-center gap-3">
                <User size={18} />
                <span className="text-sm font-medium">阁主印鉴</span>
              </div>
              <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => { setIsSecurityModalOpen(true); closeSidebar(); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all"
            >
              <ShieldCheck size={18} className="text-forest-accent" />
              <span className="text-sm font-medium">账号安全</span>
            </button>
              </>
            ) : (
              <button
                onClick={() => { setShowAuthPage(true); closeSidebar(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
              >
                <div className="flex items-center gap-3">
                  <LogIn size={18} className="text-forest-accent" />
                  <span className="text-sm font-medium">登录并开启同步</span>
                </div>
                <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
              </button>
            )}
        <button
          onClick={() => {
            setEditingReading(null);
            navigateToTab('home');
            scrollPageToTop('auto');
            setIsFeatureSpotlightOpen(true);
            closeSidebar();
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
        >
          <div className="flex items-center gap-3">
            <Info size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">重新查看功能导览</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
            {session && (
              <button
                onClick={() => { setShowLogoutConfirm(true); closeSidebar(); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-accent/5 text-forest-accent transition-all"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">封印离阁</span>
              </button>
            )}
          </div>
        </section>
      </div>

      <div className="p-6 border-t border-forest-border text-center">
        <p className="text-[10px] text-forest-muted">版本 v1.2.0 · 研精覃思</p>
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
        session={session}
        profile={profile}
        selectedAuthor={selectedAuthor}
        setSelectedAuthor={setSelectedAuthor}
        onShowAuth={() => setShowAuthPage(true)}
        sidebarContent={sidebarContent}
      >
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
        title="封印离阁"
        icon={<LogOut size={24} className="text-forest-accent" />}
      >
        <div className="space-y-6 text-center">
          <div className="py-2 space-y-4">
            <p className="text-forest-ink font-serif text-xl font-bold italic">“阁中烛火未熄，以此一别，期待归期。”</p>
            <p className="text-sm text-forest-muted leading-loose px-4">
              阁主确定要暂时封印您的印鉴吗？<br />
              离阁后，私人注疏将受到保护，再次入阁需重新执印验证。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => void handleLogout()}
              className="w-full py-3.5 bg-forest-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-forest-accent/20 hover:opacity-90 transition-all active:scale-[0.98]"
            >
              确定离阁
            </button>
            <button 
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full py-3 text-forest-muted hover:text-forest-accent transition-colors text-xs font-bold"
            >
              稍作停留
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
            <p className="text-sm text-forest-muted">是否将其同步到您的云端账户，以便开启多端执印入阁？</p>
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
                const button = document.getElementById('password-modal-update-btn') as HTMLButtonElement;
                const currentPwd = currentInput?.value;
                const pwd = input?.value;
                if (!currentPwd) {
                  setSnackbar({ isOpen: true, message: '❌ 请先输入当前密码。' });
                  return;
                }
                if (!pwd || !isValidPassword(pwd)) {
                  setSnackbar({ isOpen: true, message: '❌ 密码强度不足，请至少输入 6 位。' });
                  return;
                }
                
                if (button) {
                  button.disabled = true;
                  button.innerHTML = '<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';
                }
                
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
                  if (button) {
                    button.disabled = false;
                    button.innerHTML = '确认修改';
                  }
                }
              }}
              id="password-modal-update-btn"
              className="w-full py-3 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50"
            >
              确认修改
            </button>
          </div>
        </div>
      </Modal>

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
            className="fixed bottom-8 left-1/2 z-[250] bg-white/95 text-forest-text px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium backdrop-blur-md border border-forest-border flex items-center gap-4 min-w-[320px] max-w-[90vw]"
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

      {/* Promotion Ceremony */}
      <AnimatePresence>
        {showPromotionCeremony.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPromotionCeremony({ isOpen: false, rank: '' })}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-white/30 backdrop-blur-xl cursor-pointer overscroll-contain"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-6"
            >
              <div className="relative inline-block">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-forest-accent/20 rounded-full blur-3xl scale-150"
                />
                <div className="relative p-8 bg-white/70 rounded-full border-4 border-forest-accent shadow-2xl">
                  <ShieldCheck size={80} className="text-forest-accent" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-4xl font-serif text-forest-accent font-bold tracking-widest">位阶晋升</h2>
                <p className="text-xl text-forest-text font-serif">
                  恭贺阁主，灵见通达，特擢升为 <span className="text-forest-accent underline underline-offset-8 decoration-wavy">“{showPromotionCeremony.rank}”</span>
                </p>
              </div>
              
              <p className="text-sm text-forest-muted animate-bounce mt-12">点击任意处继续研习</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Content */}
      <AnimatePresence initial={false}>
        {activeTab === 'home' && (
          <HomeTab
            session={session}
            profile={profile}
            dailyProverb={dailyProverb}
            readings={readings}
            cardMetadata={cardMetadata}
            onNavigate={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
              navigateToTab(tab);
            }}
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
              authorName={selectedAuthor || ownAuthorName}
              profile={isViewingOwnProfile ? profile : null}
              readings={profileReadings}
              cardMetadata={cardMetadata}
              onLogout={() => setShowLogoutConfirm(true)}
              onUpdateProfile={async (updated) => {
                try {
                  if (updated.password) {
                    throw new Error('请在账号安全中修改密码。');
                  }

                  if (Object.keys(updated).length > 0 && session?.uid) {
                    const previousAuthorName = ownAuthorName;
                    const nextProfile = await updateUserProfile(session.uid, updated);
                    const nextAuthorName = getAuthorDisplayName(nextProfile, session);

                    setProfile(nextProfile);
                    setReadings(prev => syncReadingAuthorName(prev, session.uid!, nextAuthorName));
                    setSelectedAuthor(current => current === previousAuthorName ? nextAuthorName : current);
                  }

                  setSnackbar({ isOpen: true, message: '✨ 印鉴已更新，阁主气象一新。' });
                } catch (error: any) {
                  setSnackbar({ isOpen: true, message: `❌ 更新失败: ${error.message}` });
                }
              }}
              onTagClick={(tag) => {
                setSearchTags([tag]);
                navigateToTab('private');
              }}
              onViewAll={() => navigateToTab('private')}
              onEditReading={handleEditReadingNavigate}
              onDeleteReading={handleDeleteReading}
              onTogglePublic={togglePublic}
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
                cardKeywordMemory={cardKeywordMemory}
                isLoggedIn={!!session}
                userId={session?.uid}
                onAddReading={handleAddReadingWithSnackbar}
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
    <FeatureSpotlightGuide
      isOpen={isFeatureSpotlightOpen && activeTab === 'home'}
      steps={FEATURE_SPOTLIGHT_STEPS}
      onFinish={finishFeatureSpotlight}
    />
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
