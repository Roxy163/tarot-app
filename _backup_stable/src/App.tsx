import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, History, Globe, BookOpen, Search, Sparkles, X, User, Menu, ChevronRight, Settings, Info, LogOut, Database, ShieldCheck, Save, ArrowRight, LogIn, Book } from 'lucide-react';
import { extractKeywords, recognizeCards } from './services/geminiService';
import { TarotReading, SpreadDefinition, TarotCardMetadata, UserProfile } from './types';
import { INITIAL_READINGS, OFFICIAL_SPREADS, TAROT_CARDS, PAVILION_PROVERBS } from './constants';
import { TabButton } from './components/TabButton';
import { ReadingCard } from './components/ReadingCard';
import { AddReadingForm } from './components/AddReadingForm';
import { ProfileView } from './components/ProfileView';
import { CardMetadataManager } from './components/CardMetadataManager';
import { StudyPavilionModules } from './components/StudyPavilionModules';
import { Modal } from './components/Modal';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';

// --- Main Application ---

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile'>('home');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<TarotReading | null>(null);
  const [showAuthPage, setShowAuthPage] = useState(false);
  
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
  const [snackbar, setSnackbar] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  
  // Narrative Elements
  const [showFirstEntryScroll, setShowFirstEntryScroll] = useState(false);
  const [showPromotionCeremony, setShowPromotionCeremony] = useState<{ isOpen: boolean; rank: string }>({ isOpen: false, rank: '' });
  const [dailyProverb, setDailyProverb] = useState('');

  useEffect(() => {
    const hasSeenScroll = localStorage.getItem('has_seen_first_entry_scroll');
    if (!hasSeenScroll && session) {
      setShowFirstEntryScroll(true);
    }

    // Daily Proverb
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

  const checkRankPromotion = (newCount: number) => {
    const thresholds = [
      { min: 11, rank: '初窥门径' },
      { min: 51, rank: '灵见者' },
      { min: 101, rank: '解义人' },
      { min: 501, rank: '大阁主' }
    ];

    const celebratedRanks = JSON.parse(localStorage.getItem('celebrated_ranks') || '[]');
    
    const promotion = thresholds.find(t => newCount >= t.min && !celebratedRanks.includes(t.rank));
    
    if (promotion) {
      setShowPromotionCeremony({ isOpen: true, rank: promotion.rank });
      localStorage.setItem('celebrated_ranks', JSON.stringify([...celebratedRanks, promotion.rank]));
    }
  };
  const [cardMetadata, setCardMetadata] = useState<TarotCardMetadata[]>(() => {
    const saved = localStorage.getItem('tarot_card_metadata');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* Fallback */ }
    }
    return TAROT_CARDS;
  });

  const [spreads, setSpreads] = useState<SpreadDefinition[]>(() => {
    const saved = localStorage.getItem('tarot_spreads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* Fallback */ }
    }
    return OFFICIAL_SPREADS;
  });

  const [readings, setReadings] = useState<TarotReading[]>(() => {
    const guestData = localStorage.getItem('tarot_guest_data');
    const saved = localStorage.getItem('tarot_readings');
    const initialWithFlag = INITIAL_READINGS.map(r => ({ ...r, isExample: true }));
    
    const dataToParse = guestData || saved;

    if (dataToParse) {
      try {
        const parsed = JSON.parse(dataToParse);
        if (parsed.length === 0) return initialWithFlag;

        return parsed.map((r: any) => {
          const isOfficial = INITIAL_READINGS.some(ir => ir.id === r.id) || r.id.startsWith('example-');
          return {
            ...r,
            isExample: isOfficial || r.isExample === true,
            cards: Array.isArray(r.cards) && typeof r.cards[0] === 'string' 
              ? r.cards.map((c: string) => ({ name: c, isReversed: false }))
              : r.cards
          };
        });
      } catch (e) { return initialWithFlag; }
    }
    return initialWithFlag;
  });

  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          setShowAuthPage(false);
          checkMigration();
          fetchProfile(session.user.id);
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) {
          setShowAuthPage(false);
          checkMigration();
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      });

      return () => subscription.unsubscribe();
    } catch (e) {
      console.error('Supabase initialization error:', e);
      setIsSupabaseConfigured(false);
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const newProfile = {
        id: userId,
        nickname: session?.user?.email?.split('@')[0] || '研习阁主',
        signature: '研精覃思，洞见未来',
        createdAt: new Date().toISOString()
      };
      const { data: created } = await supabase.from('profiles').insert([newProfile]).select().single();
      if (created) setProfile(created);
    } else if (data) {
      setProfile(data);
    }
  };

  const checkMigration = () => {
    const guestData = localStorage.getItem('tarot_guest_data');
    if (guestData) {
      try {
        const parsed = JSON.parse(guestData);
        if (parsed.length > 0) {
          setShowMigrationPrompt(true);
        }
      } catch (e) { /* Ignore */ }
    }
  };

  const handleMigration = async (shouldSync: boolean) => {
    if (shouldSync && session?.user) {
      setIsSyncing(true);
      try {
        const guestData = localStorage.getItem('tarot_guest_data');
        if (guestData) {
          const parsed = JSON.parse(guestData);
          const migratedReadings = parsed.map((r: any) => ({
            ...r,
            userId: session.user.id,
            isExample: false
          }));
          setReadings(prev => [...migratedReadings, ...prev.filter(r => !r.isExample)]);
        }
      } catch (e) {
        console.error('Migration error:', e);
      } finally {
        setIsSyncing(false);
      }
    }
    localStorage.removeItem('tarot_guest_data');
    localStorage.removeItem('guest_record_count');
    localStorage.removeItem('total_guest_records');
    localStorage.removeItem('last_reminder_timestamp');
    setShowMigrationPrompt(false);
  };

  const handleExportData = () => {
    try {
      const exportData = {
        readings,
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
      setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setSnackbar({ isOpen: true, message: '❌ 撰录失败，请稍后再试。' });
      setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  useEffect(() => { 
    if (session) {
      localStorage.setItem('tarot_readings', JSON.stringify(readings)); 
    } else {
      localStorage.setItem('tarot_guest_data', JSON.stringify(readings.filter(r => !r.isExample)));
    }
  }, [readings, session]);
  useEffect(() => { localStorage.setItem('tarot_spreads', JSON.stringify(spreads)); }, [spreads]);
  useEffect(() => { localStorage.setItem('tarot_card_metadata', JSON.stringify(cardMetadata)); }, [cardMetadata]);

  const filteredReadings = useMemo(() => {
    let result = readings;

    // If there are search tags or query
    if (searchTags.length > 0 || searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = readings.filter(r => {
        const matchesQuery = !q || (
          r.id.toLowerCase() === q ||
          r.question.toLowerCase().includes(q) || 
          r.keywords.some(k => k.toLowerCase().includes(q)) ||
          r.cards.some(c => c.name.toLowerCase().includes(q)) ||
          (r.clientName && r.clientName.toLowerCase().includes(q)) ||
          (r.spread && r.spread.toLowerCase().includes(q)) ||
          (r.category && r.category.toLowerCase().includes(q))
        );

        const matchesTags = searchTags.length === 0 || searchTags.every(tag => {
          const t = tag.toLowerCase();
          return (
            r.keywords.some(k => k.toLowerCase() === t) ||
            r.cards.some(c => c.name.toLowerCase() === t) ||
            (r.spread && r.spread.toLowerCase() === t) ||
            (r.category && r.category.toLowerCase() === t) ||
            (r.readingDate && r.readingDate.includes(t)) ||
            (r.date && r.date.includes(t))
          );
        });

        return matchesQuery && matchesTags;
      });
      return result;
    }
    
    // Default view: Show user readings. If none, show examples.
    const userReadings = readings.filter(r => !r.isExample);
    return userReadings.length > 0 ? userReadings : readings.filter(r => r.isExample);
  }, [readings, searchQuery, searchTags]);

  const toggleTag = (tag: string) => {
    setSearchTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const publicReadings = useMemo(() => {
    const userReadings = readings.filter(r => !r.isExample);
    const displayReadings = userReadings.length > 0 ? userReadings : readings;
    return displayReadings.filter(r => r.isPublic);
  }, [readings]);

  const authorReadings = useMemo(() => {
    if (!selectedAuthor) return [];
    return readings.filter(r => r.authorName === selectedAuthor && r.isPublic);
  }, [readings, selectedAuthor]);

  const handleAddReading = async (newReading: any) => {
    setIsProcessing(true);
    try {
      const readingData = {
        ...newReading,
        cards: newReading.cards || [],
        keywords: newReading.keywords || (editingReading?.keywords || ['塔罗', '研习']),
        slotLabels: newReading.cards?.length > 0 
          ? newReading.cards.map((s: any) => s.label)
          : (newReading.cardInput ? [/* placeholder */] : []),
        cardInterpretations: newReading.cardInterpretations || [],
        isAiProcessed: false
      };

      if (editingReading) {
        setReadings(readings.map(r => r.id === editingReading.id ? { ...editingReading, ...readingData } : r));
        setSnackbar({ isOpen: true, message: '✨ 灵见手帖已更新。' });
        setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
      } else {
        const reading: TarotReading = {
          id: Math.random().toString(36).substr(2, 9),
          userId: session?.user?.id || 'anonymous',
          date: new Date().toISOString(),
          authorName: profile?.nickname || session?.user?.email?.split('@')[0] || '研习阁主',
          ...readingData
        };
        const updatedReadings = [reading, ...readings];
        setReadings(updatedReadings);
        setEditingReading(reading); // Set as current editing reading to allow continuous editing

        // Check for promotion
        const userReadingsCount = updatedReadings.filter(r => !r.isExample).length;
        checkRankPromotion(userReadingsCount);

        setSnackbar({ isOpen: true, message: '✨ 灵见手帖已添入《阁中典籍》。' });
        setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
      }
      
      // Removed setActiveTab('private') to stay on the same page as requested

      // Trigger Smart Prompts for Guests
      if (!session) {
        const totalRecords = parseInt(localStorage.getItem('total_guest_records') || '0') + 1;
        localStorage.setItem('total_guest_records', totalRecords.toString());

        const lastReminder = parseInt(localStorage.getItem('last_reminder_timestamp') || '0');
        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

        const shouldShow = (now - lastReminder > threeDaysMs) || (totalRecords === 7);

        if (shouldShow) {
          const messages = [
            "✅ 已保存至本机。登录后可跨设备同步，永远不怕丢哦。",
            "📖 手记已珍藏。登录后即可在所有设备上翻阅你的整本《阁中典籍》。",
            "☁️ 开启云端同步，换手机也不怕。"
          ];
          const randomMsg = messages[Math.floor(Math.random() * messages.length)];
          
          setSnackbar({ isOpen: true, message: randomMsg });
          localStorage.setItem('last_reminder_timestamp', now.toString());
          setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 5000);
        }
      }
    } catch (error) {
      console.error("Error adding/editing reading:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessAi = async (id: string) => {
    const reading = readings.find(r => r.id === id);
    if (!reading || reading.isAiProcessed) return;

    try {
      const fullText = `${reading.interpretation.singleCard} ${reading.interpretation.combination}`;
      
      // Parallelize AI calls
      const [recognizedCards, keywords] = await Promise.all([
        (reading.cards?.length > 0 
          ? Promise.resolve(reading.cards) 
          : recognizeCards(reading.question || '')), // Using question as fallback for recognition if no cards
        extractKeywords(fullText)
      ]);

      setReadings(prev => prev.map(r => r.id === id ? {
        ...r,
        cards: recognizedCards.length > 0 ? recognizedCards : r.cards,
        keywords: keywords.length > 0 ? keywords : r.keywords,
        slotLabels: (recognizedCards.length > 0 && (!r.slotLabels || r.slotLabels.length === 0))
          ? recognizedCards.map((_: any, i: number) => `位置 ${i + 1}`)
          : r.slotLabels,
        isAiProcessed: true
      } : r));
    } catch (error) {
      console.error("AI processing error:", error);
    }
  };

  const togglePublic = (id: string) => {
    setReadings(readings.map(r => r.id === id ? { ...r, isPublic: !r.isPublic } : r));
  };

  const handleDeleteReading = (id: string) => {
    setReadings(readings.filter(r => r.id !== id));
  };

  const handleEditReading = (reading: TarotReading) => {
    setEditingReading(reading);
    setActiveTab('add');
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-forest-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-forest-border p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-forest-accent/10 text-forest-accent flex items-center justify-center mx-auto">
            <Settings size={32} />
          </div>
          <h2 className="text-xl font-serif font-bold text-forest-text">配置未完成</h2>
          <p className="text-sm text-forest-muted">
            请在 AI Studio 的 <b>Settings (Secrets)</b> 面板中配置 
            <code className="bg-forest-bg px-1 rounded">VITE_SUPABASE_URL</code> 和 
            <code className="bg-forest-bg px-1 rounded">VITE_SUPABASE_ANON_KEY</code>。
          </p>
          <p className="text-[10px] text-forest-muted italic">配置完成后，请刷新页面以生效。</p>
        </div>
      </div>
    );
  }

  if (showAuthPage) {
    return (
      <div className="relative bg-forest-bg min-h-screen">
        <button 
          onClick={() => setShowAuthPage(false)}
          className="absolute top-6 left-6 z-50 p-2 bg-white/80 backdrop-blur rounded-full shadow-lg border border-forest-border text-forest-muted hover:text-forest-accent transition-all"
        >
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <Auth />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-bg flex flex-col max-w-4xl mx-auto px-4 py-6 sm:py-8 relative overflow-x-hidden">
      {/* Login Prompt Modal */}
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

      {/* Migration Prompt Modal */}
      <Modal 
        isOpen={showMigrationPrompt} 
        onClose={() => handleMigration(false)}
        title="✨ 发现本地记录"
        icon={<Database size={24} />}
      >
        <div className="space-y-6">
          <p>检测到您在本设备的浏览记录，是否将其同步到您的云端账户？</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => handleMigration(true)}
              disabled={isSyncing}
              className="w-full py-3 bg-forest-pink text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-forest-pink/20 disabled:opacity-50"
            >
              {isSyncing ? '正在同步...' : '是的，立即同步'}
              {!isSyncing && <ArrowRight size={18} />}
            </button>
            <button 
              onClick={() => handleMigration(false)}
              disabled={isSyncing}
              className="w-full py-3 text-forest-muted hover:text-forest-accent transition-colors text-sm disabled:opacity-50"
            >
              不需要，仅使用云端
            </button>
          </div>
        </div>
      </Modal>

      {/* Sidebar Overlay */}
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
            <div className="flex items-center gap-3 border-l border-forest-border pl-4">
              <button 
                onClick={() => {
                  setSnackbar(prev => ({ ...prev, isOpen: false }));
                  setShowAuthPage(true);
                }}
                className="text-forest-pink font-bold hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                立即登录
              </button>
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

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-forest-text/10 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-forest-nav z-[110] shadow-2xl border-r border-forest-border flex flex-col"
          >
            <div className="p-6 border-b border-forest-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-forest-accent flex items-center justify-center text-forest-card font-serif shadow-md">
                  {profile?.nickname?.[0] || (session ? (session.user?.email?.[0].toUpperCase() || '研') : '访')}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-serif text-forest-accent font-bold truncate">
                    {session ? `${profile?.nickname || session.user?.email?.split('@')[0]}阁主` : '访客 · 观阁中'}
                  </h3>
                  <p className="text-[8px] text-forest-muted truncate">
                    {session ? session.user?.email : '以访客身份观阁'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-forest-muted hover:text-forest-accent transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">阁主印鉴</p>
              <button 
                onClick={() => {
                  if (!session) {
                    setLoginPrompt({
                      isOpen: true,
                      title: '🔒 阁主印鉴受限',
                      content: '“阁主印鉴”记录着您的位阶晋升与私人注疏。请执印入阁后查看您的专属成就。'
                    });
                    setIsSidebarOpen(false);
                    return;
                  }
                  setSelectedAuthor(profile?.nickname || session.user?.email?.split('@')[0] || '研习阁主');
                  setActiveTab('profile');
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
              >
                <div className="flex items-center gap-3">
                  <User size={18} className="text-forest-accent" />
                  <span className="text-sm font-medium">阁主印鉴</span>
                </div>
                <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
              </button>

              <button 
                onClick={() => {
                  setSearchTags(['日运']);
                  setActiveTab('private');
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Sparkles size={18} className="text-forest-accent" />
                  <span className="text-sm font-medium">日运回顾</span>
                </div>
                <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="pt-4">
                <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">典籍管理</p>
                <button 
                  onClick={() => {
                    setActiveTab('home');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <History size={18} className="text-forest-accent" />
                    <span className="text-sm font-medium">研习台</span>
                  </div>
                  <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('add');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Plus size={18} className="text-forest-accent" />
                    <span className="text-sm font-medium">抽牌手记</span>
                  </div>
                  <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('private');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen size={18} className="text-forest-accent" />
                    <span className="text-sm font-medium">阁中典籍</span>
                  </div>
                  <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('metadata');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Book size={18} className="text-forest-accent" />
                    <span className="text-sm font-medium">牌义注疏</span>
                  </div>
                  <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('public');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-forest-accent/5 text-forest-text transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-forest-accent" />
                    <span className="text-sm font-medium">研习广场</span>
                  </div>
                  <ChevronRight size={14} className="text-forest-muted group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => {
                    if (!session) {
                      setLoginPrompt({
                        isOpen: true,
                        title: '🔒 开启数据导出功能',
                        content: '登录后，您可以一键导出所有的占卜记录与研习心得，支持多种格式，方便您在其他平台备份或深度分析。'
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
              </div>

              <div className="pt-4">
                <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">执印入阁</p>
                {session ? (
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/50 text-red-500 transition-all group"
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">退出登录</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setShowAuthPage(true);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-forest-pink/10 text-forest-pink transition-all group"
                  >
                    <LogIn size={18} />
                    <span className="text-sm font-medium">执印入阁</span>
                  </button>
                )}
              </div>

              <div className="pt-4">
                <p className="text-[10px] text-forest-muted font-bold px-2 uppercase tracking-widest mb-2">系统设置</p>
                <button 
                  id="sidebar-settings"
                  onClick={() => {
                    setActiveTab('metadata');
                    setIsSidebarOpen(false);
                  }}
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
            </div>

            <div className="p-6 border-t border-forest-border text-center">
              <p className="text-[10px] text-forest-muted">版本 v1.2.0 · 研精覃思</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>


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
              className="max-w-lg w-full ancient-book-bg p-10 rounded-[2rem] shadow-2xl border-4 border-forest-accent/10 text-center space-y-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />
              
              <Sparkles className="mx-auto text-forest-accent animate-pulse" size={48} />
              
              <div className="space-y-6">
                <h2 className="text-3xl font-serif text-forest-accent leading-relaxed">入阁敕令</h2>
                <p className="text-lg text-forest-text leading-loose font-kai italic">
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

      <header className="mb-8 sm:mb-12 text-center relative">
        <div className="absolute left-0 top-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-forest-accent/5 text-forest-accent rounded-full hover:bg-forest-accent/10 transition-all border border-forest-accent/10"
            title="打开菜单"
          >
            <Menu size={20} />
          </button>
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="text-3xl sm:text-5xl font-serif mb-2 text-forest-accent"
        >
          塔罗研习阁
        </motion.h1>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-forest-accent/10 z-[100] px-2 py-1 safe-area-inset-bottom shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center max-w-lg mx-auto h-16">
          <TabButton id="tab-home" active={activeTab === 'home'} onClick={() => { setEditingReading(null); setActiveTab('home'); }} icon={History} label="研习台" />
          <TabButton id="tab-add" active={activeTab === 'add'} onClick={() => { setEditingReading(null); setActiveTab('add'); }} icon={Plus} label="手记" />
          <TabButton id="tab-private" active={activeTab === 'private'} onClick={() => setActiveTab('private')} icon={BookOpen} label="典籍" />
          <TabButton id="tab-public" active={activeTab === 'public'} onClick={() => setActiveTab('public')} icon={Globe} label="广场" />
          {session ? (
            <TabButton id="tab-profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} label="印鉴" />
          ) : (
            <button 
              onClick={() => setShowAuthPage(true)}
              className="flex flex-col items-center gap-1 px-3 py-2 text-forest-muted hover:text-forest-accent transition-all"
            >
              <LogIn size={20} />
              <span className="text-[10px] font-medium whitespace-nowrap">执印入阁</span>
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              {/* Simplified Identity & Proverb Area */}
              <div className="flex flex-col items-center gap-6 py-2">
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-serif text-forest-ink">
                    {session ? `${profile?.nickname || session.user?.email?.split('@')[0]}阁主` : '访客 · 观阁中'}
                  </h2>
                </div>

                <div className="flex flex-col items-center gap-3 max-w-sm px-6">
                  <p className="text-base text-forest-ink/60 font-serif italic tracking-wide text-center leading-relaxed">
                    “ {dailyProverb} ”
                  </p>
                  <div className="flex items-center gap-2 text-forest-accent/20">
                    <BookOpen size={12} />
                  </div>
                </div>
              </div>

              {/* Enhanced Action Button */}
              <button 
                onClick={() => setActiveTab('add')}
                className="w-full group relative overflow-hidden rounded-[2.5rem] bg-forest-accent text-white p-8 text-center transition-all shadow-xl shadow-forest-accent/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex flex-col items-center gap-2">
                   <div className="text-2xl mb-1">🃏</div>
                   <h3 className="text-xl font-bold tracking-wider">开启今日手记</h3>
                   <p className="text-[10px] opacity-80 font-medium tracking-widest">随缘抽牌 · 记录此刻</p>
                </div>
              </button>

              {/* Study Pavilion Modules */}
              <StudyPavilionModules 
                readings={readings}
                cardMetadata={cardMetadata}
                setActiveTab={setActiveTab}
                setSearchQuery={setSearchQuery}
              />
            </motion.div>
          )}

          {activeTab === 'private' && (
            <motion.div key="private" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-forest-accent flex items-center gap-2">
                    阁中典籍
                    <span className="text-[10px] font-sans font-normal text-forest-muted opacity-60 bg-forest-accent/5 px-2 py-0.5 rounded-full ring-1 ring-forest-accent/10">研精覃思，洞见未来</span>
                  </h2>
                </div>
              </div>

              <div className="relative group shadow-sm bg-white rounded-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-forest-muted group-focus-within:text-forest-accent transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="🔍 搜索记录..." 
                  className="w-full pl-11 pr-10 py-3 bg-white border border-forest-accent/10 rounded-full focus:outline-none focus:ring-2 focus:ring-forest-accent/20 text-sm transition-all" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-forest-muted hover:text-forest-accent transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              
              {(searchQuery || searchTags.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 px-2">
                  <span className="text-[10px] text-forest-muted">正在筛选:</span>
                  {searchQuery && (
                    <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
                      关键词: {searchQuery}
                      <X size={10} className="cursor-pointer" onClick={() => setSearchQuery('')} />
                    </span>
                  )}
                  {searchTags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-forest-accent text-white rounded-full text-[10px] font-medium flex items-center gap-1 shadow-sm">
                      {tag}
                      <X size={10} className="cursor-pointer" onClick={() => toggleTag(tag)} />
                    </span>
                  ))}
                  {(searchQuery || searchTags.length > 0) && (
                    <button 
                      onClick={() => { setSearchQuery(''); setSearchTags([]); }}
                      className="text-[10px] text-forest-muted hover:text-forest-accent underline"
                    >
                      清除全部
                    </button>
                  )}
                </div>
              )}
              
              {readings.every(r => r.isExample) && !searchQuery && (
                <div className="bg-forest-accent/5 border border-forest-accent/10 rounded-2xl p-6 text-center space-y-3">
                  <Sparkles className="mx-auto text-forest-accent" size={32} />
                  <h4 className="text-lg font-serif text-forest-ink">开启你的研习之旅</h4>
                  <p className="text-sm text-forest-muted max-w-md mx-auto">
                    下方展示的是一个占卜示例。你可以通过“新增占卜”来记录你自己的真实案例，系统将为你提供专业的解读与复盘。
                  </p>
                  <button 
                    onClick={() => setActiveTab('add')}
                    className="px-6 py-2 bg-forest-accent text-white rounded-full text-sm font-medium hover:bg-forest-accent/90 transition-all shadow-md"
                  >
                    立即去试着记录
                  </button>
                </div>
              )}

              {filteredReadings.some(r => !r.isAiProcessed && !r.skipAi && !r.isExample) && (
                <div className="flex justify-end">
                  <button 
                    onClick={async () => {
                      const toProcess = filteredReadings.filter(r => !r.isAiProcessed && !r.skipAi && !r.isExample);
                      for (const r of toProcess) {
                        await handleProcessAi(r.id);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-forest-accent/10 text-forest-accent rounded-full text-xs font-bold hover:bg-forest-accent/20 transition-all"
                  >
                    <Sparkles size={14} />
                    一键解析所有未处理记录
                  </button>
                </div>
              )}

              {filteredReadings.length === 0 ? (
                <div className="text-center py-24 text-forest-muted bg-white/50 rounded-3xl border border-dashed border-forest-accent/20 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-forest-accent/5 flex items-center justify-center text-forest-accent/30">
                    <BookOpen size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">执印入阁，留下你的第一篇手记。</p>
                    <p className="text-[10px] opacity-60">记录每一次的心灵触动与智慧微光</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('add')}
                    className="px-6 py-2 bg-forest-accent text-white rounded-full text-xs font-bold hover:bg-forest-accent/90 transition-all shadow-md active:scale-95"
                  >
                    开始抽牌
                  </button>
                </div>
              ) : (
                filteredReadings.map(reading => (
                  <ReadingCard 
                    key={reading.id} 
                    reading={reading} 
                    onTogglePublic={() => togglePublic(reading.id)} 
                    onDelete={() => handleDeleteReading(reading.id)}
                    onEdit={() => handleEditReading(reading)}
                    onTagClick={toggleTag}
                    activeTags={searchTags}
                    cardMetadata={cardMetadata}
                    onAuthorClick={(author) => {
                      setSelectedAuthor(author);
                      setActiveTab('profile');
                    }}
                    onProcessAi={handleProcessAi}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'public' && (
            <motion.div key="public" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              {publicReadings.length === 0 ? (
                <div className="text-center py-20 text-forest-muted"><Globe className="mx-auto mb-4 opacity-20" size={48} /><p>广场空空如也，去分享你的研习心得吧</p></div>
              ) : (
                publicReadings.map(reading => (
                  <ReadingCard 
                    key={reading.id} 
                    reading={reading} 
                    isPublicView 
                    cardMetadata={cardMetadata}
                    onTagClick={(tag) => {
                      setActiveTab('private');
                      setSearchQuery(tag);
                    }}
                    onAuthorClick={(author) => {
                      setSelectedAuthor(author);
                      setActiveTab('profile');
                    }}
                    onProcessAi={handleProcessAi}
                  />
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'add' && (
            <motion.div key="add" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6">
              <AddReadingForm 
                onSubmit={handleAddReading} 
                isLoading={isProcessing} 
                isLoggedIn={!!session}
                userId={session?.user?.id}
                spreads={spreads} 
                onUpdateSpreads={setSpreads} 
                cardMetadata={cardMetadata}
                onUpdateCardMetadata={setCardMetadata}
                initialData={editingReading}
                onCancel={() => { setEditingReading(null); setActiveTab('home'); }}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <ProfileView 
                authorName={selectedAuthor || '研习阁主'} 
                profile={profile}
                onUpdateProfile={async (updated) => {
                  const { data, error } = await supabase.from('profiles').update(updated).eq('id', session?.user?.id).select().single();
                  if (data) {
                    setProfile(data);
                    setSnackbar({ isOpen: true, message: '✨ 印鉴已更新，阁主气象一新。' });
                    setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
                  }
                }}
                readings={readings} 
                cardMetadata={cardMetadata}
                onTagClick={(tag) => {
                  setSearchTags([tag]);
                  setActiveTab('private');
                }}
                onEditReading={handleEditReading}
                onDeleteReading={handleDeleteReading}
                onTogglePublic={togglePublic}
              />
            </motion.div>
          )}

          {activeTab === 'metadata' && (
            <motion.div key="metadata" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <CardMetadataManager 
                metadata={cardMetadata}
                onUpdate={setCardMetadata}
                readings={readings}
                isLoggedIn={!!session}
                userId={session?.user?.id}
                onShowSnackbar={(msg) => {
                  setSnackbar({ isOpen: true, message: msg });
                  setTimeout(() => setSnackbar(prev => ({ ...prev, isOpen: false })), 3000);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
