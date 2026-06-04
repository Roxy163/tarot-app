import { useState, useEffect, useCallback, useMemo } from 'react';
import { CardKeywordMemory, ReadingKeywordCandidate, TarotReading, SpreadDefinition, TarotCardMetadata } from '../types';
import { INITIAL_READINGS, OFFICIAL_SPREADS } from '../constants';
import { extractKeywords, recognizeCards, suggestReadingKeywords } from '../services/geminiService';
import {
  getUserCardKeywordMemory,
  getUserCardMetadata,
  getUserReadings,
  getUserSpreads,
  replaceUserReadings,
  saveUserCardKeywordMemory,
  saveUserCardMetadata,
  saveUserSpreads,
} from '../lib/firebaseData';

const normalizeMemoryKeyword = (keyword: string) => keyword.trim().replace(/^#+/, '').replace(/\s+/g, '');

const getReadingInsightForCard = (reading: TarotReading, cardName: string) => {
  const cardIndex = reading.cards?.findIndex(card => card.name === cardName) ?? -1;
  return [
    cardIndex >= 0 ? reading.cardInterpretations?.[cardIndex] : '',
    reading.interpretation?.singleCard,
    reading.interpretation?.combination,
    reading.userFeedback
  ].filter(Boolean).join(' ').trim();
};

const mergeKeywordMemory = (
  memory: CardKeywordMemory[],
  reading: TarotReading,
  candidates: ReadingKeywordCandidate[],
): CardKeywordMemory[] => {
  const now = new Date().toISOString();
  const memoryByCard = new Map<string, CardKeywordMemory>(
    memory.map(item => [
      item.cardName,
      {
        ...item,
        keywords: item.keywords.map(keyword => ({
          ...keyword,
          readingIds: [...keyword.readingIds],
          examples: [...keyword.examples],
        })),
      },
    ]),
  );

  candidates.forEach(candidate => {
    const keyword = normalizeMemoryKeyword(candidate.keyword);
    if (!candidate.cardName || !keyword) return;

    const cardMemory = memoryByCard.get(candidate.cardName) || {
      cardName: candidate.cardName,
      keywords: [],
      updatedAt: now,
    };

    const existingEntry = cardMemory.keywords.find(item => item.keyword === keyword);
    const sourceExample = (candidate.sourceText || getReadingInsightForCard(reading, candidate.cardName)).trim().slice(0, 180);

    if (existingEntry) {
      if (!existingEntry.readingIds.includes(reading.id)) {
        existingEntry.count += 1;
        existingEntry.readingIds.push(reading.id);
      }
      if (sourceExample && !existingEntry.examples.includes(sourceExample)) {
        existingEntry.examples = [sourceExample, ...existingEntry.examples].slice(0, 3);
      }
      existingEntry.updatedAt = now;
    } else {
      cardMemory.keywords.push({
        keyword,
        count: 1,
        readingIds: [reading.id],
        examples: sourceExample ? [sourceExample] : [],
        createdAt: now,
        updatedAt: now,
      });
    }

    cardMemory.updatedAt = now;
    cardMemory.keywords.sort((a, b) => b.count - a.count || b.updatedAt.localeCompare(a.updatedAt));
    memoryByCard.set(candidate.cardName, cardMemory);
  });

  return Array.from(memoryByCard.values()).sort((a, b) => a.cardName.localeCompare(b.cardName));
};

export const useReadings = (session: { uid?: string; email?: string | null } | null) => {
  const activeDataKey = session?.uid || 'guest';
  const exampleReadings = useMemo(() => INITIAL_READINGS.map(r => ({ ...r, isExample: true })), []);
  const [readings, setReadings] = useState<TarotReading[]>(INITIAL_READINGS.map(r => ({ ...r, isExample: true })));
  const [spreads, setSpreads] = useState<SpreadDefinition[]>(OFFICIAL_SPREADS);
  const [cardMetadata, setCardMetadata] = useState<TarotCardMetadata[]>([]);
  const [cardKeywordMemory, setCardKeywordMemory] = useState<CardKeywordMemory[]>([]);
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
      const localReadings = parseSavedArray<TarotReading>(session?.uid ? 'tarot_readings' : 'tarot_guest_data') || [];
      const savedSpreads = parseSavedArray<SpreadDefinition>('tarot_spreads') || [];
      const localSpreads = [...OFFICIAL_SPREADS, ...savedSpreads.filter(s => !OFFICIAL_SPREADS.some(os => os.name === s.name))];
      const localMetadata = parseSavedArray<TarotCardMetadata>('tarot_card_metadata') || [];
      const localKeywordMemory = parseSavedArray<CardKeywordMemory>('tarot_card_keyword_memory') || [];
      
      if (!session?.uid) {
        setReadings([...exampleReadings, ...localReadings]);
        setSpreads(localSpreads);
        setCardMetadata(localMetadata);
        setCardKeywordMemory(localKeywordMemory);
        setLoadedDataKey(activeDataKey);
        return;
      }

      try {

        const [cloudReadings, cloudSpreads, cloudMetadata, cloudKeywordMemory] = await Promise.all([
          getUserReadings(session.uid),
          getUserSpreads(session.uid),
          getUserCardMetadata(session.uid),
          getUserCardKeywordMemory(session.uid),
        ]);

        if (cancelled) return;

        setReadings([...exampleReadings, ...(cloudReadings.length > 0 ? cloudReadings : localReadings)]);
        const mergedSpreads = [...OFFICIAL_SPREADS, ...(cloudSpreads && cloudSpreads.length > 0 ? cloudSpreads : savedSpreads).filter(s => !OFFICIAL_SPREADS.some(os => os.name === s.name))];
        setSpreads(mergedSpreads);
        setCardMetadata(cloudMetadata && cloudMetadata.length > 0 ? cloudMetadata : localMetadata);
        setCardKeywordMemory(cloudKeywordMemory && cloudKeywordMemory.length > 0 ? cloudKeywordMemory : localKeywordMemory);
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

  useEffect(() => {
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      saveUserCardKeywordMemory(session.uid, cardKeywordMemory).catch(error => {
        console.error('Failed to save card keyword memory:', error);
      });
    }

    localStorage.setItem('tarot_card_keyword_memory', JSON.stringify(cardKeywordMemory));
  }, [activeDataKey, cardKeywordMemory, loadedDataKey, session?.uid]);

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
          id: crypto.randomUUID(),
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

  const handleExtractKeywordCandidates = useCallback(async (id: string): Promise<ReadingKeywordCandidate[]> => {
    const reading = readings.find(r => r.id === id);
    if (!reading) return [];

    return suggestReadingKeywords(reading);
  }, [readings]);

  const handleConfirmKeywordCandidates = useCallback((id: string, candidates: ReadingKeywordCandidate[]) => {
    const reading = readings.find(r => r.id === id);
    if (!reading || candidates.length === 0) return;

    const confirmedKeywords = Array.from(new Set(candidates.map(candidate => normalizeMemoryKeyword(candidate.keyword)).filter(Boolean)));

    setReadings(prev => prev.map(r => r.id === id ? {
      ...r,
      keywords: Array.from(new Set([...(r.keywords || []), ...confirmedKeywords])),
      isAiProcessed: true,
      processedByAi: true,
    } : r));

    setCardKeywordMemory(prev => mergeKeywordMemory(prev, reading, candidates));
  }, [readings]);

  // AI处理
  const handleProcessAi = useCallback(async (id: string) => {
    const reading = readings.find(r => r.id === id);
    if (!reading || reading.isAiProcessed) return;

    try {
      const fullText = `${reading.interpretation.singleCard} ${reading.interpretation.combination}`;
      const keywordCandidates = await suggestReadingKeywords(reading);
      const aiKeywords = keywordCandidates.map(candidate => normalizeMemoryKeyword(candidate.keyword)).filter(Boolean);
      
      const [recognizedCardsResult, keywords] = await Promise.all([
        (reading.cards?.length > 0 
          ? Promise.resolve(reading.cards) 
          : recognizeCards(reading.question || '')),
        Promise.resolve(aiKeywords.length > 0 ? aiKeywords : extractKeywords(fullText))
      ]);

      let recognizedCards: { name: string; isReversed: boolean }[] = [];
      if (Array.isArray(recognizedCardsResult)) {
        recognizedCards = recognizedCardsResult;
      } else if (typeof recognizedCardsResult === 'string') {
        recognizedCards = recognizedCardsResult.split('\n').filter(line => line.trim())
          .map(line => {
            const match = line.match(/(.+)\((正位|逆位)\)/);
            if (match) {
              return { name: match[1].trim(), isReversed: match[2] === '逆位' };
            }
            return { name: line.trim(), isReversed: false };
          });
      }

      setReadings(prev => prev.map(r => r.id === id ? {
        ...r,
        cards: recognizedCards.length > 0 ? recognizedCards : r.cards,
        keywords: keywords.length > 0 ? keywords : r.keywords,
        slotLabels: (recognizedCards.length > 0 && (!r.slotLabels || r.slotLabels.length === 0))
          ? recognizedCards.map((_: any, i: number) => `位置 ${i + 1}`)
          : r.slotLabels,
        isAiProcessed: true,
        processedByAi: true
      } : r));

      if (keywordCandidates.length > 0) {
        setCardKeywordMemory(prev => mergeKeywordMemory(prev, reading, keywordCandidates));
      }
    } catch (error) {
      console.error("AI processing error:", error);
    }
  }, [readings]);

  // 切换公开状态
  const togglePublic = useCallback((id: string) => {
    setReadings(prev => prev.map(r => r.id === id ? { ...r, isPublic: !r.isPublic } : r));
  }, []);

  // 删除阅读记录
  const handleDeleteReading = useCallback((id: string) => {
    setReadings(prev => prev.filter(r => r.id !== id));
  }, []);

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
    cardKeywordMemory,
    searchQuery,
    setSearchQuery,
    searchTags,
    setSearchTags,
    isProcessing,
    editingReading,
    setEditingReading,
    filteredReadings,
    handleAddReading,
    handleExtractKeywordCandidates,
    handleConfirmKeywordCandidates,
    handleProcessAi,
    togglePublic,
    handleDeleteReading,
    handleEditReading,
    toggleTag,
  };
};
