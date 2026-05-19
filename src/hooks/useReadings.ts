import { useState, useEffect, useCallback, useMemo } from 'react';
import { TarotReading, SpreadDefinition, TarotCardMetadata } from '../types';
import { INITIAL_READINGS, OFFICIAL_SPREADS } from '../constants';
import { extractKeywords, recognizeCards } from '../services/geminiService';
import {
  getUserCardMetadata,
  getUserReadings,
  getUserSpreads,
  replaceUserReadings,
  saveUserCardMetadata,
  saveUserSpreads,
} from '../lib/firebaseData';

export const useReadings = (session: { uid?: string; email?: string | null } | null) => {
  const activeDataKey = session?.uid || 'guest';
  const exampleReadings = useMemo(() => INITIAL_READINGS.map(r => ({ ...r, isExample: true })), []);
  const [readings, setReadings] = useState<TarotReading[]>(INITIAL_READINGS.map(r => ({ ...r, isExample: true })));
  const [spreads, setSpreads] = useState<SpreadDefinition[]>(OFFICIAL_SPREADS);
  const [cardMetadata, setCardMetadata] = useState<TarotCardMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingReading, setEditingReading] = useState<TarotReading | null>(null);
  const [loadedDataKey, setLoadedDataKey] = useState<string | null>(null);

  const parseSavedArray = <T,>(key: string): T[] | null => {
    const saved = localStorage.getItem(key);
    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  // 登录后从 Firestore 加载，访客模式使用本地数据。
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoadedDataKey(null);
      try {
        const localReadings = parseSavedArray<TarotReading>(session?.uid ? 'tarot_readings' : 'tarot_guest_data') || [];
        const localSpreads = parseSavedArray<SpreadDefinition>('tarot_spreads') || OFFICIAL_SPREADS;
        const localMetadata = parseSavedArray<TarotCardMetadata>('tarot_card_metadata') || [];

        if (session?.uid) {
          const [cloudReadings, cloudSpreads, cloudMetadata] = await Promise.all([
            getUserReadings(session.uid),
            getUserSpreads(session.uid),
            getUserCardMetadata(session.uid),
          ]);

          if (cancelled) return;

          setReadings([...exampleReadings, ...(cloudReadings.length > 0 ? cloudReadings : localReadings)]);
          setSpreads(cloudSpreads && cloudSpreads.length > 0 ? cloudSpreads : localSpreads);
          setCardMetadata(cloudMetadata && cloudMetadata.length > 0 ? cloudMetadata : localMetadata);
        } else {
          if (cancelled) return;

          setReadings([...exampleReadings, ...localReadings]);
          setSpreads(localSpreads);
          setCardMetadata(localMetadata);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        if (!cancelled) setLoadedDataKey(activeDataKey);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [activeDataKey, exampleReadings, session?.uid]);

  // 保存数据：登录用户写入 Firestore，访客写入本地。
  useEffect(() => {
    if (loadedDataKey !== activeDataKey) return;

    const userReadings = readings.filter(r => !r.isExample);

    if (session?.uid) {
      replaceUserReadings(session.uid, userReadings).catch(error => {
        console.error('Failed to save readings:', error);
      });
      localStorage.setItem('tarot_readings', JSON.stringify(readings.filter(r => !r.isExample)));
    } else {
      localStorage.setItem('tarot_guest_data', JSON.stringify(userReadings));
    }
  }, [activeDataKey, loadedDataKey, readings, session?.uid]);

  useEffect(() => {
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      saveUserSpreads(session.uid, spreads).catch(error => {
        console.error('Failed to save spreads:', error);
      });
    }

    localStorage.setItem('tarot_spreads', JSON.stringify(spreads));
  }, [activeDataKey, loadedDataKey, session?.uid, spreads]);

  useEffect(() => {
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      saveUserCardMetadata(session.uid, cardMetadata).catch(error => {
        console.error('Failed to save card metadata:', error);
      });
    }

    localStorage.setItem('tarot_card_metadata', JSON.stringify(cardMetadata));
  }, [activeDataKey, cardMetadata, loadedDataKey, session?.uid]);

  // 过滤阅读记录
  const filteredReadings = useMemo(() => {
    let result = readings;

    if (searchTags.length > 0 || searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = readings.filter(r => {
        const matchesQuery = !q || 
          r.question.toLowerCase().includes(q) ||
          r.keywords.some(k => k.toLowerCase().includes(q)) ||
          r.authorName.toLowerCase().includes(q);
        
        const matchesTags = searchTags.length === 0 || 
          searchTags.every(tag => r.keywords.includes(tag));
        
        return matchesQuery && matchesTags;
      });
    }

    return result;
  }, [readings, searchQuery, searchTags]);

  // 添加阅读记录
  const handleAddReading = useCallback(async (newReading: any, profile?: { display_name?: string; nickname?: string }, onShowSnackbar?: (msg: string) => void) => {
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
        onShowSnackbar?.('✨ 灵见手帖已更新。');
      } else {
        const reading: TarotReading = {
          id: Math.random().toString(36).substr(2, 9),
          userId: session?.uid || 'anonymous',
          date: new Date().toISOString(),
          authorName: profile?.display_name || profile?.nickname || session?.email?.split('@')[0] || '研习阁主',
          ...readingData
        };
        const updatedReadings = [reading, ...readings];
        setReadings(updatedReadings);
        setEditingReading(reading);

        onShowSnackbar?.('✨ 灵见手帖已添入《阁中典籍》。');
      }

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
          onShowSnackbar?.(randomMsg);
          localStorage.setItem('last_reminder_timestamp', now.toString());
        }
      }
    } catch (error) {
      console.error("Error adding/editing reading:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [readings, editingReading, session]);

  // AI处理
  const handleProcessAi = useCallback(async (id: string) => {
    const reading = readings.find(r => r.id === id);
    if (!reading || reading.isAiProcessed) return;

    try {
      const fullText = `${reading.interpretation.singleCard} ${reading.interpretation.combination}`;
      
      const [recognizedCards, keywords] = await Promise.all([
        (reading.cards?.length > 0 
          ? Promise.resolve(reading.cards) 
          : recognizeCards(reading.question || '')),
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
  }, [readings]);

  // 切换公开状态
  const togglePublic = useCallback((id: string) => {
    setReadings(readings.map(r => r.id === id ? { ...r, isPublic: !r.isPublic } : r));
  }, [readings]);

  // 删除阅读记录
  const handleDeleteReading = useCallback((id: string) => {
    setReadings(readings.filter(r => r.id !== id));
  }, [readings]);

  // 编辑阅读记录
  const handleEditReading = useCallback((reading: TarotReading) => {
    setEditingReading(reading);
  }, []);

  // 切换标签
  const toggleTag = useCallback((tag: string) => {
    setSearchTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  return {
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
  };
};
