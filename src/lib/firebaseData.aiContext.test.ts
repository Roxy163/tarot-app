import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocs, setDoc } from 'firebase/firestore';
import { getUserReadings, replaceUserReadings, savePublicReading } from './firebaseData';
import { INITIAL_READINGS } from '../constants';
import { exportReadingsToCsv, exportReadingsToMarkdown, buildReadingReviewPdfLines } from './readingReview';
import type { TarotReading } from '../types';

const batch = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) }));
vi.mock('./firebase', () => ({ getFirebaseApp: vi.fn(async () => ({ name: 'test-app' })) }));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ name: 'test-db' })),
  collection: vi.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
  doc: vi.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
  getDocs: vi.fn(), setDoc: vi.fn(async () => {}), writeBatch: vi.fn(() => batch),
}));

const context = 'PRIVATE-CONTEXT-ONLY\n这是我的补充关注点。';
const reading = (overrides: Partial<TarotReading> = {}): TarotReading => ({
  ...INITIAL_READINGS[0], id: 'context-reading', userId: 'old-owner', isExample: false, isPublic: true,
  aiContext: context, userFeedback: '私人复盘', clientName: '私人客户称呼', aiAnswer: '私人AI参照',
  ...overrides,
});

describe('private AI context cloud boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
  });

  it('writes context to the owner document while the simultaneous public mirror and its exports contain no private context', async () => {
    await replaceUserReadings('current-owner', [reading()]);
    expect(batch.set).toHaveBeenCalledWith({ path: 'users/current-owner/readings/context-reading' }, expect.objectContaining({ aiContext: context, userId: 'current-owner' }));
    const publicWrite = vi.mocked(setDoc).mock.calls.find(([ref]) => (ref as unknown as { path: string }).path === 'publicReadings/context-reading')!;
    const publicData = publicWrite[1] as TarotReading;
    expect(publicData).not.toHaveProperty('aiContext');
    expect(publicData).not.toHaveProperty('aiAnswer');
    expect(publicData).not.toHaveProperty('userFeedback');
    expect(publicData).not.toHaveProperty('clientName');
    expect(exportReadingsToCsv([publicData])).not.toContain(context);
    expect(exportReadingsToMarkdown([publicData])).not.toContain(context);
    expect(buildReadingReviewPdfLines([publicData]).map(line => line.text).join('\n')).not.toContain(context);
  });

  it('also excludes context from direct public publishing, including anonymous publishing', async () => {
    await savePublicReading(reading({ isAnonymous: true }));
    expect(setDoc).toHaveBeenCalledWith({ path: 'publicReadings/context-reading' }, expect.objectContaining({ isAnonymous: true, authorName: '匿名研习者' }));
    expect(vi.mocked(setDoc).mock.calls[0][1]).not.toHaveProperty('aiContext');
  });

  it('reads private context from the owner collection and round trips an explicit clear without sending undefined legacy data', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [{ id: 'context-reading', data: () => reading({ userId: 'current-owner', isPublic: false }) }] } as never);
    expect((await getUserReadings('current-owner'))[0].aiContext).toBe(context);
    expect(getDocs).toHaveBeenLastCalledWith({ path: 'users/current-owner/readings' });
    await replaceUserReadings('current-owner', [reading({ aiContext: '', isPublic: false, updatedAt: '2099-01-01T00:00:00Z' })]);
    expect(batch.set).toHaveBeenCalledWith({ path: 'users/current-owner/readings/context-reading' }, expect.objectContaining({ aiContext: '' }));
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    batch.set.mockClear();
    await replaceUserReadings('current-owner', [reading({ aiContext: undefined, isPublic: false })]);
    expect(batch.set.mock.calls[0][1]).not.toHaveProperty('aiContext');
  });
});
