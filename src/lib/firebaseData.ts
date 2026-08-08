import type { User } from 'firebase/auth';
import type { CardKeywordMemory, DailyFortune, QuizMemoryEntry, SpreadDefinition, TarotCardMetadata, TarotReading, UserProfile } from '../types';
import { getFirebaseApp } from './firebase';
import { isFirebaseOfflineError } from './firebaseErrors';
import { createUserReadingSyncPlan, UserReadingSyncOptions } from './readingCloudSync';
import { readJsonRecordWithBackup, writeJsonWithBackup } from './safeLocalStorage';

type FirestoreApi = typeof import('firebase/firestore');
type StorageApi = typeof import('firebase/storage');

export interface UserReadingSyncResult {
  totalReadings: number;
  previousReadings: number;
  privateReadingsWritten: number;
  privateReadingsDeleted: number;
  publicReadingsSaved: number;
  publicReadingsDeleted: number;
  publicMirrorWarning?: string;
  publicMirrorDeleteWarning?: string;
}

let firestoreApiPromise: Promise<FirestoreApi> | null = null;
let storageApiPromise: Promise<StorageApi> | null = null;

const loadFirestore = () => {
  firestoreApiPromise ||= import('firebase/firestore');
  return firestoreApiPromise;
};

const loadStorage = () => {
  storageApiPromise ||= import('firebase/storage');
  return storageApiPromise;
};

const getFirebaseDb = async () => {
  const { getFirestore } = await loadFirestore();
  return getFirestore(await getFirebaseApp());
};

const getFirebaseStorage = async () => {
  const { getStorage } = await loadStorage();
  return getStorage(await getFirebaseApp());
};

export interface NumerologySetting {
  numerology: number;
  meaning: string;
  keywords: string;
}

const getCardDocId = (cardName: string) => encodeURIComponent(cardName);

const withoutUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const PUBLIC_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PUBLIC_ID_LENGTH = 8;
const PROFILE_CACHE_KEY = 'tarot_cached_profile';
const PROFILE_PENDING_UPDATE_KEY = 'tarot_pending_profile_update';

const generatePublicId = (uid: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < uid.length; index += 1) {
    hash ^= uid.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  let value = hash >>> 0;
  let code = '';

  for (let index = 0; index < PUBLIC_ID_LENGTH; index += 1) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    code += PUBLIC_ID_ALPHABET[value % PUBLIC_ID_ALPHABET.length];
  }

  return `TAROT-${code}`;
};

const shouldRefreshPublicId = (publicId?: string) => (
  !publicId
  || publicId === 'TAROT-INIT-0000'
  || publicId === 'TAROT-PENDING'
  || /^TAROT-\d{4}-[A-Z2-9]{4}$/.test(publicId)
  || /^TAROT-\d{6}-[A-Z0-9]{8,}$/.test(publicId)
  || /^TAROT-\d{6}-[A-Za-z0-9]+$/.test(publicId)
  || !/^TAROT-[A-Z0-9]{8}$/.test(publicId)
);

const createDefaultProfile = (user: User, publicId: string): UserProfile => {
  const createdAt = new Date().toISOString();
  const displayName = user.displayName || user.email?.split('@')[0] || '研习阁主';

  return {
    id: user.uid,
    display_name: displayName,
    nickname: displayName,
    bio: '研精覃思，洞见未来',
    signature: '研精覃思，洞见未来',
    createdAt,
    user_public_id: publicId,
  };
};

const getProfileCacheKey = (uid: string) => `${PROFILE_CACHE_KEY}_${uid}`;
const getProfilePendingUpdateKey = (uid: string) => `${PROFILE_PENDING_UPDATE_KEY}_${uid}`;

const normalizeProfilePatch = (updated: Partial<UserProfile>): Partial<UserProfile> => {
  const normalized: Partial<UserProfile> = { ...updated };

  delete normalized.id;
  delete normalized.password;
  delete normalized.user_public_id;
  delete normalized.createdAt;
  delete normalized.updatedAt;

  if (typeof updated.display_name === 'string') {
    const nextName = updated.display_name.trim() || '研习阁主';
    normalized.display_name = nextName;
    normalized.nickname = nextName;
  } else if (typeof updated.nickname === 'string') {
    const nextName = updated.nickname.trim() || '研习阁主';
    normalized.display_name = nextName;
    normalized.nickname = nextName;
  }

  if (typeof updated.bio === 'string') {
    const nextBio = updated.bio.trim() || '研习覃思，洞见未来';
    normalized.bio = nextBio;
    normalized.signature = nextBio;
  } else if (typeof updated.signature === 'string') {
    const nextBio = updated.signature.trim() || '研习覃思，洞见未来';
    normalized.bio = nextBio;
    normalized.signature = nextBio;
  }

  return withoutUndefined(normalized);
};

const readStoredProfilePatch = (uid: string): Partial<UserProfile> | null => {
  const value = readJsonRecordWithBackup<Record<string, unknown>>(getProfilePendingUpdateKey(uid));
  if (!value) return null;

  return normalizeProfilePatch(value as Partial<UserProfile>);
};

export const hasPendingUserProfileUpdate = (uid: string) => !!readStoredProfilePatch(uid);

const cachePendingProfilePatch = (uid: string, updated: Partial<UserProfile>) => {
  const existing = readStoredProfilePatch(uid) || {};
  writeJsonWithBackup(getProfilePendingUpdateKey(uid), normalizeProfilePatch({
    ...existing,
    ...updated,
  }));
};

const clearPendingProfilePatch = (uid: string) => {
  try {
    localStorage.removeItem(getProfilePendingUpdateKey(uid));
  } catch {
    // 本地缓存清理失败不影响云端资料读取。
  }
};

export const getCachedUserProfile = (uid: string): UserProfile | null => {
  const cached = readJsonRecordWithBackup<Record<string, unknown>>(getProfileCacheKey(uid));
  if (!cached || cached.id !== uid || typeof cached.createdAt !== 'string') return null;

  return {
    id: uid,
    user_public_id: typeof cached.user_public_id === 'string' ? cached.user_public_id : undefined,
    display_name: typeof cached.display_name === 'string' ? cached.display_name : undefined,
    nickname: typeof cached.nickname === 'string' ? cached.nickname : undefined,
    bio: typeof cached.bio === 'string' ? cached.bio : undefined,
    signature: typeof cached.signature === 'string' ? cached.signature : undefined,
    avatar_url: typeof cached.avatar_url === 'string' ? cached.avatar_url : undefined,
    createdAt: cached.createdAt,
  };
};

const cacheUserProfile = (profile: UserProfile) => {
  writeJsonWithBackup(getProfileCacheKey(profile.id), withoutUndefined(profile));
};

const mergeCachedProfile = (base: UserProfile, cached: UserProfile | null, pending: Partial<UserProfile> | null): UserProfile => ({
  ...base,
  ...(cached || {}),
  ...(pending || {}),
  id: base.id,
  user_public_id: cached?.user_public_id || base.user_public_id,
  createdAt: cached?.createdAt || base.createdAt,
});

const toCloudProfileData = (profile: UserProfile) => withoutUndefined({
  id: profile.id,
  user_public_id: profile.user_public_id,
  nickname: profile.nickname,
  display_name: profile.display_name,
  signature: profile.signature,
  bio: profile.bio,
  avatar_url: profile.avatar_url,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

export const getOrCreateUserProfile = async (user: User): Promise<UserProfile> => {
  const cachedProfile = getCachedUserProfile(user.uid);
  const pendingPatch = readStoredProfilePatch(user.uid);
  const fallbackProfile = mergeCachedProfile(
    createDefaultProfile(user, generatePublicId(user.uid)),
    cachedProfile,
    pendingPatch,
  );

  try {
    const { doc, getDoc, setDoc, updateDoc } = await loadFirestore();
    const firebaseDb = await getFirebaseDb();

    const profileRef = doc(firebaseDb, 'profiles', user.uid);
    const snapshot = await getDoc(profileRef);
    let profile: UserProfile;

    if (snapshot.exists()) {
      profile = { id: user.uid, ...snapshot.data() } as UserProfile;

      if (shouldRefreshPublicId(profile.user_public_id)) {
        const user_public_id = generatePublicId(user.uid);

        try {
          await updateDoc(profileRef, { user_public_id });
        } catch (error) {
          console.warn('Failed to persist refreshed public id:', error);
        }

        profile = { ...profile, user_public_id };
      }
    } else {
      profile = fallbackProfile;
      await setDoc(profileRef, toCloudProfileData(profile));
    }

    if (pendingPatch && Object.keys(pendingPatch).length > 0) {
      profile = {
        ...profile,
        ...pendingPatch,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(profileRef, toCloudProfileData(profile), { merge: true });
      clearPendingProfilePatch(user.uid);
    }

    cacheUserProfile(profile);
    return profile;
  } catch (error) {
    if (isFirebaseOfflineError(error) || cachedProfile || pendingPatch) {
      cacheUserProfile(fallbackProfile);
      return fallbackProfile;
    }

    throw error;
  }
};

export const updateUserProfile = async (uid: string, updated: Partial<UserProfile>): Promise<UserProfile> => {
  const profilePatch = normalizeProfilePatch(updated);
  const now = new Date().toISOString();
  const cachedProfile = getCachedUserProfile(uid);
  const optimisticProfile: UserProfile = {
    id: uid,
    createdAt: cachedProfile?.createdAt || now,
    user_public_id: cachedProfile?.user_public_id || generatePublicId(uid),
    display_name: cachedProfile?.display_name,
    nickname: cachedProfile?.nickname,
    bio: cachedProfile?.bio,
    signature: cachedProfile?.signature,
    avatar_url: cachedProfile?.avatar_url,
    ...profilePatch,
    updatedAt: now,
  };

  cacheUserProfile(optimisticProfile);

  try {
    const { doc, getDoc, setDoc } = await loadFirestore();
    const firebaseDb = await getFirebaseDb();

    const profileRef = doc(firebaseDb, 'profiles', uid);
    await setDoc(profileRef, toCloudProfileData(optimisticProfile), { merge: true });

    const snapshot = await getDoc(profileRef);
    const cloudProfile = snapshot.exists()
      ? { id: uid, ...snapshot.data() } as UserProfile
      : optimisticProfile;

    clearPendingProfilePatch(uid);
    cacheUserProfile(cloudProfile);
    return cloudProfile;
  } catch (error) {
    cachePendingProfilePatch(uid, profilePatch);
    console.warn('Profile cloud update failed; local profile cache was kept:', error);
    return optimisticProfile;
  }
};

export const deleteUserAccount = async (uid: string): Promise<void> => {
  const { collection, deleteDoc, doc, getDocs } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  await deleteDoc(doc(firebaseDb, 'profiles', uid));

  const userReadingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const readingsSnapshot = await getDocs(userReadingsRef);
  const deletePromises = readingsSnapshot.docs.flatMap(item => {
    const reading = item.data() as TarotReading;
    return [
      deleteDoc(item.ref),
      ...(reading.isPublic ? [deletePublicReading(item.id)] : []),
    ];
  });

  const settingsRef = collection(firebaseDb, 'users', uid, 'settings');
  const settingsSnapshot = await getDocs(settingsRef);
  const settingsBackupsRef = collection(firebaseDb, 'users', uid, 'settingsBackups');
  const settingsBackupsSnapshot = await getDocs(settingsBackupsRef);
  const annotationsRef = collection(firebaseDb, 'users', uid, 'cardAnnotations');
  const annotationsSnapshot = await getDocs(annotationsRef);
  const numerologyRef = collection(firebaseDb, 'users', uid, 'numerologySettings');
  const numerologySnapshot = await getDocs(numerologyRef);

  await Promise.all([
    ...deletePromises,
    ...settingsSnapshot.docs.map(item => deleteDoc(item.ref)),
    ...settingsBackupsSnapshot.docs.map(item => deleteDoc(item.ref)),
    ...annotationsSnapshot.docs.map(item => deleteDoc(item.ref)),
    ...numerologySnapshot.docs.map(item => deleteDoc(item.ref)),
  ]);
};

export const uploadUserAvatar = async (uid: string, avatar: Blob): Promise<string> => {
  const { getDownloadURL, ref, uploadBytes } = await loadStorage();
  const firebaseStorage = await getFirebaseStorage();

  const avatarRef = ref(firebaseStorage, `avatars/${uid}/avatar.jpg`);
  await uploadBytes(avatarRef, avatar, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(avatarRef);

  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
};

export const getNumerologySetting = async (uid: string, cardName: string): Promise<NumerologySetting | null> => {
  const { doc, getDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const settingRef = doc(firebaseDb, 'users', uid, 'numerologySettings', getCardDocId(cardName));
  const snapshot = await getDoc(settingRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    numerology: Number(data.numerology),
    meaning: data.meaning || '',
    keywords: data.keywords || '',
  };
};

export const saveNumerologySetting = async (
  uid: string,
  cardName: string,
  setting: NumerologySetting,
): Promise<void> => {
  const { doc, setDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const settingRef = doc(firebaseDb, 'users', uid, 'numerologySettings', getCardDocId(cardName));
  await setDoc(settingRef, withoutUndefined({
    cardName,
    ...setting,
    updatedAt: new Date().toISOString(),
  }));
};

export const deleteNumerologySetting = async (uid: string, cardName: string): Promise<void> => {
  const { deleteDoc, doc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const settingRef = doc(firebaseDb, 'users', uid, 'numerologySettings', getCardDocId(cardName));
  await deleteDoc(settingRef);
};

export const getCardAnnotations = async (uid: string): Promise<Record<string, string>> => {
  const { collection, getDocs } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const annotationsRef = collection(firebaseDb, 'users', uid, 'cardAnnotations');
  const snapshot = await getDocs(annotationsRef);
  const annotations: Record<string, string> = {};

  snapshot.forEach(item => {
    const data = item.data();
    if (data.cardName) annotations[data.cardName] = data.meaning || '';
  });

  return annotations;
};

export const saveCardAnnotation = async (uid: string, cardName: string, meaning: string): Promise<void> => {
  const { doc, setDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const annotationRef = doc(firebaseDb, 'users', uid, 'cardAnnotations', getCardDocId(cardName));
  await setDoc(annotationRef, {
    cardName,
    meaning,
    updatedAt: new Date().toISOString(),
  });
};

export const getUserReadings = async (uid: string): Promise<TarotReading[]> => {
  const { collection, getDocs } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const readingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const snapshot = await getDocs(readingsRef);

  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }) as TarotReading)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getPublicReadings = async (): Promise<TarotReading[]> => {
  const { collection, getDocs } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const readingsRef = collection(firebaseDb, 'publicReadings');
  const snapshot = await getDocs(readingsRef);

  return snapshot.docs
    .map(item => ({ id: item.id, userId: 'public', ...item.data() }) as TarotReading)
    .filter(reading => reading.isPublic)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const toPublicReadingData = (reading: TarotReading) => withoutUndefined({
  id: reading.id,
  date: reading.date,
  question: reading.question,
  spread: reading.spread,
  cards: reading.cards,
  cardInterpretations: reading.cardInterpretations || [],
  cardQuestions: reading.cardQuestions || [],
  interpretation: reading.interpretation,
  keywords: reading.keywords || [],
  manualTags: reading.manualTags || [],
  isPublic: true,
  isAnonymous: !!reading.isAnonymous,
  authorName: reading.isAnonymous ? '匿名研习者' : (reading.authorName || '研习阁主'),
  layoutType: reading.layoutType,
  slotLabels: reading.slotLabels || [],
  slotPositions: reading.slotPositions || [],
  rotatedSlots: reading.rotatedSlots || [],
  readingDate: reading.readingDate,
  category: reading.category,
  choicePathA: reading.choicePathA,
  choicePathB: reading.choicePathB,
  isAiProcessed: reading.isAiProcessed,
  processedByAi: reading.processedByAi,
  showSlotNumbers: reading.showSlotNumbers,
  updatedAt: new Date().toISOString(),
});

const toUserReadingData = (uid: string, reading: TarotReading) => withoutUndefined({
  ...reading,
  userId: uid,
  question: typeof reading.question === 'string' && reading.question.trim() ? reading.question : '未命名手记',
  date: typeof reading.date === 'string' && reading.date.trim()
    ? reading.date
    : (reading.readingDate || reading.updatedAt || new Date().toISOString()),
  spread: reading.spread || '未指定牌阵',
  cards: Array.isArray(reading.cards) ? reading.cards : [],
  interpretation: reading.interpretation || {
    singleCard: '',
    combination: '',
    summary: '',
  },
  keywords: Array.isArray(reading.keywords) ? reading.keywords : [],
  isPublic: !!reading.isPublic,
  isAnonymous: !!reading.isAnonymous,
  authorName: reading.authorName || '研习阁主',
});

export const savePublicReading = async (reading: TarotReading): Promise<void> => {
  const { doc, setDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const publicRef = doc(firebaseDb, 'publicReadings', reading.id);
  await setDoc(publicRef, toPublicReadingData(reading));
};

export const deletePublicReading = async (readingId: string): Promise<void> => {
  const { deleteDoc, doc, getDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const publicRef = doc(firebaseDb, 'publicReadings', readingId);
  const publicSnapshot = await getDoc(publicRef);

  if (publicSnapshot.exists()) {
    await deleteDoc(publicRef);
  }
};

export const replaceUserReadings = async (
  uid: string,
  readings: TarotReading[],
  options: UserReadingSyncOptions = {},
): Promise<UserReadingSyncResult> => {
  const { collection, doc, getDocs, writeBatch } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const readingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const snapshot = await getDocs(readingsRef);
  const previousReadings = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as TarotReading);
  const syncPlan = createUserReadingSyncPlan(uid, readings, previousReadings, options);

  const privateWriteCount = syncPlan.readingsToWrite.length + syncPlan.readingsToDelete.length;
  if (privateWriteCount > 0) {
    const batch = writeBatch(firebaseDb);

    syncPlan.readingsToWrite.forEach(reading => {
      batch.set(
        doc(firebaseDb, 'users', uid, 'readings', reading.id),
        toUserReadingData(uid, reading),
      );
    });

    syncPlan.readingsToDelete.forEach(reading => {
      batch.delete(doc(firebaseDb, 'users', uid, 'readings', reading.id));
    });

    await batch.commit();
  }

  let publicMirrorWarning: string | undefined;
  let publicMirrorDeleteWarning: string | undefined;
  let publicReadingsSaved = syncPlan.publicReadingsToSave.length;
  let publicReadingsDeleted = syncPlan.publicReadingIdsToDelete.length;

  try {
    await Promise.all(syncPlan.publicReadingsToSave.map(reading => savePublicReading(reading)));
  } catch (error) {
    publicReadingsSaved = 0;
    publicMirrorWarning = error instanceof Error ? error.message : String(error);
    console.warn('Public reading mirror failed, private readings were still saved:', error);
  }

  try {
    await Promise.all(syncPlan.publicReadingIdsToDelete.map(readingId => deletePublicReading(readingId)));
  } catch (error) {
    publicReadingsDeleted = 0;
    publicMirrorDeleteWarning = error instanceof Error ? error.message : String(error);
    console.warn('Public reading mirror cleanup failed, private readings were still saved:', error);
  }

  return {
    totalReadings: syncPlan.mergedReadings.length,
    previousReadings: previousReadings.length,
    privateReadingsWritten: syncPlan.readingsToWrite.length,
    privateReadingsDeleted: syncPlan.readingsToDelete.length,
    publicReadingsSaved,
    publicReadingsDeleted,
    publicMirrorWarning,
    publicMirrorDeleteWarning,
  };
};

const getUserSetting = async <T,>(uid: string, key: string): Promise<T[] | null> => {
  const { doc, getDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const settingRef = doc(firebaseDb, 'users', uid, 'settings', key);
  const snapshot = await getDoc(settingRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return Array.isArray(data.items) ? data.items as T[] : null;
};

const saveUserSetting = async <T,>(uid: string, key: string, items: T[]): Promise<void> => {
  const { doc, getDoc, setDoc, writeBatch } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const settingRef = doc(firebaseDb, 'users', uid, 'settings', key);
  const nextData = {
    items: withoutUndefined(items),
    updatedAt: new Date().toISOString(),
  };
  const snapshot = await getDoc(settingRef);

  if (snapshot.exists()) {
    const current = snapshot.data();

    if (Array.isArray(current.items)) {
      try {
        const batch = writeBatch(firebaseDb);
        const backupRef = doc(firebaseDb, 'users', uid, 'settingsBackups', key);
        batch.set(backupRef, {
          items: current.items,
          sourceKey: key,
          updatedAt: current.updatedAt || null,
          backupAt: new Date().toISOString(),
        });
        batch.set(settingRef, nextData);
        await batch.commit();
        return;
      } catch (error) {
        console.warn('Failed to write user setting backup; saving primary setting only:', error);
      }
    }
  }

  await setDoc(settingRef, nextData);
};

export const getUserSpreads = (uid: string) => getUserSetting<SpreadDefinition>(uid, 'spreads');
export const saveUserSpreads = (uid: string, spreads: SpreadDefinition[]) => saveUserSetting(uid, 'spreads', spreads);

export const getUserCardMetadata = (uid: string) => getUserSetting<TarotCardMetadata>(uid, 'cardMetadata');
export const saveUserCardMetadata = (uid: string, metadata: TarotCardMetadata[]) => saveUserSetting(uid, 'cardMetadata', metadata);

export const getUserCardKeywordMemory = (uid: string) => getUserSetting<CardKeywordMemory>(uid, 'cardKeywordMemory');
export const saveUserCardKeywordMemory = (uid: string, memory: CardKeywordMemory[]) => saveUserSetting(uid, 'cardKeywordMemory', memory);

export const getUserQuizMemory = (uid: string) => getUserSetting<QuizMemoryEntry>(uid, 'quizMemory');
export const saveUserQuizMemory = (uid: string, memory: QuizMemoryEntry[]) => saveUserSetting(uid, 'quizMemory', memory);

export const getUserDailyFortunes = (uid: string) => getUserSetting<DailyFortune>(uid, 'dailyFortunes');
export const saveUserDailyFortunes = (uid: string, fortunes: DailyFortune[]) => saveUserSetting(uid, 'dailyFortunes', fortunes);
