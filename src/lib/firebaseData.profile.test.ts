import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { getCachedUserProfile, getOrCreateUserProfile, hasPendingUserProfileUpdate, updateUserProfile } from './firebaseData';
import { getDoc, setDoc } from 'firebase/firestore';

vi.mock('./firebase', () => ({
  getFirebaseApp: vi.fn(async () => ({ name: 'test-app' })),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...path: unknown[]) => ({ path })),
  getDoc: vi.fn(),
  getFirestore: vi.fn(() => ({ name: 'test-db' })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

const createUser = (overrides: Partial<User> = {}) => ({
  uid: 'user-1',
  email: 'reader@example.com',
  displayName: null,
  ...overrides,
}) as User;

describe('firebase profile cache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('keeps a nickname update locally and queues it when Firestore is offline', async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(Object.assign(
      new Error('Failed to get document because the client is offline.'),
      { code: 'unavailable' },
    ));

    const profile = await updateUserProfile('user-1', { display_name: '  新阁主  ' });

    expect(profile.display_name).toBe('新阁主');
    expect(profile.nickname).toBe('新阁主');
    expect(getCachedUserProfile('user-1')?.display_name).toBe('新阁主');
    expect(hasPendingUserProfileUpdate('user-1')).toBe(true);
  });

  it('uses cached profile instead of falling back to the email prefix when cloud profile cannot be read', async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(Object.assign(
      new Error('Failed to get document because the client is offline.'),
      { code: 'unavailable' },
    ));
    await updateUserProfile('user-1', { display_name: '本机昵称' });
    vi.clearAllMocks();
    vi.mocked(getDoc).mockRejectedValueOnce(Object.assign(
      new Error('Failed to get document because the client is offline.'),
      { code: 'unavailable' },
    ));

    const profile = await getOrCreateUserProfile(createUser());

    expect(profile.display_name).toBe('本机昵称');
    expect(profile.nickname).toBe('本机昵称');
    expect(setDoc).not.toHaveBeenCalled();
  });
});
