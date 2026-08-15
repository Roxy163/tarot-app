import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CardKeywordMemory, QuizMemoryEntry, ReadingKeywordCandidate, TarotReading, SpreadDefinition, TarotCardMetadata } from '../types';
import { INITIAL_READINGS, OFFICIAL_SPREADS } from '../constants';
import { extractKeywords, recognizeCards, suggestReadingKeywords } from '../services/geminiService';
import {
  getUserCardKeywordMemory,
  getUserCardMetadata,
  getUserQuizMemory,
  getUserReadings,
  getUserSpreads,
  replaceUserReadings,
  saveUserCardKeywordMemory,
  saveUserCardMetadata,
  saveUserQuizMemory,
  saveUserSpreads,
} from '../lib/firebaseData';
import { getFriendlyCloudSyncError, isFirebaseOfflineError } from '../lib/firebaseErrors';
import {
  getLegacyCustomSpreadNameMap,
  normalizeLegacyReadingSpreadNames,
} from '../lib/spreadPersistence';
import {
  mergeCardMetadataSources,
  mergeKeywordMemorySources,
  mergeQuizMemorySources,
  getPersistableReadings,
  mergeReadingsForSignedInUser,
  mergeSpreadSources,
} from '../lib/readingSessionMerge';
import { trackEvent } from '../lib/analytics';
import { readJsonArrayWithBackup, writeJsonWithBackup } from '../lib/safeLocalStorage';

const CLOUD_SAVE_DEBOUNCE_MS = 1200;
const USER_READINGS_STORAGE_KEY = 'tarot_readings';
const GUEST_READINGS_STORAGE_KEY = 'tarot_guest_data';
const SPREADS_STORAGE_KEY = 'tarot_spreads';
const CARD_METADATA_STORAGE_KEY = 'tarot_card_metadata';
const CARD_KEYWORD_MEMORY_STORAGE_KEY = 'tarot_card_keyword_memory';
const QUIZ_MEMORY_STORAGE_KEY = 'tarot_quiz_memory';

type CloudSnapshotKey = 'readings' | 'spreads' | 'cardMetadata' | 'cardKeywordMemory' | 'quizMemory';

export type CloudSyncStatus = 'guest' | 'loading' | 'syncing' | 'synced' | 'error';

export interface CloudSyncInfo {
  status: CloudSyncStatus;
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  cloudReadingsCount: number | null;
  lastError: string | null;
}

const getSyncStorageKey = (uid: string) => `tarot_last_cloud_sync_at_${uid}`;
const getUserScopedStorageKey = (key: string, uid: string) => `${key}_${uid}`;

const createCloudSnapshots = (): Record<CloudSnapshotKey, string> => ({
  readings: '',
  spreads: '',
  cardMetadata: '',
  cardKeywordMemory: '',
  quizMemory: '',
});

const serializeCloudSnapshot = (value: unknown) => JSON.stringify(value);

export const getReadableSyncError = getFriendlyCloudSyncError;

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
  isLocalFallback = false,
) => {
  const activeDataKey = isAuthLoading ? 'auth-loading' : (session?.uid || 'guest');
  const exampleReadings = useMemo(() => INITIAL_READINGS.map(r => ({ ...r, isExample: true })), []);
  const [readings, setReadings] = useState<TarotReading[]>(INITIAL_READINGS.map(r => ({ ...r, isExample: true })));
  const [spreads, setSpreads] = useState<SpreadDefinition[]>(OFFICIAL_SPREADS);
  const [cardMetadata, setCardMetadata] = useState<TarotCardMetadata[]>([]);
  const [cardKeywordMemory, setCardKeywordMemory] = useState<CardKeywordMemory[]>([]);
  const [quizMemory, setQuizMemory] = useState<QuizMemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingReading, setEditingReading] = useState<TarotReading | null>(null);
  const [loadedDataKey, setLoadedDataKey] = useState<string | null>(null);
  const [isCloudSyncPaused, setIsCloudSyncPaused] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [cloudSyncInfo, setCloudSyncInfo] = useState<CloudSyncInfo>({
    status: isAuthLoading ? 'loading' : (session?.uid ? 'loading' : 'guest'),
    lastSyncedAt: null,
    lastAttemptAt: null,
    cloudReadingsCount: null,
    lastError: null,
  });
  const pendingGuestReadingsSyncRef = useRef(false);
  const pendingDeletedReadingIdsRef = useRef<Set<string>>(new Set());
  const cloudSyncedSnapshotsRef = useRef<Record<CloudSnapshotKey, string>>(createCloudSnapshots());

  const markCloudSnapshot = useCallback((key: CloudSnapshotKey, value: unknown) => {
    cloudSyncedSnapshotsRef.current[key] = serializeCloudSnapshot(value);
  }, []);

  const hasCloudSnapshotChanged = useCallback((key: CloudSnapshotKey, value: unknown) => (
    cloudSyncedSnapshotsRef.current[key] !== serializeCloudSnapshot(value)
  ), []);

  const markCloudSyncSuccess = useCallback((cloudReadingsCount?: number | null) => {
    if (!session?.uid) return;

    const syncedAt = new Date().toISOString();
    try {
      localStorage.setItem(getSyncStorageKey(session.uid), syncedAt);
    } catch (error) {
      console.warn('Failed to persist cloud sync timestamp:', error);
    }
    setCloudSyncInfo(prev => ({
      ...prev,
      status: 'synced',
      lastSyncedAt: syncedAt,
      lastAttemptAt: syncedAt,
      cloudReadingsCount: cloudReadingsCount ?? prev.cloudReadingsCount,
      lastError: null,
    }));
  }, [session?.uid]);

  const markCloudSyncError = useCallback((error: unknown) => {
    const attemptedAt = new Date().toISOString();
    setCloudSyncInfo(prev => ({
      ...prev,
      status: 'error',
      lastAttemptAt: attemptedAt,
      lastError: getReadableSyncError(error),
    }));
  }, []);

  const parseSavedArray = <T,>(key: string): T[] | null => {
    return readJsonArrayWithBackup<T>(key);
  };

  // 登录后从 Firebase 加载，访客模式使用本地数据。
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (isAuthLoading) {
        setLoadedDataKey(null);
        setCloudSyncInfo(prev => ({ ...prev, status: 'loading', lastError: null }));
        return;
      }

      setLoadedDataKey(null);
      setIsCloudSyncPaused(false);
      setSyncNotice(null);
      const savedUserReadings = session?.uid
        ? parseSavedArray<TarotReading>(getUserScopedStorageKey(USER_READINGS_STORAGE_KEY, session.uid)) || []
        : [];
      const savedGuestReadings = parseSavedArray<TarotReading>(GUEST_READINGS_STORAGE_KEY) || [];
      const savedSpreads = session?.uid
        ? [
            ...(parseSavedArray<SpreadDefinition>(getUserScopedStorageKey(SPREADS_STORAGE_KEY, session.uid)) || []),
            ...(parseSavedArray<SpreadDefinition>(SPREADS_STORAGE_KEY) || []),
          ]
        : parseSavedArray<SpreadDefinition>(SPREADS_STORAGE_KEY) || [];
      const localSpreadNameMap = getLegacyCustomSpreadNameMap(savedSpreads, OFFICIAL_SPREADS);
      const localGuestReadings = normalizeLegacyReadingSpreadNames(savedGuestReadings, localSpreadNameMap);
      const localUserReadings = normalizeLegacyReadingSpreadNames(savedUserReadings, localSpreadNameMap);
      const localSpreads = mergeSpreadSources([savedSpreads], OFFICIAL_SPREADS);
      const localMetadata = session?.uid
        ? parseSavedArray<TarotCardMetadata>(getUserScopedStorageKey(CARD_METADATA_STORAGE_KEY, session.uid)) || []
        : parseSavedArray<TarotCardMetadata>(CARD_METADATA_STORAGE_KEY) || [];
      const localKeywordMemory = session?.uid
        ? parseSavedArray<CardKeywordMemory>(getUserScopedStorageKey(CARD_KEYWORD_MEMORY_STORAGE_KEY, session.uid)) || []
        : parseSavedArray<CardKeywordMemory>(CARD_KEYWORD_MEMORY_STORAGE_KEY) || [];
      const localQuizMemory = session?.uid
        ? parseSavedArray<QuizMemoryEntry>(getUserScopedStorageKey(QUIZ_MEMORY_STORAGE_KEY, session.uid)) || []
        : parseSavedArray<QuizMemoryEntry>(QUIZ_MEMORY_STORAGE_KEY) || [];

      if (isLocalFallback) {
        pendingGuestReadingsSyncRef.current = Boolean(session?.uid && getPersistableReadings(localGuestReadings).length > 0);
        cloudSyncedSnapshotsRef.current = createCloudSnapshots();
        const fallbackReadings = session?.uid
          ? mergeReadingsForSignedInUser(session.uid, [
              localUserReadings,
              localGuestReadings,
            ])
          : localGuestReadings;

        setReadings(withExamplesOnlyWhenEmpty(exampleReadings, fallbackReadings));
        setSpreads(localSpreads);
        setCardMetadata(localMetadata);
        setCardKeywordMemory(localKeywordMemory);
        setQuizMemory(localQuizMemory);
        setIsCloudSyncPaused(Boolean(session?.uid));
        if (session?.uid) {
          markCloudSnapshot('readings', getPersistableReadings(fallbackReadings));
          markCloudSnapshot('spreads', localSpreads);
          markCloudSnapshot('cardMetadata', localMetadata);
          markCloudSnapshot('cardKeywordMemory', localKeywordMemory);
          markCloudSnapshot('quizMemory', localQuizMemory);
          setCloudSyncInfo(prev => ({
            ...prev,
            status: 'error',
            lastAttemptAt: new Date().toISOString(),
            cloudReadingsCount: null,
            lastError: '云端暂时连不上，可能没开 VPN；已进入本地模式。',
          }));
        } else {
          setCloudSyncInfo({
            status: 'guest',
            lastSyncedAt: null,
            lastAttemptAt: null,
            cloudReadingsCount: null,
            lastError: null,
          });
        }
        setLoadedDataKey(activeDataKey);
        return;
      }
      
      if (!session?.uid) {
        pendingGuestReadingsSyncRef.current = false;
        cloudSyncedSnapshotsRef.current = createCloudSnapshots();
        setReadings(withExamplesOnlyWhenEmpty(exampleReadings, localGuestReadings));
        setSpreads(localSpreads);
        setCardMetadata(localMetadata);
        setCardKeywordMemory(localKeywordMemory);
        setQuizMemory(localQuizMemory);
        setCloudSyncInfo({
          status: 'guest',
          lastSyncedAt: null,
          lastAttemptAt: null,
          cloudReadingsCount: null,
          lastError: null,
        });
        setLoadedDataKey(activeDataKey);
        return;
      }

      try {
        const lastSyncedAt = localStorage.getItem(getSyncStorageKey(session.uid));
        setCloudSyncInfo(prev => ({
          ...prev,
          status: 'loading',
          lastSyncedAt,
          lastError: null,
        }));

        const [cloudReadings, cloudSpreads, cloudMetadata, cloudKeywordMemory, cloudQuizMemory] = await Promise.all([
          getUserReadings(session.uid),
          getUserSpreads(session.uid),
          getUserCardMetadata(session.uid),
          getUserCardKeywordMemory(session.uid),
          getUserQuizMemory(session.uid),
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
        const mergedQuizMemory = mergeQuizMemorySources([cloudQuizMemory || [], localQuizMemory]);
        const persistableCloudReadings = getPersistableReadings(cloudReadingsNormalized);
        const persistableMergedReadings = getPersistableReadings(mergedReadings);
        const shouldPushMergedReadings = (
          getPersistableReadings(localGuestReadings).length > 0
          || serializeCloudSnapshot(persistableCloudReadings) !== serializeCloudSnapshot(persistableMergedReadings)
        );

        pendingGuestReadingsSyncRef.current = getPersistableReadings(localGuestReadings).length > 0;
        markCloudSnapshot('readings', shouldPushMergedReadings ? persistableCloudReadings : persistableMergedReadings);
        markCloudSnapshot('spreads', mergedSpreads);
        markCloudSnapshot('cardMetadata', mergedMetadata);
        markCloudSnapshot('cardKeywordMemory', mergedKeywordMemory);
        markCloudSnapshot('quizMemory', mergedQuizMemory);
        setReadings(withExamplesOnlyWhenEmpty(exampleReadings, mergedReadings));
        setSpreads(mergedSpreads);
        setCardMetadata(mergedMetadata);
        setCardKeywordMemory(mergedKeywordMemory);
        setQuizMemory(mergedQuizMemory);
        const syncedAt = new Date().toISOString();
        localStorage.setItem(getSyncStorageKey(session.uid), syncedAt);
        setCloudSyncInfo(prev => ({
          ...prev,
          status: 'synced',
          lastSyncedAt: syncedAt,
          lastAttemptAt: syncedAt,
          cloudReadingsCount: cloudReadingsNormalized.length,
          lastError: null,
        }));
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
        setQuizMemory(localQuizMemory);
        setIsCloudSyncPaused(true);
        markCloudSnapshot('readings', getPersistableReadings(fallbackReadings));
        markCloudSnapshot('spreads', localSpreads);
        markCloudSnapshot('cardMetadata', localMetadata);
        markCloudSnapshot('cardKeywordMemory', localKeywordMemory);
        markCloudSnapshot('quizMemory', localQuizMemory);
        if (!isFirebaseOfflineError(error)) {
          setSyncNotice('云端同步暂时不可用，已切换为本地暂存，避免覆盖云端典籍。');
        }
        markCloudSyncError(error);
      } finally {
        if (!cancelled) setLoadedDataKey(activeDataKey);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [activeDataKey, exampleReadings, isAuthLoading, isLocalFallback, markCloudSnapshot, markCloudSyncError, session?.uid]);

  // 保存数据：登录用户写入 Firebase，访客写入本地。
  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    const userReadings = readings.filter(r => !r.isExample);

    if (session?.uid) {
      writeJsonWithBackup(getUserScopedStorageKey(USER_READINGS_STORAGE_KEY, session.uid), userReadings);
      if (isCloudSyncPaused || isLocalFallback) return;

      const deletedReadingIds = Array.from(pendingDeletedReadingIdsRef.current);
      const shouldSaveReadings = (
        pendingGuestReadingsSyncRef.current
        || deletedReadingIds.length > 0
        || hasCloudSnapshotChanged('readings', userReadings)
      );
      if (!shouldSaveReadings) return;

      const attemptedAt = new Date().toISOString();
      setCloudSyncInfo(prev => ({
        ...prev,
        status: 'syncing',
        lastAttemptAt: attemptedAt,
        lastError: null,
      }));
      const timer = window.setTimeout(() => {
        replaceUserReadings(session.uid, userReadings, { deletedReadingIds })
          .then(result => {
            const privateChangeCount = result.privateReadingsWritten + result.privateReadingsDeleted;
            deletedReadingIds.forEach(id => pendingDeletedReadingIdsRef.current.delete(id));
            markCloudSnapshot('readings', userReadings);
            markCloudSyncSuccess(result.totalReadings);

            if (pendingGuestReadingsSyncRef.current) {
              localStorage.removeItem(GUEST_READINGS_STORAGE_KEY);
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
            markCloudSyncError(error);
            setSyncNotice('云端典籍保存失败，本机记录已保留；刷新或重新登录后会再次尝试同步。');
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    } else {
      writeJsonWithBackup(GUEST_READINGS_STORAGE_KEY, userReadings);
    }
  }, [activeDataKey, hasCloudSnapshotChanged, isAuthLoading, isCloudSyncPaused, isLocalFallback, loadedDataKey, markCloudSnapshot, markCloudSyncError, markCloudSyncSuccess, readings, session?.uid]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      writeJsonWithBackup(getUserScopedStorageKey(SPREADS_STORAGE_KEY, session.uid), spreads);
      if (isCloudSyncPaused || isLocalFallback) return;
      if (!hasCloudSnapshotChanged('spreads', spreads)) return;

      setCloudSyncInfo(prev => ({
        ...prev,
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
      }));
      const timer = window.setTimeout(() => {
        saveUserSpreads(session.uid, spreads)
          .then(() => {
            markCloudSnapshot('spreads', spreads);
            markCloudSyncSuccess();
          })
          .catch(error => {
            console.error('Failed to save spreads:', error);
            setIsCloudSyncPaused(true);
            markCloudSyncError(error);
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    writeJsonWithBackup(SPREADS_STORAGE_KEY, spreads);
  }, [activeDataKey, hasCloudSnapshotChanged, isAuthLoading, isCloudSyncPaused, isLocalFallback, loadedDataKey, markCloudSnapshot, markCloudSyncError, markCloudSyncSuccess, session?.uid, spreads]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      writeJsonWithBackup(getUserScopedStorageKey(CARD_METADATA_STORAGE_KEY, session.uid), cardMetadata);
      if (isCloudSyncPaused || isLocalFallback) return;
      if (!hasCloudSnapshotChanged('cardMetadata', cardMetadata)) return;

      setCloudSyncInfo(prev => ({
        ...prev,
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
      }));
      const timer = window.setTimeout(() => {
        saveUserCardMetadata(session.uid, cardMetadata)
          .then(() => {
            markCloudSnapshot('cardMetadata', cardMetadata);
            markCloudSyncSuccess();
          })
          .catch(error => {
            console.error('Failed to save card metadata:', error);
            setIsCloudSyncPaused(true);
            markCloudSyncError(error);
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    writeJsonWithBackup(CARD_METADATA_STORAGE_KEY, cardMetadata);
  }, [activeDataKey, cardMetadata, hasCloudSnapshotChanged, isAuthLoading, isCloudSyncPaused, isLocalFallback, loadedDataKey, markCloudSnapshot, markCloudSyncError, markCloudSyncSuccess, session?.uid]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      writeJsonWithBackup(getUserScopedStorageKey(CARD_KEYWORD_MEMORY_STORAGE_KEY, session.uid), cardKeywordMemory);
      if (isCloudSyncPaused || isLocalFallback) return;
      if (!hasCloudSnapshotChanged('cardKeywordMemory', cardKeywordMemory)) return;

      setCloudSyncInfo(prev => ({
        ...prev,
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
      }));
      const timer = window.setTimeout(() => {
        saveUserCardKeywordMemory(session.uid, cardKeywordMemory)
          .then(() => {
            markCloudSnapshot('cardKeywordMemory', cardKeywordMemory);
            markCloudSyncSuccess();
          })
          .catch(error => {
            console.error('Failed to save card keyword memory:', error);
            setIsCloudSyncPaused(true);
            markCloudSyncError(error);
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    writeJsonWithBackup(CARD_KEYWORD_MEMORY_STORAGE_KEY, cardKeywordMemory);
  }, [activeDataKey, cardKeywordMemory, hasCloudSnapshotChanged, isAuthLoading, isCloudSyncPaused, isLocalFallback, loadedDataKey, markCloudSnapshot, markCloudSyncError, markCloudSyncSuccess, session?.uid]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (loadedDataKey !== activeDataKey) return;

    if (session?.uid) {
      writeJsonWithBackup(getUserScopedStorageKey(QUIZ_MEMORY_STORAGE_KEY, session.uid), quizMemory);
      if (isCloudSyncPaused || isLocalFallback) return;
      if (!hasCloudSnapshotChanged('quizMemory', quizMemory)) return;

      setCloudSyncInfo(prev => ({
        ...prev,
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
      }));
      const timer = window.setTimeout(() => {
        saveUserQuizMemory(session.uid, quizMemory)
          .then(() => {
            markCloudSnapshot('quizMemory', quizMemory);
            markCloudSyncSuccess();
          })
          .catch(error => {
            console.error('Failed to save quiz memory:', error);
            setIsCloudSyncPaused(true);
            markCloudSyncError(error);
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return () => window.clearTimeout(timer);
    }

    writeJsonWithBackup(QUIZ_MEMORY_STORAGE_KEY, quizMemory);
  }, [activeDataKey, hasCloudSnapshotChanged, isAuthLoading, isCloudSyncPaused, isLocalFallback, loadedDataKey, markCloudSnapshot, markCloudSyncError, markCloudSyncSuccess, quizMemory, session?.uid]);

  const handleManualCloudSync = useCallback(async () => {
    if (!session?.uid) {
      setSyncNotice('登录后才能进行云端同步。');
      return;
    }

    const uid = session.uid;
    setIsCloudSyncPaused(false);
    setCloudSyncInfo(prev => ({
      ...prev,
      status: 'syncing',
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
    }));

    try {
      const [cloudReadings, cloudSpreads, cloudMetadata, cloudKeywordMemory, cloudQuizMemory] = await Promise.all([
        getUserReadings(uid),
        getUserSpreads(uid),
        getUserCardMetadata(uid),
        getUserCardKeywordMemory(uid),
        getUserQuizMemory(uid),
      ]);

      const cloudSpreadNameMap = getLegacyCustomSpreadNameMap(cloudSpreads, OFFICIAL_SPREADS);
      const cloudReadingsNormalized = normalizeLegacyReadingSpreadNames(cloudReadings, cloudSpreadNameMap);
      const currentReadings = readings.filter(reading => !reading.isExample);
      const mergedReadings = mergeReadingsForSignedInUser(uid, [
        cloudReadingsNormalized,
        currentReadings,
      ]);
      const mergedSpreads = mergeSpreadSources([cloudSpreads || [], spreads], OFFICIAL_SPREADS);
      const mergedMetadata = mergeCardMetadataSources([cloudMetadata || [], cardMetadata]);
      const mergedKeywordMemory = mergeKeywordMemorySources([cloudKeywordMemory || [], cardKeywordMemory]);
      const mergedQuizMemory = mergeQuizMemorySources([cloudQuizMemory || [], quizMemory]);
      const deletedReadingIds = Array.from(pendingDeletedReadingIdsRef.current);

      const [readingSyncResult] = await Promise.all([
        replaceUserReadings(uid, mergedReadings, { deletedReadingIds }),
        saveUserSpreads(uid, mergedSpreads),
        saveUserCardMetadata(uid, mergedMetadata),
        saveUserCardKeywordMemory(uid, mergedKeywordMemory),
        saveUserQuizMemory(uid, mergedQuizMemory),
      ]);

      deletedReadingIds.forEach(id => pendingDeletedReadingIdsRef.current.delete(id));
      pendingGuestReadingsSyncRef.current = false;
      localStorage.removeItem(GUEST_READINGS_STORAGE_KEY);
      setReadings(withExamplesOnlyWhenEmpty(exampleReadings, mergedReadings));
      setSpreads(mergedSpreads);
      setCardMetadata(mergedMetadata);
      setCardKeywordMemory(mergedKeywordMemory);
      setQuizMemory(mergedQuizMemory);
      markCloudSnapshot('readings', getPersistableReadings(mergedReadings));
      markCloudSnapshot('spreads', mergedSpreads);
      markCloudSnapshot('cardMetadata', mergedMetadata);
      markCloudSnapshot('cardKeywordMemory', mergedKeywordMemory);
      markCloudSnapshot('quizMemory', mergedQuizMemory);
      markCloudSyncSuccess(readingSyncResult.totalReadings);
      setSyncNotice(`云端同步完成：典籍 ${readingSyncResult.totalReadings} 条。`);
    } catch (error) {
      console.error('Manual cloud sync failed:', error);
      setIsCloudSyncPaused(true);
      markCloudSyncError(error);
      setSyncNotice('手动同步失败，本机记录已保留；请稍后重试。');
    }
  }, [
    cardKeywordMemory,
    cardMetadata,
    exampleReadings,
    markCloudSyncError,
    markCloudSnapshot,
    markCloudSyncSuccess,
    quizMemory,
    readings,
    session?.uid,
    spreads,
  ]);
  // 添加阅读记录
  const handleAddReading = useCallback(async (newReading: any, profile?: { display_name?: string; nickname?: string }, onShowSnackbar?: (msg: string) => void) => {
    setIsProcessing(true);
    try {
      const readingData = {
        ...newReading,
        cards: newReading.cards || [],
        keywords: newReading.keywords || (editingReading?.keywords || ['塔罗', '研习']),
        manualTags: newReading.manualTags || editingReading?.manualTags || [],
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

      if (savedReading) {
        trackEvent('reading_saved', {
          action: editingReading?.id ? 'edit' : 'create',
          audience: savedReading.isForClient ? 'querent' : 'self',
          card_count: savedReading.cards?.length || 0,
          spread_count: savedReading.slotLabels?.length || savedReading.cards?.length || 0,
          has_review: Boolean(savedReading.userFeedback?.trim()),
          is_public: Boolean(savedReading.isPublic),
          is_anonymous: Boolean(savedReading.isAnonymous),
          label_count: savedReading.manualTags?.length || 0,
          auth_state: session?.uid ? 'signed_in' : 'guest',
        });
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
      trackEvent('reading_ai_processed', {
        card_count: recognizedCards.length || reading.cards?.length || 0,
        suggestion_count: keywordCandidates.length,
      });
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
    if (session?.uid) {
      pendingDeletedReadingIdsRef.current.add(id);
    }
    setReadings(prev => prev.filter(r => r.id !== id));
  }, [session?.uid]);

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
  };
};
