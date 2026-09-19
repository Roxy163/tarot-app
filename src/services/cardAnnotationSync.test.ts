import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CardAnnotationService } from './cardAnnotationService';
import { getCardAnnotations, syncUserAnnotations } from '../lib/firebaseData';
import type { CardAnnotation } from '../types';

vi.mock('../lib/firebaseData', () => ({ getCardAnnotations: vi.fn(), syncUserAnnotations: vi.fn() }));

describe('account annotation persistence and sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getCardAnnotations).mockResolvedValue({});
    vi.mocked(syncUserAnnotations).mockImplementation(async (_uid, items) => items);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('treats an explicit backup import as a new edit for cloud merging', async () => {
    const service = new CardAnnotationService();
    service.setScope('alice');
    service.saveUserAnnotation('ar00', { personalNotes: '导入前' });
    const previous = service.getUserAnnotation('ar00')!;
    expect(service.importUserData(JSON.stringify({ annotations: { ar00: { personalNotes: '备份里的笔记', updatedAt: '2020-01-01', userId: 'old-id' } } }))).toBe(true);
    const imported = service.getUserAnnotation('ar00')!;
    expect(imported.updatedAt! > previous.updatedAt!).toBe(true);
    await service.sync();
    expect(syncUserAnnotations).toHaveBeenLastCalledWith('alice', expect.arrayContaining([expect.objectContaining({ cardId: 'ar00', personalNotes: '备份里的笔记', userId: 'alice' })]));
  });

  it('claims legacy guest annotations once and keeps accounts isolated', () => {
    localStorage.setItem('tarot_user_annotations', JSON.stringify({ userId: 'old-local-id', annotations: { ar00: { personalNotes: '旧笔记' } }, version: 1, lastUpdated: '2026-01-01' }));
    localStorage.setItem('tarot_personal_meanings', JSON.stringify({ 愚者: '另一入口的旧注解' }));
    const service = new CardAnnotationService();
    service.setScope();
    expect(service.getMergedAnnotation('ar00').personalNotes).toBe('旧笔记');
    service.setScope('alice');
    expect(service.getMergedAnnotation('ar00').personalMeaning).toBe('另一入口的旧注解');
    service.setScope('bob');
    expect(service.getUserAnnotation('ar00')).toBeNull();
    service.setScope();
    expect(service.getUserAnnotation('ar00')).toBeNull();
    service.setScope('alice');
    expect(service.getMergedAnnotation('ar00').personalNotes).toBe('旧笔记');
  });

  it('does not claim an unsuccessful save in its runtime cache', () => {
    const service = new CardAnnotationService();
    service.saveUserAnnotation('ar00', { personalNotes: '已保存' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => service.saveUserAnnotation('ar00', { personalNotes: '失败修改' })).toThrow();
    expect(service.getMergedAnnotation('ar00').personalNotes).toBe('已保存');
  });

  it('restores saved local edits and syncs them after an offline attempt', async () => {
    const first = new CardAnnotationService();
    first.setScope('alice');
    first.saveUserAnnotation('ar00', { uprightMeaning: '自定义正位', personalMeaning: '个人理解' });
    vi.mocked(syncUserAnnotations).mockRejectedValueOnce(new Error('offline'));
    await expect(first.sync()).rejects.toThrow('offline');
    const afterReload = new CardAnnotationService();
    afterReload.setScope('alice');
    await afterReload.sync();
    expect(syncUserAnnotations).toHaveBeenLastCalledWith('alice', expect.arrayContaining([expect.objectContaining({ cardId: 'ar00', uprightMeaning: '自定义正位', personalMeaning: '个人理解' })]));
  });

  it('keeps edits made while cloud sync is in flight', async () => {
    let resolve!: (items: Partial<CardAnnotation>[]) => void;
    vi.mocked(syncUserAnnotations).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const service = new CardAnnotationService();
    service.setScope('alice');
    service.saveUserAnnotation('ar00', { personalNotes: '第一版' });
    const old = service.getUserAnnotation('ar00')!;
    const sync = service.sync();
    await vi.waitFor(() => expect(resolve).toBeDefined());
    service.saveUserAnnotation('ar00', { personalNotes: '网络等待期间的第二版' });
    resolve([old]);
    await sync;
    expect(service.getMergedAnnotation('ar00').personalNotes).toBe('网络等待期间的第二版');
  });

  it('ignores a response that belongs to a previous account', async () => {
    let resolve!: (items: Partial<CardAnnotation>[]) => void;
    vi.mocked(syncUserAnnotations).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const service = new CardAnnotationService();
    service.setScope('alice');
    const sync = service.sync();
    await vi.waitFor(() => expect(resolve).toBeDefined());
    service.setScope('bob');
    resolve([{ cardId: 'ar00', personalNotes: 'Alice 的注解', updatedAt: '2026-09-16' }]);
    await sync;
    expect(service.getUserAnnotation('ar00')).toBeNull();
  });

  it('sends reset tombstones so old devices cannot resurrect an annotation', async () => {
    const service = new CardAnnotationService();
    service.setScope('alice');
    service.saveUserAnnotation('ar00', { personalNotes: '准备清除' });
    const old = service.getUserAnnotation('ar00')!;
    service.resetAnnotationToOfficial('ar00');
    vi.mocked(syncUserAnnotations).mockResolvedValueOnce([old]);
    await service.sync();
    expect(service.getUserAnnotation('ar00')).toBeNull();
    expect(service.getModifiedCardIds()).toEqual([]);
    expect(syncUserAnnotations).toHaveBeenLastCalledWith('alice', expect.arrayContaining([expect.objectContaining({ cardId: 'ar00', deletedAt: expect.any(String) })]));
  });
});
