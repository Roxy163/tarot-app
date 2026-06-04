import { User } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { CardKeywordMemory, SpreadDefinition, TarotCardMetadata, TarotReading, UserProfile } from '../types';
import { firebaseDb, firebaseStorage } from './firebase';

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
    bio: '研精覃思，洞见未来',
    createdAt,
    user_public_id: publicId,
  };
};

export const getOrCreateUserProfile = async (user: User): Promise<UserProfile> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

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

  const publicId = generatePublicId(user.uid);
  const profile = createDefaultProfile(user, publicId);
  await setDoc(profileRef, profile);
  return profile;
};

export const updateUserProfile = async (uid: string, updated: Partial<UserProfile>): Promise<UserProfile> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const profileRef = doc(firebaseDb, 'profiles', uid);
  await updateDoc(profileRef, {
    ...updated,
    updatedAt: new Date().toISOString(),
  });

  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) throw new Error('用户资料不存在');

  return { id: uid, ...snapshot.data() } as UserProfile;
};

export const deleteUserAccount = async (uid: string): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

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
  await Promise.all(deletePromises);
};

export const uploadUserAvatar = async (uid: string, avatar: Blob): Promise<string> => {
  if (!firebaseStorage) throw new Error('Firebase Storage 未配置');

  const avatarRef = ref(firebaseStorage, `avatars/${uid}/avatar.jpg`);
  await uploadBytes(avatarRef, avatar, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(avatarRef);

  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
};

export const getNumerologySetting = async (uid: string, cardName: string): Promise<NumerologySetting | null> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

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
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const settingRef = doc(firebaseDb, 'users', uid, 'numerologySettings', getCardDocId(cardName));
  await setDoc(settingRef, {
    cardName,
    ...setting,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteNumerologySetting = async (uid: string, cardName: string): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const settingRef = doc(firebaseDb, 'users', uid, 'numerologySettings', getCardDocId(cardName));
  await deleteDoc(settingRef);
};

export const getCardAnnotations = async (uid: string): Promise<Record<string, string>> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

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
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const annotationRef = doc(firebaseDb, 'users', uid, 'cardAnnotations', getCardDocId(cardName));
  await setDoc(annotationRef, {
    cardName,
    meaning,
    updatedAt: new Date().toISOString(),
  });
};

export const getUserReadings = async (uid: string): Promise<TarotReading[]> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const readingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const snapshot = await getDocs(readingsRef);

  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }) as TarotReading)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getPublicReadings = async (): Promise<TarotReading[]> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const readingsRef = collection(firebaseDb, 'publicReadings');
  const snapshot = await getDocs(readingsRef);

  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }) as TarotReading)
    .filter(reading => reading.isPublic)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const savePublicReading = async (reading: TarotReading): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const publicRef = doc(firebaseDb, 'publicReadings', reading.id);
  await setDoc(publicRef, withoutUndefined({
    ...reading,
    isPublic: true,
    updatedAt: new Date().toISOString(),
  }));
};

export const deletePublicReading = async (readingId: string): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const publicRef = doc(firebaseDb, 'publicReadings', readingId);
  const publicSnapshot = await getDoc(publicRef);

  if (publicSnapshot.exists()) {
    await deleteDoc(publicRef);
  }
};

export const replaceUserReadings = async (uid: string, readings: TarotReading[]): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const readingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const snapshot = await getDocs(readingsRef);
  const previousReadingsById = new Map(snapshot.docs.map(item => [item.id, item.data() as TarotReading]));
  const ownedReadings = readings.map(reading => ({ ...reading, userId: uid }));
  const incomingIds = new Set(ownedReadings.map(reading => reading.id));

  await Promise.all([
    ...ownedReadings.map(reading => setDoc(
      doc(firebaseDb, 'users', uid, 'readings', reading.id),
      withoutUndefined(reading),
    )),
    ...ownedReadings.map(reading => {
      if (reading.isPublic) return savePublicReading(reading);

      const wasPublic = previousReadingsById.get(reading.id)?.isPublic === true;
      return wasPublic ? deletePublicReading(reading.id) : Promise.resolve();
    }),
    ...snapshot.docs
      .filter(item => !incomingIds.has(item.id))
      .map(item => deleteDoc(doc(firebaseDb, 'users', uid, 'readings', item.id))),
    ...snapshot.docs
      .filter(item => !incomingIds.has(item.id) && item.data().isPublic === true)
      .map(item => deletePublicReading(item.id)),
  ]);
};

const getUserSetting = async <T,>(uid: string, key: string): Promise<T[] | null> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const settingRef = doc(firebaseDb, 'users', uid, 'settings', key);
  const snapshot = await getDoc(settingRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return Array.isArray(data.items) ? data.items as T[] : null;
};

const saveUserSetting = async <T,>(uid: string, key: string, items: T[]): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

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
