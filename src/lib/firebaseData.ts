import { User } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { SpreadDefinition, TarotCardMetadata, TarotReading, UserProfile } from '../types';
import { firebaseDb, firebaseStorage } from './firebase';

export interface NumerologySetting {
  numerology: number;
  meaning: string;
  keywords: string;
}

const getCardDocId = (cardName: string) => encodeURIComponent(cardName);

const withoutUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const PUBLIC_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const createPublicIdCode = (input: string, length = 8) => {
  let hash = 0x811c9dc5;
  let code = '';

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  for (let i = 0; i < length; i += 1) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    hash >>>= 0;
    code += PUBLIC_ID_ALPHABET.charAt(hash % PUBLIC_ID_ALPHABET.length);
  }

  return code;
};

const formatPublicIdDate = (createdAt: string) => {
  const date = new Date(createdAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const yy = String(safeDate.getFullYear()).slice(-2);
  const mm = String(safeDate.getMonth() + 1).padStart(2, '0');
  const dd = String(safeDate.getDate()).padStart(2, '0');

  return `${yy}${mm}${dd}`;
};

const generatePublicId = (uid: string, createdAt: string) => {
  const dateCode = formatPublicIdDate(createdAt);
  const identityCode = createPublicIdCode(`${uid}:${createdAt}`);

  return `TAROT-${dateCode}-${identityCode}`;
};

const shouldRefreshPublicId = (publicId?: string) => (
  !publicId
  || publicId === 'TAROT-INIT-0000'
  || /^TAROT-\d{4}-[A-Z2-9]{4}$/.test(publicId)
);

const createDefaultProfile = (user: User): UserProfile => {
  const createdAt = new Date().toISOString();
  const displayName = user.displayName || user.email?.split('@')[0] || '研习阁主';

  return {
    id: user.uid,
    display_name: displayName,
    bio: '研精覃思，洞见未来',
    createdAt,
    user_public_id: generatePublicId(user.uid, createdAt),
  };
};

export const getOrCreateUserProfile = async (user: User): Promise<UserProfile> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const profileRef = doc(firebaseDb, 'profiles', user.uid);
  const snapshot = await getDoc(profileRef);

  if (snapshot.exists()) {
    const profile = { id: user.uid, ...snapshot.data() } as UserProfile;

    if (shouldRefreshPublicId(profile.user_public_id)) {
      const user_public_id = generatePublicId(user.uid, profile.createdAt || new Date().toISOString());
      await updateDoc(profileRef, { user_public_id });
      return { ...profile, user_public_id };
    }

    return profile;
  }

  const profile = createDefaultProfile(user);
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

export const replaceUserReadings = async (uid: string, readings: TarotReading[]): Promise<void> => {
  if (!firebaseDb) throw new Error('Firebase Firestore 未配置');

  const readingsRef = collection(firebaseDb, 'users', uid, 'readings');
  const snapshot = await getDocs(readingsRef);
  const incomingIds = new Set(readings.map(reading => reading.id));

  await Promise.all([
    ...readings.map(reading => setDoc(
      doc(firebaseDb, 'users', uid, 'readings', reading.id),
      withoutUndefined(reading),
    )),
    ...snapshot.docs
      .filter(item => !incomingIds.has(item.id))
      .map(item => deleteDoc(doc(firebaseDb, 'users', uid, 'readings', item.id))),
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
