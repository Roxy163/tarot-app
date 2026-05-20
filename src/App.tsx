import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, History, Globe, BookOpen, Search, Sparkles, X, User, Menu, ChevronRight, Settings, Info, LogOut, Database, ShieldCheck, ArrowRight, LogIn, Book, Upload, Moon, Sun, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { TarotReading, SpreadDefinition, TarotCardMetadata, UserProfile } from './types';
import { PAVILION_PROVERBS } from './constants';
import { Modal } from './components/Modal';
import { Auth } from './components/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CardMetadataManager } from './components/CardMetadataManager';
import { checkIfMagicLink, verifyMagicLink } from './lib/firebase';
import { getOrCreateUserProfile, updateUserProfile, replaceUserReadings, saveUserSpreads, saveUserCardMetadata } from './lib/firebaseData';
import { isValidPassword } from './lib/utils';
import { HomeTab } from './components/tabs/HomeTab';
import { AddTab } from './components/tabs/AddTab';
import { PrivateTab } from './components/tabs/PrivateTab';
import { PublicTab } from './components/tabs/PublicTab';
import { ProfileTab } from './components/tabs/ProfileTab';
import { MainLayout } from './components/layouts/MainLayout';
import { useReadings } from './hooks/useReadings';

// --- Auth Wrapper ---
type SnackbarState = {
  isOpen: boolean;
  message: string;
  showLoginAction?: boolean;
};

function AppContent() {
  const { session, isEmailVerified, signOut, updatePassword, sendVerificationEmail, refreshUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile'>('home');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
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
  
  // Narrative Elements
  const [showFirstEntryScroll, setShowFirstEntryScroll] = useState(false);
  const [showPromotionCeremony, setShowPromotionCeremony] = useState<{ isOpen: boolean; rank: string }>({ isOpen: false, rank: '' });
  const [dailyProverb, setDailyProverb] = useState('');

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('tarot_dark_mode');
    return saved ? saved === 'true' : false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('tarot_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  // Use custom hook for readings state
  const {
    readings,
    setReadings,
    spreads,
    setSpreads,
    cardMetadata,
    setCardMetadata,
    searchQuery,
    setSearchQuery,
    searchTags,
    setSearchTags,
    isProcessing,
    editingReading,
    setEditingReading,
    filteredReadings,
    handleAddReading,
    handleProcessAi,
    togglePublic,
    handleDeleteReading,
    handleEditReading,
    toggleTag,
  } = useReadings(session);

  const resetPrivateSessionState = useCallback((forceHome = false) => {
    setProfile(null);
    setSelectedAuthor(null);
    setEditingReading(null);
    setShowFirstEntryScroll(false);
    setShowLogoutConfirm(false);
    setIsSecurityModalOpen(false);
    setActiveTab(current => (forceHome || current === 'profile' ? 'home' : current));
  }, [setEditingReading]);

  const resetSignedOutView = useCallback(() => {
    resetPrivateSessionState(true);
    setSearchQuery('');
    setSearchTags([]);
    setIsSidebarOpen(false);
    setShowAuthPage(false);
    setLoginPrompt(prev => ({ ...prev, isOpen: false }));
  }, [resetPrivateSessionState, setSearchQuery, setSearchTags]);

  useEffect(() => {
    if (!session) {
      resetPrivateSessionState();
    }
  }, [resetPrivateSessionState, session]);

  // Daily Proverb & First Entry Scroll
  useEffect(() => {
    const hasSeenScroll = localStorage.getItem('has_seen_first_entry_scroll');
    if (!hasSeenScroll && session) {
      setShowFirstEntryScroll(true);
    }

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
    if (!session && activeTab === 'profile') {
      setActiveTab('home');
      setLoginPrompt({
        isOpen: true,
        title: '🔒 阁主印鉴受限',
        content: '“阁主印鉴”记录着您的位阶晋升与私人注疏。请执印入阁后查看您的专属成就。'
      });
    }
  }, [activeTab, session]);

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

  // Handle Migration - Migrate local data to Firestore
  const handleMigration = async (confirm: boolean) => {
    if (!confirm) {
      setShowMigrationPrompt(false);
      return;
    }

    setIsSyncing(true);
    try {
      // Get local data from localStorage
      const localReadings = localStorage.getItem('tarot_readings');
      const localSpreads = localStorage.getItem('tarot_spreads');
      
      let migratedCount = 0;
      
      // Migrate readings
      if (localReadings) {
        try {
          const readingsData = JSON.parse(localReadings);
          if (Array.isArray(readingsData)) {
            const migratedReadings = readingsData.filter((reading: TarotReading) => !reading.isExample && reading.id);
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
          const spreadsData = JSON.parse(localSpreads);
          if (Array.isArray(spreadsData)) {
            setSpreads(prev => {
              const existingNames = new Set(prev.map(spread => spread.name));
              const newSpreads = spreadsData.filter((spread: SpreadDefinition) => spread.name && spread.slots && !existingNames.has(spread.name));
              return [...prev, ...newSpreads];
            });
          }
        } catch (e) {
          console.warn('Failed to migrate local spreads:', e);
        }
      }
      
      // Clear local storage after successful migration
      localStorage.removeItem('tarot_readings');
      localStorage.removeItem('tarot_spreads');
      
      setShowMigrationPrompt(false);
      setSnackbar({ isOpen: true, message: `✨ 成功迁移 ${migratedCount} 条记录至云端。` });
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

    resetSignedOutView();
    if (verificationPromptKey) {
      window.sessionStorage.removeItem(verificationPromptKey);
    }

    try {
      await signOut();
      resetSignedOutView();
      setSnackbar({ isOpen: true, message: '您已安全离阁，期待下次相逢。' });
    } catch (error: any) {
      setSnackbar({ isOpen: true, message: `❌ ${error.message || '离阁失败，请稍后再试。'}` });
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
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tarot_pavilion_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSnackbar({ isOpen: true, message: '✨ 典籍已撰录成册，请妥善保存。' });
    } catch (error) {
      console.error('Export failed:', error);
      setSnackbar({ isOpen: true, message: '❌ 撰录失败，请稍后再试。' });
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
        
        if (importedData.readings && Array.isArray(importedData.readings)) {
          const importableReadings = importedData.readings.filter((reading: TarotReading) => (
            !reading.isExample && reading.question && reading.cards && reading.cards.length > 0
          ));

          if (importableReadings.length > 0) {
            setReadings(prev => {
              const existingIds = new Set(prev.map(reading => reading.id));
              const newReadings = importableReadings.filter((reading: TarotReading) => !existingIds.has(reading.id));
              importedCount += newReadings.length;
              return [...newReadings, ...prev];
            });
            
            if (uid) {
              const currentReadings = readings.filter((r: TarotReading) => !r.isExample);
              await replaceUserReadings(uid, [...importableReadings, ...currentReadings]);
            }
          }
        }
        
        if (importedData.spreads && Array.isArray(importedData.spreads)) {
          setSpreads(prev => {
            const existingNames = new Set(prev.map((s: SpreadDefinition) => s.name));
            const newSpreads = importedData.spreads.filter((s: SpreadDefinition) => !existingNames.has(s.name));
            importedCount += newSpreads.length;
            return [...prev, ...newSpreads];
          });
          
          if (uid) {
            await saveUserSpreads(uid, spreads);
          }
        }
        
        if (importedData.cardMetadata && Array.isArray(importedData.cardMetadata)) {
          setCardMetadata(prev => {
            const existingNames = new Set(prev.map((m: TarotCardMetadata) => m.name));
            const newMetadata = importedData.cardMetadata.filter((m: TarotCardMetadata) => !existingNames.has(m.name));
            importedCount += newMetadata.length;
            return [...prev, ...newMetadata];
          });
          
          if (uid) {
            await saveUserCardMetadata(uid, cardMetadata);
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
    await handleAddReading(newReading, profile, (msg: string) => {
      setSnackbar({ isOpen: true, message: msg });
      setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
    });
  };

  // Handle edit reading navigation
  const handleEditReadingNavigate = (reading: TarotReading) => {
    handleEditReading(reading);
    setActiveTab('add');
  };

  // Handle tag click in public view
  const handlePublicTagClick = (tag: string) => {
    setSearchTags([tag]);
    setActiveTab('private');
  };

  // Handle author click
  const handleAuthorClick = (author: string) => {
    setSelectedAuthor(author);
    setActiveTab('profile');
  };

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

      <div className="space-y-1">
        <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">研习导航</p>
        <button 
          onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
            activeTab === 'home' ? 'bg-forest-accent/5 text-forest-accent' : 'hover:bg-forest-accent/5 text-forest-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <History size={18} />
            <span className="text-sm font-medium">研习台</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => { setActiveTab('add'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
            activeTab === 'add' ? 'bg-forest-accent/5 text-forest-accent' : 'hover:bg-forest-accent/5 text-forest-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <Plus size={18} />
            <span className="text-sm font-medium">抽牌手记</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => { setActiveTab('private'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
            activeTab === 'private' ? 'bg-forest-accent/5 text-forest-accent' : 'hover:bg-forest-accent/5 text-forest-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <BookOpen size={18} />
            <span className="text-sm font-medium">阁中典籍</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => { setActiveTab('metadata'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
            activeTab === 'metadata' ? 'bg-forest-accent/5 text-forest-accent' : 'hover:bg-forest-accent/5 text-forest-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <Book size={18} />
            <span className="text-sm font-medium">牌义注疏</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => { setActiveTab('public'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
            activeTab === 'public' ? 'bg-forest-accent/5 text-forest-accent' : 'hover:bg-forest-accent/5 text-forest-text'
          }`}
        >
          <div className="flex items-center gap-3">
            <Globe size={18} />
            <span className="text-sm font-medium">研习广场</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="pt-4">
        <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">数据管理</p>
        <button 
          onClick={() => {
            if (!session) {
              setLoginPrompt({
                isOpen: true,
                title: '🔒 开启数据导出功能',
                content: '登录后，您可以一键导出所有的占卜记录与研习心得。'
              });
              setIsSidebarOpen(false);
              return;
            }
            handleExportData();
            setIsSidebarOpen(false);
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
        >
          <div className="flex items-center gap-3">
            <Database size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">撰录成册 (Beta)</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => { handleImportData(); setIsSidebarOpen(false); }}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
        >
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">载入典籍 (Beta)</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="pt-4">
        <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">阁主管理</p>
        {session ? (
          <div className="space-y-1">
            <button 
              onClick={() => {
                setSelectedAuthor(profile?.display_name || profile?.nickname || session.email?.split('@')[0]);
                setActiveTab('profile');
                setIsSidebarOpen(false);
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
              onClick={() => { setShowLogoutConfirm(true); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-accent/5 text-forest-accent transition-all"
            >
              <LogOut size={18} />
              <span className="text-sm font-medium">封印离阁</span>
            </button>
            <button 
              onClick={() => { setIsSecurityModalOpen(true); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all"
            >
              <ShieldCheck size={18} className="text-forest-accent" />
              <span className="text-sm font-medium">账号安全</span>
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { setShowAuthPage(true); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-pink/10 text-forest-pink transition-all"
          >
            <LogIn size={18} />
            <span className="text-sm font-medium">执印入阁</span>
          </button>
        )}
      </div>

      <div className="pt-4">
        <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">系统设置</p>
        <button 
          onClick={() => { setActiveTab('metadata'); setIsSidebarOpen(false); }}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
        >
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-forest-accent" />
            <span className="text-sm font-medium">牌面属性管理</span>
          </div>
          <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
        </button>
        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all opacity-50 cursor-not-allowed">
          <Info size={18} className="text-forest-accent" />
          <span className="text-sm font-medium">关于研习阁</span>
        </button>
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
        <Auth onClose={() => setShowAuthPage(false)} onSignedOut={handleAuthSignedOut} />
      </div>
    );
  }

  return (
    <MainLayout
      activeTab={activeTab}
      setActiveTab={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
        if (tab !== 'add') setEditingReading(null);
        setActiveTab(tab);
      }}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
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
        title="账号与系统设置"
      >
        <div className="space-y-6">
          {session && (
            <div className="p-6 bg-forest-bg/30 rounded-2xl border border-forest-border/50">
              <div className="flex items-center gap-3 text-forest-ink font-bold mb-3">
                <Mail size={20} className="text-forest-accent" />
                <h4>邮箱验证</h4>
              </div>
              <div className="p-4 bg-white rounded-xl border border-forest-border/30 space-y-3">
                <div className="flex items-start gap-3">
                  {isEmailVerified ? (
                    <CheckCircle size={18} className="text-green-500 mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="text-amber-500 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-forest-ink">
                      {isEmailVerified ? '邮箱已验证' : '邮箱尚未验证'}
                    </p>
                    <p className="text-xs text-forest-muted leading-relaxed">
                      {isEmailVerified
                        ? `${session.email || '当前邮箱'} 已完成验证。`
                        : `请前往 ${session.email || '注册邮箱'} 点击验证链接，完成后刷新状态。`}
                    </p>
                  </div>
                </div>
                {!isEmailVerified && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSendVerificationFromSettings}
                      disabled={isVerificationActionLoading}
                      className="py-2 bg-white border border-forest-accent/20 text-forest-accent rounded-xl text-xs font-bold hover:bg-forest-accent/5 transition-colors disabled:opacity-50"
                    >
                      重发验证邮件
                    </button>
                    <button
                      onClick={handleRefreshVerificationFromSettings}
                      disabled={isVerificationActionLoading}
                      className="py-2 bg-forest-accent text-white rounded-xl text-xs font-bold hover:bg-forest-accent/90 transition-colors disabled:opacity-50"
                    >
                      我已验证
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-6 bg-forest-bg/30 rounded-2xl border border-forest-border/50">
            <div className="flex items-center gap-3 text-forest-ink font-bold mb-3">
              <Moon size={20} className="text-forest-accent" />
              <h4>主题设置</h4>
            </div>
            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-forest-border/30">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-forest-bg-dark' : 'bg-forest-bg'}`}>
                  {isDarkMode ? <Sun size={20} className="text-forest-accent" /> : <Moon size={20} className="text-forest-accent" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-forest-ink">{isDarkMode ? '深色模式' : '浅色模式'}</p>
                  <p className="text-xs text-forest-muted">切换界面主题</p>
                </div>
              </div>
              <button 
                onClick={toggleDarkMode}
                className={`relative w-14 h-7 rounded-full transition-colors ${isDarkMode ? 'bg-forest-accent' : 'bg-forest-border'}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${isDarkMode ? 'left-8' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="p-6 bg-forest-bg/30 rounded-2xl border border-forest-border/50">
            <div className="flex items-center gap-3 text-forest-ink font-bold mb-3">
              <ShieldCheck size={20} className="text-forest-accent" />
              <h4>入阁通行密码</h4>
            </div>
            <p className="text-xs text-forest-muted mb-6 leading-relaxed">
              为了您的阁中记录安全，设置独立密码后，您可以使用密码直接入阁，无需依赖邮箱验证码。
            </p>
            
              <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-forest-muted font-bold ml-1">当前密码</label>
                <input 
                  id="sidebar-current-password-input"
                  type="password" 
                  placeholder="请输入当前密码" 
                  className="w-full px-5 py-3.5 bg-white border border-forest-accent/10 rounded-xl text-sm outline-none focus:ring-4 focus:ring-forest-accent/5 transition-all font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-forest-muted font-bold ml-1">新密码</label>
                <input 
                  id="sidebar-password-input"
                  type="password" 
                  placeholder="不少于 6 位" 
                  className="w-full px-5 py-3.5 bg-white border border-forest-accent/10 rounded-xl text-sm outline-none focus:ring-4 focus:ring-forest-accent/5 transition-all font-mono"
                />
              </div>
              <button 
                onClick={async () => {
                  const currentInput = document.getElementById('sidebar-current-password-input') as HTMLInputElement;
                  const input = document.getElementById('sidebar-password-input') as HTMLInputElement;
                  const button = document.getElementById('sidebar-update-password-btn') as HTMLButtonElement;
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
                  
                  // Show loading state
                  if (button) {
                    button.disabled = true;
                    button.innerHTML = '<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';
                  }
                  
                  try {
                    await updatePassword(currentPwd, pwd);
                    currentInput.value = '';
                    input.value = '';
                    setSnackbar({ isOpen: true, message: '✨ 通行密码已更新。' });
                  } catch (error: any) {
                    const errorMsg = error.message || '更新失败';
                    if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('interrupted')) {
                      setSnackbar({ isOpen: true, message: '❌ 网络连接失败，请检查网络设置或稍后再试。如果问题持续，请尝试使用密码重置功能。' });
                    } else {
                      setSnackbar({ isOpen: true, message: `❌ ${errorMsg}` });
                    }
                  } finally {
                    // Reset button state
                    if (button) {
                      button.disabled = false;
                      button.innerHTML = '更新密码';
                    }
                  }
                  setIsSecurityModalOpen(false);
                }}
                id="sidebar-update-password-btn"
                className="w-full py-3 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50"
              >
                更新密码
              </button>
            </div>
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
            className="fixed inset-0 z-[400] flex items-center justify-center bg-forest-text/20 backdrop-blur-sm"
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

      {/* First Entry Scroll */}
      <AnimatePresence>
        {showFirstEntryScroll && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-forest-text/40 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-lg w-full p-10 rounded-[2rem] shadow-2xl border-4 border-forest-accent/10 text-center space-y-8 relative overflow-hidden bg-white"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />
              
              <Sparkles className="mx-auto text-forest-accent animate-pulse" size={48} />
              
              <div className="space-y-6">
                <h2 className="text-3xl font-serif text-forest-accent leading-relaxed">入阁敕令</h2>
                <p className="text-lg text-forest-text leading-loose font-serif italic">
                  “今有问道者一人，于虚无中开辟一方灵台，赐号‘塔罗研习阁’，汝为第一任阁主。愿汝勤加研习，自注牌义，成一家之言。”
                </p>
              </div>

              <button 
                onClick={() => {
                  setShowFirstEntryScroll(false);
                  localStorage.setItem('has_seen_first_entry_scroll', 'true');
                }}
                className="px-10 py-4 bg-forest-pink text-white rounded-full font-bold text-lg hover:bg-forest-pink/90 transition-all shadow-xl shadow-forest-pink/30"
              >
                执印入阁
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promotion Ceremony */}
      <AnimatePresence>
        {showPromotionCeremony.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPromotionCeremony({ isOpen: false, rank: '' })}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-white/30 backdrop-blur-xl cursor-pointer"
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
      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <HomeTab
            session={session}
            profile={profile}
            dailyProverb={dailyProverb}
            readings={readings}
            cardMetadata={cardMetadata}
            onNavigate={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
              if (tab !== 'add') setEditingReading(null);
              setActiveTab(tab);
            }}
            onSearch={setSearchQuery}
          />
        )}

        {activeTab === 'private' && (
          <PrivateTab
            readings={readings}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchTags={searchTags}
            onToggleTag={toggleTag}
            onNavigate={(tab: 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile') => {
              if (tab !== 'add') setEditingReading(null);
              setActiveTab(tab);
            }}
            onTogglePublic={togglePublic}
            onDelete={handleDeleteReading}
            onEdit={handleEditReadingNavigate}
            onAuthorClick={handleAuthorClick}
            onProcessAi={handleProcessAi}
            cardMetadata={cardMetadata}
          />
        )}

        {activeTab === 'public' && (
          <PublicTab
            readings={readings}
            cardMetadata={cardMetadata}
            onTagClick={handlePublicTagClick}
            onAuthorClick={handleAuthorClick}
            onProcessAi={handleProcessAi}
          />
        )}

        {activeTab === 'add' && (
          <AddTab
            onSubmit={handleAddReadingWithSnackbar}
            isLoading={isProcessing}
            isLoggedIn={!!session}
            userId={session?.uid}
            spreads={spreads}
            onUpdateSpreads={setSpreads}
            cardMetadata={cardMetadata}
            onUpdateCardMetadata={setCardMetadata}
            initialData={editingReading}
            onCancel={() => { setEditingReading(null); setActiveTab('home'); }}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            authorName={selectedAuthor || '研习阁主'}
            profile={profile}
            readings={readings}
            cardMetadata={cardMetadata}
            onLogout={() => setShowLogoutConfirm(true)}
            onUpdateProfile={async (updated) => {
              try {
                if (updated.password) {
                  throw new Error('请在账号安全中修改密码。');
                }

                if (Object.keys(updated).length > 0 && session?.uid) {
                  setProfile(await updateUserProfile(session.uid, updated));
                }

                setSnackbar({ isOpen: true, message: '✨ 印鉴已更新，阁主气象一新。' });
              } catch (error: any) {
                setSnackbar({ isOpen: true, message: `❌ 更新失败: ${error.message}` });
              }
            }}
            onTagClick={(tag) => {
              setSearchTags([tag]);
              setActiveTab('private');
            }}
            onViewAll={() => setActiveTab('private')}
            onEditReading={handleEditReadingNavigate}
            onDeleteReading={handleDeleteReading}
            onTogglePublic={togglePublic}
          />
        )}

        {activeTab === 'metadata' && (
          <motion.div key="metadata" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <CardMetadataManager 
              metadata={cardMetadata}
              onUpdate={setCardMetadata}
              readings={readings}
              isLoggedIn={!!session}
              userId={session?.uid}
              onShowSnackbar={(msg) => {
                setSnackbar({ isOpen: true, message: msg });
                setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
