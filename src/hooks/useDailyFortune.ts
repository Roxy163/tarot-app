import { useState, useEffect, useCallback, useRef } from 'react';
import { DailyFortune, DailyFortuneReflectionParts, FortuneSummary } from '../types';
import { TAROT_CARDS } from '../constants';
import {
  createDailyReflectionPatch,
  hasDailyReflectionContent,
} from '../lib/dailyFortuneReflection';
import { buildDailyFortuneAnnotationNote } from '../lib/dailyFortuneReview';
import { mergeDailyFortuneSources } from '../lib/dailyFortuneCloudSync';
import { trackEvent } from '../lib/analytics';
import { getUserDailyFortunes, saveUserDailyFortunes } from '../lib/firebaseData';
import { readJsonArrayWithBackup, writeJsonWithBackup } from '../lib/safeLocalStorage';

const STORAGE_KEY = 'tarot_daily_fortunes';
const CLOUD_SAVE_DEBOUNCE_MS = 1200;
const GUEST_DAILY_FORTUNES_OWNER_KEY = `${STORAGE_KEY}_owner`;

const serializeCloudFortunes = (fortunes: DailyFortune[]) => JSON.stringify(fortunes);

const getDailyFortuneStorageKey = (uid?: string) => (
  uid ? `${STORAGE_KEY}_${uid}` : STORAGE_KEY
);

const getReflectionAnalyticsFlags = (reflection?: string | DailyFortuneReflectionParts) => {
  if (typeof reflection === 'string') {
    return {
      has_initial: false,
      has_review: Boolean(reflection.trim()),
      has_combined: Boolean(reflection.trim()),
    };
  }

  return {
    has_initial: Boolean(reflection?.initialImpression?.trim()),
    has_review: Boolean(reflection?.dailyReview?.trim()),
    has_combined: false,
  };
};

const createFortuneId = () => (
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `fortune-${crypto.randomUUID()}`
    : `fortune-${Date.now()}`
);

const getDailyCardInterpretation = (cardName: string, isReversed: boolean) => {
  const interpretations: Record<string, { reversed: string; upright: string }> = {
    '魔术师': { upright: '今天是充满创造力和行动力的一天，你拥有实现目标所需的全部资源。', reversed: '小心过度自信或操控他人的倾向，保持真诚。' },
    '女祭司': { upright: '信任你的直觉，内心深处的智慧正在指引你。', reversed: '可能需要面对隐藏的情绪或秘密。' },
    '皇后': { upright: '丰收与喜悦的一天，人际关系和谐美满。', reversed: '注意不要过度依赖他人或忽视自我关怀。' },
    '皇帝': { upright: '展现你的领导力，今天适合做出重要决定。', reversed: '避免独裁或僵化的思维方式。' },
    '教皇': { upright: '寻求传统智慧的指引，或成为他人的导师。', reversed: '质疑权威，寻找自己的真理。' },
    '恋人': { upright: '爱情与和谐，重要的关系决策即将到来。', reversed: '关系中可能存在冲突或不诚实。' },
    '战车': { upright: '勇往直前，战胜挑战，胜利就在前方。', reversed: '小心冲动或失控的行为。' },
    '力量': { upright: '内心的力量与勇气将帮助你克服困难。', reversed: '可能感到软弱或被他人操控。' },
    '隐士': { upright: '独处和内省将带来深刻的洞察。', reversed: '孤独可能变成孤立，不要逃避社交。' },
    '命运之轮': { upright: '命运的转变正在发生，顺势而为。', reversed: '抗拒变化可能导致困境。' },
    '正义': { upright: '真理终将显现，公平与平衡将得到恢复。', reversed: '偏见或不公可能影响判断。' },
    '倒吊人': { upright: '放下执念，新的视角将带来解脱。', reversed: '抗拒放下可能导致痛苦。' },
    '死神': { upright: '结束即是新的开始，拥抱转变。', reversed: '抗拒终结可能阻碍成长。' },
    '节制': { upright: '平衡与耐心将引领你走向成功。', reversed: '过度或不足都可能带来问题。' },
    '恶魔': { upright: '面对你的恐惧和欲望，才能获得自由。', reversed: '摆脱束缚，重获自由。' },
    '塔': { upright: '突如其来的变化将摧毁旧有的结构。', reversed: '逃避危机可能导致更大的问题。' },
    '星星': { upright: '希望与灵感，梦想即将实现。', reversed: '失望或缺乏信心可能阻碍进展。' },
    '月亮': { upright: '探索潜意识，真相将逐渐显现。', reversed: '混乱或错觉可能影响判断。' },
    '太阳': { upright: '喜悦、成功和光明的一天。', reversed: '暂时的挫折，保持乐观。' },
    '审判': { upright: '觉醒与重生，重要的召唤正在到来。', reversed: '抗拒召唤可能错过良机。' },
    '世界': { upright: '圆满完成，新的旅程即将开始。', reversed: '未完成的事务可能需要关注。' },
  };

  const defaultInterpretation = {
    upright: '今天是充满可能性的一天，保持开放的心态迎接新的机遇。',
    reversed: '今天需要更加谨慎，反思自己的方向。'
  };

  const cardInterpretation = interpretations[cardName] || defaultInterpretation;
  return isReversed ? cardInterpretation.reversed : cardInterpretation.upright;
};

export const useDailyFortune = (
  session: { uid?: string; email?: string | null } | null = null,
  isAuthLoading = false,
) => {
  const activeDataKey = isAuthLoading ? 'auth-loading' : (session?.uid || 'guest');
  const storageKey = getDailyFortuneStorageKey(session?.uid);
  const [fortunes, setFortunes] = useState<DailyFortune[]>(() => {
    return readJsonArrayWithBackup<DailyFortune>(storageKey) || [];
  });
  const [shuffledDeck, setShuffledDeck] = useState<number[]>([]);
  const [loadedDataKey, setLoadedDataKey] = useState<string | null>(isAuthLoading ? null : activeDataKey);
  const [isCloudSyncPaused, setIsCloudSyncPaused] = useState(false);
  const pendingGuestFortunesSyncRef = useRef(false);
  const cloudFortunesSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFortunes = async () => {
      if (isAuthLoading) {
        setLoadedDataKey(null);
        return;
      }

      setLoadedDataKey(null);
      setIsCloudSyncPaused(false);

      const localFortunes = readJsonArrayWithBackup<DailyFortune>(storageKey) || [];

      if (!session?.uid) {
        pendingGuestFortunesSyncRef.current = false;
        cloudFortunesSnapshotRef.current = null;
        setFortunes(localFortunes);
        setLoadedDataKey(activeDataKey);
        return;
      }

      try {
        const guestFortunes = localStorage.getItem(GUEST_DAILY_FORTUNES_OWNER_KEY) === 'guest'
          ? readJsonArrayWithBackup<DailyFortune>(STORAGE_KEY) || []
          : [];
        const cloudFortunes = await getUserDailyFortunes(session.uid);
        if (cancelled) return;

        pendingGuestFortunesSyncRef.current = guestFortunes.length > 0;
        const mergedFortunes = mergeDailyFortuneSources(session.uid, [
          cloudFortunes || [],
          localFortunes,
          guestFortunes,
        ]);
        const normalizedCloudFortunes = mergeDailyFortuneSources(session.uid, [cloudFortunes || []]);
        const shouldPushMergedFortunes = (
          pendingGuestFortunesSyncRef.current
          || serializeCloudFortunes(normalizedCloudFortunes) !== serializeCloudFortunes(mergedFortunes)
        );
        cloudFortunesSnapshotRef.current = shouldPushMergedFortunes
          ? serializeCloudFortunes(normalizedCloudFortunes)
          : serializeCloudFortunes(mergedFortunes);
        setFortunes(mergedFortunes);
        writeJsonWithBackup(storageKey, mergedFortunes);
      } catch (error) {
        console.warn('Daily fortune cloud load failed; keeping local copy only:', error);
        if (cancelled) return;

        setFortunes(localFortunes);
        setIsCloudSyncPaused(true);
      } finally {
        if (!cancelled) setLoadedDataKey(activeDataKey);
      }
    };

    loadFortunes();
    return () => {
      cancelled = true;
    };
  }, [activeDataKey, isAuthLoading, session?.uid, storageKey]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    writeJsonWithBackup(storageKey, fortunes);
    if (!session?.uid) {
      localStorage.setItem(GUEST_DAILY_FORTUNES_OWNER_KEY, 'guest');
    }

    if (!session?.uid || isCloudSyncPaused) return;

    const uid = session.uid;
    const cloudFortunes = mergeDailyFortuneSources(uid, [fortunes]);
    const nextSnapshot = serializeCloudFortunes(cloudFortunes);
    const shouldSaveCloudFortunes = (
      pendingGuestFortunesSyncRef.current
      || cloudFortunesSnapshotRef.current !== nextSnapshot
    );
    if (!shouldSaveCloudFortunes) return;

    const timer = window.setTimeout(() => {
      saveUserDailyFortunes(uid, cloudFortunes)
        .then(() => {
          cloudFortunesSnapshotRef.current = nextSnapshot;
          if (pendingGuestFortunesSyncRef.current) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(GUEST_DAILY_FORTUNES_OWNER_KEY);
            pendingGuestFortunesSyncRef.current = false;
          }
        })
        .catch(error => {
          console.warn('Daily fortune cloud save failed; local copy was kept:', error);
          setIsCloudSyncPaused(true);
        });
    }, CLOUD_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    activeDataKey,
    fortunes,
    isAuthLoading,
    isCloudSyncPaused,
    loadedDataKey,
    session?.uid,
    storageKey,
  ]);

  const shuffleDeck = useCallback(() => {
    const deck = [...Array(TAROT_CARDS.length).keys()];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setShuffledDeck(deck);
    trackEvent('daily_deck_shuffled', {
      deck_size: deck.length,
      auth_state: session?.uid ? 'signed_in' : 'guest',
    });
    return deck;
  }, [session?.uid]);

  const getToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return fortunes.find(f => f.date === today);
  }, [fortunes]);

  const createFortuneFromCard = useCallback((
    card: typeof TAROT_CARDS[0],
    isReversed: boolean,
    source: DailyFortune['source'] = 'app-draw'
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    const fortune: DailyFortune = {
      id: createFortuneId(),
      userId: session?.uid || 'local',
      date: today,
      cardName: card.name,
      isReversed,
      interpretation: getDailyCardInterpretation(card.name, isReversed),
      keywords: [card.name, isReversed ? '逆位' : '正位'],
      source,
      createdAt: now,
      updatedAt: now,
      isRevealed: true
    };

    setFortunes(prev => {
      const filtered = prev.filter(f => f.date !== today);
      return [...filtered, fortune];
    });
    trackEvent('daily_fortune_saved', {
      source,
      is_reversed: isReversed,
      auth_state: session?.uid ? 'signed_in' : 'guest',
    });
    return fortune;
  }, [session?.uid]);

  const generateDailyFortune = useCallback(() => {
    const existing = getToday();
    if (existing) {
      return existing;
    }

    const randomIndex = Math.floor(Math.random() * TAROT_CARDS.length);
    const card = TAROT_CARDS[randomIndex];
    const isReversed = Math.random() > 0.7;

    return createFortuneFromCard(card, isReversed);
  }, [createFortuneFromCard, getToday]);

  const generateDailyFortuneWithNumber = useCallback((
    cardNumber: number,
    selectedCardIndex?: number,
    replaceExisting = false
  ) => {
    const existing = getToday();
    if (existing && !replaceExisting) {
      return existing;
    }

    const index = cardNumber - 1;
    if (index < 0 || index >= TAROT_CARDS.length) {
      return null;
    }

    let cardIndex = index;
    if (typeof selectedCardIndex === 'number') {
      cardIndex = selectedCardIndex;
    } else if (shuffledDeck.length > 0) {
      cardIndex = shuffledDeck[index] || index;
    }

    const card = TAROT_CARDS[cardIndex];
    const isReversed = Math.random() > 0.7;

    return createFortuneFromCard(card, isReversed, 'app-draw');
  }, [createFortuneFromCard, getToday, shuffledDeck]);

  const reshuffleDailyFortune = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * TAROT_CARDS.length);
    const card = TAROT_CARDS[randomIndex];
    const isReversed = Math.random() > 0.7;

    return createFortuneFromCard(card, isReversed, 'app-draw');
  }, [createFortuneFromCard]);

  const createDailyFortuneFromCard = useCallback((
    cardId: string,
    isReversed: boolean,
    source: NonNullable<DailyFortune['source']> = 'physical-draw'
  ) => {
    const card = TAROT_CARDS.find(item => item.id === cardId || item.name === cardId);
    if (!card) return null;

    return createFortuneFromCard(card, isReversed, source);
  }, [createFortuneFromCard]);

  const updateDailyFortuneCard = useCallback((
    fortuneId: string,
    cardId: string,
    isReversed: boolean
  ) => {
    const card = TAROT_CARDS.find(item => item.id === cardId || item.name === cardId);
    if (!card) return;
    const updatedAt = new Date().toISOString();

    setFortunes(prev => prev.map(f => (
      f.id === fortuneId
        ? {
            ...f,
            cardName: card.name,
            isReversed,
            interpretation: getDailyCardInterpretation(card.name, isReversed),
            keywords: [card.name, isReversed ? '逆位' : '正位'],
            isRevealed: true,
            updatedAt
          }
        : f
    )));
    trackEvent('daily_fortune_updated', { is_reversed: isReversed });
  }, []);

  const addReflection = useCallback((fortuneId: string, reflection: string | DailyFortuneReflectionParts) => {
    const updatedAt = new Date().toISOString();
    setFortunes(prev => prev.map(f => 
      f.id === fortuneId ? { ...f, ...createDailyReflectionPatch(reflection), updatedAt } : f
    ));
    trackEvent('daily_reflection_saved', getReflectionAnalyticsFlags(reflection));
  }, []);

  const archiveDailyFortune = useCallback((fortuneId: string, reflection?: string | DailyFortuneReflectionParts) => {
    const archivedAt = new Date().toISOString();

    setFortunes(prev => prev.map(f => (
      f.id === fortuneId
        ? {
            ...f,
            archivedAt: f.archivedAt || archivedAt,
            updatedAt: archivedAt,
            ...(reflection !== undefined ? createDailyReflectionPatch(reflection) : {})
          }
        : f
    )));
    trackEvent('daily_fortune_archived', {
      ...getReflectionAnalyticsFlags(reflection),
      with_review_input: reflection !== undefined,
    });
  }, []);

  const updateDailyFortuneReflection = useCallback((fortuneId: string, reflection: string | DailyFortuneReflectionParts) => {
    const updatedAt = new Date().toISOString();
    setFortunes(prev => prev.map(f => (
      f.id === fortuneId ? { ...f, ...createDailyReflectionPatch(reflection), updatedAt } : f
    )));
    trackEvent('daily_reflection_saved', getReflectionAnalyticsFlags(reflection));
  }, []);

  const saveDailyFortuneToCardAnnotation = useCallback((fortuneId: string, note?: string) => {
    const updatedAt = new Date().toISOString();

    setFortunes(prev => prev.map(fortune => {
      if (fortune.id !== fortuneId || !hasDailyReflectionContent(fortune)) return fortune;

      return {
        ...fortune,
        savedToCardAnnotationAt: fortune.savedToCardAnnotationAt || updatedAt,
        cardAnnotationNote: (note || buildDailyFortuneAnnotationNote(fortune)).trim(),
        updatedAt,
      };
    }));
    trackEvent('daily_annotation_saved');
  }, []);

  const getArchivedFortunes = useCallback(() => (
    fortunes
      .filter(f => Boolean(f.archivedAt))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  ), [fortunes]);

  const getMonthlySummary = useCallback((year: number, month: number): FortuneSummary | null => {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    
    const monthFortunes = fortunes.filter(f => 
      f.date >= startDate && f.date <= endDate
    );

    if (monthFortunes.length === 0) return null;

    const cardCounts: Record<string, number> = {};
    let reversedCount = 0;
    const allCards: string[] = [];

    monthFortunes.forEach(f => {
      cardCounts[f.cardName] = (cardCounts[f.cardName] || 0) + 1;
      if (f.isReversed) reversedCount++;
      allCards.push(f.cardName);
    });

    const mostFrequentCard = Object.entries(cardCounts).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )[0];

    const keyThemes = Object.entries(cardCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const adviceMap: Record<string, string> = {
      '魔术师': '运用你的创造力',
      '女祭司': '相信直觉',
      '皇后': '享受生活',
      '皇帝': '展现领导力',
      '教皇': '寻求智慧',
      '恋人': '关注关系',
      '战车': '勇往直前',
      '力量': '保持勇气',
      '隐士': '静心内省',
      '命运之轮': '顺势而为',
      '正义': '追求公平',
      '倒吊人': '放下执念',
      '死神': '拥抱转变',
      '节制': '保持平衡',
      '恶魔': '面对恐惧',
      '塔': '接受改变',
      '星星': '保持希望',
      '月亮': '探索内心',
      '太阳': '享受喜悦',
      '审判': '倾听召唤',
      '世界': '庆祝完成',
    };

    const advice = keyThemes.map(t => adviceMap[t] || t).join('，');

    return {
      period: `${year}年${month + 1}月`,
      periodType: 'month',
      cards: allCards,
      insights: {
        mostFrequentCard,
        reversedCount,
        keyThemes,
        advice: `本月主题：${advice}。共记录${monthFortunes.length}天日运，其中${reversedCount}天为逆位。`
      },
      startDate,
      endDate
    };
  }, [fortunes]);

  const getSeasonalSummary = useCallback((year: number, season: 'spring' | 'summer' | 'autumn' | 'winter'): FortuneSummary | null => {
    const seasonMonths: Record<string, number[]> = {
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      autumn: [8, 9, 10],
      winter: [11, 0, 1]
    };

    const months = seasonMonths[season];
    const seasonFortunes = fortunes.filter(f => {
      const date = new Date(f.date);
      const month = date.getMonth();
      return months.includes(month);
    });

    if (seasonFortunes.length === 0) return null;

    const cardCounts: Record<string, number> = {};
    let reversedCount = 0;
    const allCards: string[] = [];

    seasonFortunes.forEach(f => {
      cardCounts[f.cardName] = (cardCounts[f.cardName] || 0) + 1;
      if (f.isReversed) reversedCount++;
      allCards.push(f.cardName);
    });

    const mostFrequentCard = Object.entries(cardCounts).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )[0];

    const keyThemes = Object.entries(cardCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const seasonNames = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };

    return {
      period: `${year}年${seasonNames[season]}`,
      periodType: 'season',
      cards: allCards,
      insights: {
        mostFrequentCard,
        reversedCount,
        keyThemes,
        advice: `本季共记录${seasonFortunes.length}天日运，${keyThemes.join('、')}是主要主题。`
      },
      startDate: seasonFortunes[0]?.date || '',
      endDate: seasonFortunes[seasonFortunes.length - 1]?.date || ''
    };
  }, [fortunes]);

  const getYearlySummary = useCallback((year: number): FortuneSummary | null => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const yearFortunes = fortunes.filter(f => 
      f.date >= startDate && f.date <= endDate
    );

    if (yearFortunes.length === 0) return null;

    const cardCounts: Record<string, number> = {};
    let reversedCount = 0;
    const allCards: string[] = [];

    yearFortunes.forEach(f => {
      cardCounts[f.cardName] = (cardCounts[f.cardName] || 0) + 1;
      if (f.isReversed) reversedCount++;
      allCards.push(f.cardName);
    });

    const mostFrequentCard = Object.entries(cardCounts).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )[0];

    const keyThemes = Object.entries(cardCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    return {
      period: `${year}年度`,
      periodType: 'year',
      cards: allCards,
      insights: {
        mostFrequentCard,
        reversedCount,
        keyThemes,
        advice: `年度回顾：${yearFortunes.length}天日运记录。${keyThemes.join('、')}是今年的核心主题。`
      },
      startDate,
      endDate
    };
  }, [fortunes]);

  return {
    fortunes,
    shuffledDeck,
    shuffleDeck,
    getToday,
    generateDailyFortune,
    generateDailyFortuneWithNumber,
    reshuffleDailyFortune,
    createDailyFortuneFromCard,
    updateDailyFortuneCard,
    addReflection,
    archiveDailyFortune,
    updateDailyFortuneReflection,
    saveDailyFortuneToCardAnnotation,
    getArchivedFortunes,
    getMonthlySummary,
    getSeasonalSummary,
    getYearlySummary
  };
};

export const QUICK_SPREADS = [
  { id: 'daily', name: '日运', icon: 'Sun', spread: '单牌阵', category: '日运', description: '记录今天这一张牌' },
  { id: 'weekly', name: '周运', icon: 'Calendar', spread: '无牌阵三张', category: '周运', description: '记录本周三张牌' },
  { id: 'monthly', name: '月运', icon: 'Moon', spread: '时间流牌阵', category: '月运', description: '记录本月时间流' },
  { id: 'yearly', name: '年运', icon: 'Star', spread: '年运十二宫牌阵', category: '年运', description: '记录年度十二宫' },
  { id: 'seasonal', name: '四季', icon: 'Leaf', spread: '四季牌阵', category: '四季', description: '记录四季节律' },
];
