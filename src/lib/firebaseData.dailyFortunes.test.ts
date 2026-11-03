import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { saveUserDailyFortunes } from './firebaseData';
import { markDailyFortuneDeleted } from './dailyFortuneCloudSync';
import type { DailyFortune } from '../types';

vi.mock('./firebase', () => ({ getFirebaseApp: vi.fn(async () => ({ name: 'test-app' })) }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
  getFirestore: vi.fn(() => ({ name: 'test-db' })),
  runTransaction: vi.fn(),
}));

const fortune = (overrides: Partial<DailyFortune> = {}): DailyFortune => ({
  id: 'day', userId: 'user-1', date: '2026-07-02', cardName: '隐士', isReversed: false,
  interpretation: '', keywords: [], reflection: '留下的经验', createdAt: '2026-07-02T07:00:00Z', updatedAt: '2026-07-02T07:00:00Z',
  ...overrides,
});

describe('daily fortune cloud writes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('merges against the current server state inside a transaction and keeps its backup', async () => {
    const deleted = markDailyFortuneDeleted(fortune({ savedToCardAnnotationAt: '2026-07-02T08:00:00Z' }), '2026-07-02T09:00:00Z');
    const transaction = {
      get: vi.fn(async () => ({ exists: () => true, data: () => ({ items: [deleted], updatedAt: '2026-07-02T09:00:00Z' }) })),
      set: vi.fn(),
    };
    vi.mocked(runTransaction).mockImplementation(async (_db, update) => update(transaction as never));
    await saveUserDailyFortunes('user-1', [fortune({ updatedAt: '2026-07-02T10:00:00Z' }), fortune({ id: 'other-day', date: '2026-07-03' })]);

    expect(transaction.get).toHaveBeenCalledWith({ path: 'users/user-1/settings/dailyFortunes' });
    expect(transaction.set).toHaveBeenCalledWith({ path: 'users/user-1/settingsBackups/dailyFortunes' }, expect.objectContaining({ items: [deleted], sourceKey: 'dailyFortunes' }));
    const primary = transaction.set.mock.calls.find(call => call[0].path === 'users/user-1/settings/dailyFortunes')![1];
    expect(primary.items).toHaveLength(2);
    expect(primary.items.find((item: DailyFortune) => item.id === 'day')).toMatchObject({ deletedAt: '2026-07-02T09:00:00Z', savedToCardAnnotationAt: '2026-07-02T08:00:00Z' });
    expect(primary.items.find((item: DailyFortune) => item.id === 'other-day')).toBeDefined();
  });

  it('creates only the active account setting when no cloud record exists', async () => {
    const transaction = {
      get: vi.fn(async () => ({ exists: () => false })),
      set: vi.fn(),
    };
    vi.mocked(runTransaction).mockImplementation(async (_db, update) => update(transaction as never));
    await saveUserDailyFortunes('user-2', [fortune()]);
    expect(transaction.set).toHaveBeenCalledOnce();
    expect(transaction.set).toHaveBeenCalledWith({ path: 'users/user-2/settings/dailyFortunes' }, expect.objectContaining({ items: [expect.objectContaining({ userId: 'user-2' })] }));
  });

  it('propagates a failed transaction without falling back to an unsafe overwrite', async () => {
    vi.mocked(runTransaction).mockRejectedValue(new Error('offline'));
    await expect(saveUserDailyFortunes('user-1', [fortune()])).rejects.toThrow('offline');
    expect(runTransaction).toHaveBeenCalledOnce();
  });
});
