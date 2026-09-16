import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteUserAccount } from './firebaseData';
import { deleteDoc, getDocFromServer } from 'firebase/firestore';

type TestRef = { path: string };

vi.mock('./firebase', () => ({
  getFirebaseApp: vi.fn(async () => ({ name: 'test-app' })),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  deleteDoc: vi.fn(async () => undefined),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDocFromServer: vi.fn(async (ref: TestRef) => ({ exists: () => ref.path.endsWith('/reading-1') })),
  getDocs: vi.fn(async (ref: TestRef) => ({
    docs: ref.path === 'users/user-1/readings'
      ? [
        { id: 'reading-1', ref: { path: 'users/user-1/readings/reading-1' } },
        { id: 'reading-2', ref: { path: 'users/user-1/readings/reading-2' } },
      ]
      : [],
  })),
  getFirestore: vi.fn(() => ({ name: 'test-db' })),
}));

describe('deleteUserAccount cloud cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes existing public mirrors before private readings and profile', async () => {
    const deletions: string[] = [];
    vi.mocked(deleteDoc).mockImplementation(async (ref: unknown) => {
      deletions.push((ref as TestRef).path);
    });

    await deleteUserAccount('user-1');

    expect(vi.mocked(getDocFromServer)).toHaveBeenCalledTimes(2);
    expect(deletions[0]).toBe('publicReadings/reading-1');
    expect(deletions).not.toContain('publicReadings/reading-2');
    expect(deletions.slice(1, -1)).toEqual(expect.arrayContaining([
      'users/user-1/readings/reading-1',
      'users/user-1/readings/reading-2',
    ]));
    expect(deletions.at(-1)).toBe('profiles/user-1');
  });

  it('keeps private readings and profile when public cleanup fails', async () => {
    vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('permission-denied'));

    await expect(deleteUserAccount('user-1')).rejects.toThrow('permission-denied');

    expect(vi.mocked(deleteDoc)).toHaveBeenCalledTimes(1);
    expect((vi.mocked(deleteDoc).mock.calls[0][0] as unknown as TestRef).path).toBe('publicReadings/reading-1');
  });
});
