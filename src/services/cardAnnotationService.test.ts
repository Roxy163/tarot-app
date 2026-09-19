import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalStorageBackupKey, getLocalStorageLatestBackupKey } from '../lib/safeLocalStorage';

const STORAGE_KEY = 'tarot_user_annotations_guest';

describe('cardAnnotationService', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('keeps booklet and individual annotations consistent, including cleared fields and resets', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T00:00:00.000Z'));
    const { cardAnnotationService: service } = await import('./cardAnnotationService');
    const { OFFICIAL_CARD_ANNOTATIONS } = await import('../constants/cardAnnotations');
    service.saveUserAnnotation('ar00', { uprightMeaning: '', keywords: [], personalNotes: '自己的注疏', personalMeaning: '自己的牌义' });
    service.saveUserAnnotation('ar01', { uprightMeaning: '待恢复的牌义' });
    service.resetAnnotationToOfficial('ar01');

    const booklet = service.getAllMergedAnnotations();
    expect(booklet).toHaveLength(78);
    for (const entry of booklet) expect(entry).toEqual(service.getMergedAnnotation(entry.cardId));
    expect(booklet.find(entry => entry.cardId === 'ar00')).toMatchObject({
      uprightMeaning: '', keywords: [], personalNotes: '自己的注疏', personalMeaning: '自己的牌义',
    });
    expect(booklet.find(entry => entry.cardId === 'ar01')?.uprightMeaning).toBe(
      OFFICIAL_CARD_ANNOTATIONS.find(entry => entry.cardId === 'ar01')?.uprightMeaning,
    );
  });

  it('preserves user fields and safe defaults for a card without official metadata', async () => {
    const { cardAnnotationService: service } = await import('./cardAnnotationService');
    service.saveUserAnnotation('custom-card', { personalMeaning: '自定义理解' });
    expect(service.getMergedAnnotation('custom-card')).toMatchObject({
      cardId: 'custom-card', personalMeaning: '自定义理解', numerology: null,
      uprightMeaning: '', reversedMeaning: '', keywords: [], personalNotes: '',
    });
  });

  it('restores user annotations from the latest safe copy when the primary record is corrupted', async () => {
    const { cardAnnotationService } = await import('./cardAnnotationService');

    cardAnnotationService.saveUserAnnotation('ar00', {
      keywords: ['起点'],
      personalNotes: '第一版注疏',
    });
    cardAnnotationService.saveUserAnnotation('ar01', {
      keywords: ['直觉'],
    });

    const backup = localStorage.getItem(getLocalStorageBackupKey(STORAGE_KEY));
    const latestBackup = localStorage.getItem(getLocalStorageLatestBackupKey(STORAGE_KEY));
    expect(backup).toContain('第一版注疏');
    expect(latestBackup).toContain('直觉');

    localStorage.setItem(STORAGE_KEY, '{broken-json');
    vi.resetModules();
    const { cardAnnotationService: freshService } = await import('./cardAnnotationService');

    expect(freshService.getMergedAnnotation('ar00').keywords).toContain('起点');
    expect(freshService.getMergedAnnotation('ar00').personalNotes).toBe('第一版注疏');
    expect(freshService.getMergedAnnotation('ar01').keywords).toContain('直觉');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(latestBackup);
  });
});
