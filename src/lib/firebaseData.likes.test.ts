import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocFromServer, runTransaction } from 'firebase/firestore';
import { setPublicReadingLike } from './firebaseData';

vi.mock('./firebase', () => ({ getFirebaseApp: vi.fn(async () => ({ name: 'test-app' })) }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getFirestore: vi.fn(() => ({ name: 'test-db' })),
  increment: vi.fn((value: number) => ({ increment: value })),
  runTransaction: vi.fn(),
  getDocFromServer: vi.fn(),
}));

describe('public like commit results', () => {
  beforeEach(() => vi.resetAllMocks());

  it('preserves a committed like when the following count refresh is offline', async () => {
    vi.mocked(runTransaction).mockResolvedValue(undefined);
    vi.mocked(getDocFromServer).mockRejectedValue(new Error('offline'));
    await expect(setPublicReadingLike('reading', 'reader', true)).resolves.toEqual({ liked: true });
  });

  it('rejects a failed commit without reporting a successful like', async () => {
    vi.mocked(runTransaction).mockRejectedValue(new Error('permission-denied'));
    await expect(setPublicReadingLike('reading', 'reader', true)).rejects.toThrow('permission-denied');
    expect(getDocFromServer).not.toHaveBeenCalled();
  });
});
