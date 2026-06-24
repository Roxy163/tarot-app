import type { User } from 'firebase/auth';
import type { CardKeywordMemory, SpreadDefinition, TarotCardMetadata, TarotReading, UserProfile } from '../types';
import { getFirebaseApp } from './firebase';
import { createUserReadingSyncPlan } from './readingCloudSync';

type FirestoreApi = typeof import('firebase/firestore');
type StorageApi = typeof import('firebase/storage');

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
  return getFirestore(getFirebaseApp());
};

const getFirebaseStorage = async () => {
  const { getStorage } = await loadStorage();
  return getStorage(getFirebaseApp());
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

export const getOrCreateUserProfile = async (user: User): Promise<UserProfile> => {
  const { doc, getDoc, setDoc, updateDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const profileRef = doc(firebaseDb, 'profiles', user.uid);
  const snapshot = await getDoc(profileRef);

  if (snapshot.exists()) {
    const profile = { id: user.uid, ...snapshot.data() } as UserProfile;

    if (shouldRefreshPublicId(profile.user_public_id)) {
      const user_public_id = generatePublicId(user.uid);

      try {
        await updateDoc(profileRef, { user_public_id });
      } catch (error) {
        console.warn('Failed to persist refreshed public id:', error);
      }

      return { ...profile, user_public_id };
    }

    return profile;
  }

  const profile = createDefaultProfile(user, generatePublicId(user.uid));
  await setDoc(profileRef, profile);
  return profile;
};

export const updateUserProfile = async (uid: string, updated: Partial<UserProfile>): Promise<UserProfile> => {
  const { doc, getDoc, updateDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const profileRef = doc(firebaseDb, 'profiles', uid);
  await updateDoc(profileRef, withoutUndefined({
    ...updated,
    updatedAt: new Date().toISOString(),
  }));

  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) throw new Error('用户资料不存在');

  return { id: uid, ...snapshot.data() } as UserProfile;
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
  const annotationsRef = collection(firebaseDb, 'users', uid, 'cardAnnotations');
  const annotationsSnapshot = await getDocs(annotationsRef);
  const numerologyRef = collection(firebaseDb, 'users', uid, 'numerologySettings');
  const numerologySnapshot = await getDocs(numerologyRef);

  await Promise.all([
    ...deletePromises,
    ...settingsSnapshot.docs.map(item => deleteDoc(item.ref)),
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
  interpretation: reading.interpretation,
  keywords: reading.keywords || [],
  isPublic: true,
  isAnonymous: !!reading.isAnonymous,
  authorName: reading.isAnonymous ? '匿名研习者' : (reading.authorName || '研习阁主'),
  layoutType: reading.layoutType,
  slotLabels: reading.slotLabels || [],
  slotPositions: reading.slotPositions || [],
  rotatedSlots: reading.rotatedSlots || [],
  readingDate: reading.readingDate,
  category: reading.category,
  isAiProcessed: reading.isAiProcessed,
  processedByAi: reading.processedByAi,
  showSlotNumbers: reading.showSlotNumbers,
  updatedAt: new Date().toISOString(),
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

export const replaceUserReadings = async (uid: string, readings: TarotReading[]): Promise<void> => {
  const { collection, deleteDoc, doc, getDocs, setDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const readingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const snapshot = await getDocs(readingsRef);
  const previousReadings = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as TarotReading);
  const syncPlan = createUserReadingSyncPlan(uid, readings, previousReadings);

  await Promise.all(
    syncPlan.readingsToWrite.map(reading => setDoc(
      doc(firebaseDb, 'users', uid, 'readings', reading.id),
      withoutUndefined(reading),
    )),
  );

  await Promise.all([
    ...syncPlan.publicReadingsToSave.map(reading => savePublicReading(reading)),
    ...syncPlan.publicReadingIdsToDelete.map(readingId => deletePublicReading(readingId)),
    ...syncPlan.readingsToDelete.map(reading => (
      deleteDoc(doc(firebaseDb, 'users', uid, 'readings', reading.id))
    )),
  ]);
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
  const { doc, setDoc } = await loadFirestore();
  const firebaseDb = await getFirebaseDb();

  const settingRef = doc(firebaseDb, 'users', uid, 'settings', key);
  await setDoc(settingRef, {
    items: withoutUndefined(items),
    updatedAt: new Date().toISOString(),
  });
};

export const getUserSpreads = (uid: string) => getUserSetting<SpreadDefinition>(uid, 'spreads');
export const saveUserSpreads = (uid: string, spreads: SpreadDefinition[]) => saveUserSetting(uid, 'spreads', spreads);

export const getUserCardMetadata = (uid: string) => getUserSetting<TarotCardMetadata>(uid, 'cardMetadata');
export const saveUserCardMetadata = (uid: string, metadata: TarotCardMetadata[]) => saveUserSetting(uid, 'cardMetadata', metadata);

export const getUserCardKeywordMemory = (uid: string) => getUserSetting<CardKeywordMemory>(uid, 'cardKeywordMemory');
export const saveUserCardKeywordMemory = (uid: string, memory: CardKeywordMemory[]) => saveUserSetting(uid, 'cardKeywordMemory', memory);
