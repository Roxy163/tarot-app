import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import {
  getLegacyCustomSpreadNameMap,
  normalizeLegacyReadingSpreadNames,
} from '../lib/spreadPersistence';
import {
  mergeCardMetadataSources,
  mergeKeywordMemorySources,
  getPersistableReadings,
  mergeReadingsForSignedInUser,
  mergeSpreadSources,
} from '../lib/readingSessionMerge';

const CLOUD_SAVE_DEBOUNCE_MS = 1200;

const normalizeMemoryKeyword = (keyword: string) => keyword.trim().replace(/^#+/, '').replace(/\s+/g, '');

const getReadingInsightForCard = (reading: TarotReading, cardName: string) => {
  const cardIndex = reading.cards?.findIndex(card => card.name === cardName) ?? -1;
  const cardInsight = cardIndex >= 0 ? reading.cardInterpretations?.[cardIndex]?.trim() : '';
  if (cardInsight) return cardInsight;

  if ((reading.cards?.length || 0) <= 1) {
    return (reading.interpretation?.singleCard || reading.interpretation?.combination || '').trim();
  }

  return '';
};

const stampReadingUpdate = (reading: TarotReading): TarotReading => ({
  ...reading,
  updatedAt: new Date().toISOString(),
});

const withExamplesOnlyWhenEmpty = (
  examples: TarotReading[],
  userReadings: TarotReading[],
) => (
  userReadings.length > 0 ? userReadings : [...examples]
);

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

export const useReadings = (
  session: { uid?: string; email?: string | null } | null,
  isAuthLoading = false,
) => {
  const activeDataKey = isAuthLoading ? 'auth-loading' : (session?.uid || 'guest');
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
  const [isCloudSyncPaused, setIsCloudSyncPaused] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const pendingGuestReadingsSyncRef = useRef(false);

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

  // 登录后从 Firebase 加载，访客模式使用本地数据。
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (isAuthLoading) {
        setLoadedDataKey(null);
        return;
      }

      setLoadedDataKey(null);
      setIsCloudSyncPaused(false);
      setSyncNotice(null);
      const savedUserReadings = parseSavedArray<TarotReading>('tarot_readings') || [];
      const savedGuestReadings = parseSavedArray<TarotReading>('tarot_guest_data') || [];
      const savedSpreads = parseSavedArray<SpreadDefinition>('tarot_spreads') || [];
      const localSpreadNameMap = getLegacyCustomSpreadNameMap(savedSpreads, OFFICIAL_SPREADS);
      const localGuestReadings = normalizeLegacyReadingSpreadNames(savedGuestReadings, localSpreadNameMap);
      const localUserReadings = normalizeLegacyReadingSpreadNames(savedUserReadings, localSpreadNameMap);
      const localSpreads = mergeSpreadSources([savedSpreads], OFFICIAL_SPREADS);
      const localMetadata = parseSavedArray<TarotCardMetadata>('tarot_card_metadata') || [];
      const localKeywordMemory = parseSavedArray<CardKeywordMemory>('tarot_card_keyword_memory') || [];
      
      if (!session?.uid) {
        pendingGuestReadingsSyncRef.current = false;
        setReadings(withExamplesOnlyWhenEmpty(exampleReadings, localGuestReadings));
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

        const cloudSpreadNameMap = getLegacyCustomSpreadNameMap(cloudSpreads, OFFICIAL_SPREADS);
        const cloudReadingsNormalized = normalizeLegacyReadingSpreadNames(cloudReadings, cloudSpreadNameMap);
        const mergedReadings = mergeReadingsForSignedInUser(session.uid, [
          cloudReadingsNormalized,
          localUserReadings,
          localGuestReadings,
        ]);
        const mergedSpreads = mergeSpreadSources([cloudSpreads || [], savedSpreads], OFFICIAL_SPREADS);
        const mergedMetadata = mergeCardMetadataSources([cloudMetadata || [], localMetadata]);
        const mergedKeywordMemory = mergeKeywordMemorySources([cloudKeywordMemory || [], localKeywordMemory]);

        pendingGuestReadingsSyncRef.current = getPersistableReadings(localGuestReadings).length > 0;
        setReadings(withExamplesOnlyWhenEmpty(exampleReadings, mergedReadings));
        setSpreads(mergedSpreads);
        setCardMetadata(mergedMetadata);
        setCardKeywordMemory(mergedKeywordMemory);
      } catch (error) {
        console.error('Failed to load data:', error);
        if (cancelled) return;

        pendingGuestReadingsSyncRef.current = false;
        const fallbackReadings = mergeReadingsForSignedInUser(session.uid, [
          localUserReadings,
          localGuestReadings,
        ]);

        setReadings(withExamplesOnlyWhenEmpty(exampleReadings, fallbackReadings));
        setSpreads(localSpreads);
        setCardMetadata(localMetadata);
        setCardKeywordMemory(localKeywordMemory);
        setIsCloudSyncPaused(true);
        setSyncNotice('云端同步暂时不可用，已切换为本地暂存，避免覆盖云端典籍。');
      } finally {
        if (!cancelled) setLoadedDataKey(activeDataKey);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [activeDataKey, exampleReadings, isAuthLoading, session?.uid]);

  // 保存数据：登录用户写入 Firebase，访客写入本地。
  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    const userReadings = readings.filter(r => !r.isExample);

    if (session?.uid) {
      localStorage.setItem('tarot_readings', JSON.stringify(userReadings));
      if (isCloudSyncPaused) return;

      const timer = window.setTimeout(() => {
        replaceUserReadings(session.uid, userReadings)
          .then(result => {
            const privateChangeCount = result.privateReadingsWritten + result.privateReadingsDeleted;

            if (pendingGuestReadingsSyncRef.current) {
              localStorage.removeItem('tarot_guest_data');
              pendingGuestReadingsSyncRef.current = false;
              setSyncNotice(`已将本机手记合并到云端典籍，共 ${result.totalReadings} 条。`);
              return;
            }

            if (result.publicMirrorWarning || result.publicMirrorDeleteWarning) {
              setSyncNotice('云端典籍已保存；公开到广场暂未成功，稍后会随下次修改重试。');
              return;
            }

            if (privateChangeCount > 0) {
              setSyncNotice(`云端典籍已同步 ${result.totalReadings} 条记录。`);
            }
          })
          .catch(error => {
            console.error('Failed to save readings:', error);
            setSyncNotice('云端典籍保存失败，本机记录已保留；刷新或重新登录后会再次尝试同步。');
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    } else {
      localStorage.setItem('tarot_guest_data', JSON.stringify(userReadings));
    }
  }, [activeDataKey, isAuthLoading, isCloudSyncPaused, loadedDataKey, readings, session?.uid]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      localStorage.setItem('tarot_spreads', JSON.stringify(spreads));
      if (isCloudSyncPaused) return;

      const timer = window.setTimeout(() => {
        saveUserSpreads(session.uid, spreads).catch(error => {
          console.error('Failed to save spreads:', error);
          setIsCloudSyncPaused(true);
          setSyncNotice('牌阵云端保存失败，已先保存在本地。');
        });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    localStorage.setItem('tarot_spreads', JSON.stringify(spreads));
  }, [activeDataKey, isAuthLoading, isCloudSyncPaused, loadedDataKey, session?.uid, spreads]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      localStorage.setItem('tarot_card_metadata', JSON.stringify(cardMetadata));
      if (isCloudSyncPaused) return;

      const timer = window.setTimeout(() => {
        saveUserCardMetadata(session.uid, cardMetadata).catch(error => {
          console.error('Failed to save card metadata:', error);
          setIsCloudSyncPaused(true);
          setSyncNotice('塔罗牌库云端保存失败，已先保存在本地。');
        });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    localStorage.setItem('tarot_card_metadata', JSON.stringify(cardMetadata));
  }, [activeDataKey, cardMetadata, isAuthLoading, isCloudSyncPaused, loadedDataKey, session?.uid]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      localStorage.setItem('tarot_card_keyword_memory', JSON.stringify(cardKeywordMemory));
      if (isCloudSyncPaused) return;

      const timer = window.setTimeout(() => {
        saveUserCardKeywordMemory(session.uid, cardKeywordMemory).catch(error => {
          console.error('Failed to save card keyword memory:', error);
          setIsCloudSyncPaused(true);
          setSyncNotice('个人牌义记忆云端保存失败，已先保存在本地。');
        });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    localStorage.setItem('tarot_card_keyword_memory', JSON.stringify(cardKeywordMemory));
  }, [activeDataKey, cardKeywordMemory, isAuthLoading, isCloudSyncPaused, loadedDataKey, session?.uid]);
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
        isAiProcessed: false,
        updatedAt: new Date().toISOString(),
      };

      let savedReading: TarotReading | null = null;

      if (editingReading?.id) {
        const updatedReading = stampReadingUpdate({ ...editingReading, ...readingData });
        setReadings(readings.map(r => r.id === editingReading.id ? updatedReading : r));
        onShowSnackbar?.('✨ 灵见手帖已更新。');
        savedReading = updatedReading;
      } else {
        const reading: TarotReading = {
          id: crypto.randomUUID(),
          userId: session?.uid || 'anonymous',
          date: new Date().toISOString(),
          authorName: profile?.display_name || profile?.nickname || session?.email?.split('@')[0] || '研习阁主',
          ...readingData
        };
        const updatedReadings = [reading, ...readings.filter(item => !item.isExample)];
        setReadings(updatedReadings);

        onShowSnackbar?.('✨ 灵见手帖已添入《阁中典籍》。');
        savedReading = reading;
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

      return savedReading;
    } catch (error) {
      console.error("Error adding/editing reading:", error);
      return null;
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
      updatedAt: new Date().toISOString(),
    } : r));

    setCardKeywordMemory(prev => mergeKeywordMemory(prev, reading, candidates));
  }, [readings]);

  // AI处理
  const handleProcessAi = useCallback(async (id: string) => {
    const reading = readings.find(r => r.id === id);
    if (!reading || reading.isAiProcessed) return;

    try {
      const fullText = [
        ...(reading.cardInterpretations || []),
        (reading.cards?.length || 0) <= 1 ? reading.interpretation?.singleCard : '',
      ].filter(Boolean).join(' ');
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
        processedByAi: true,
        updatedAt: new Date().toISOString(),
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
    setReadings(prev => prev.map(r => r.id === id ? stampReadingUpdate({ ...r, isPublic: !r.isPublic }) : r));
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

  const clearSyncNotice = useCallback(() => {
    setSyncNotice(null);
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
  };
};
