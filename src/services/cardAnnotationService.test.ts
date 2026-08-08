import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalStorageBackupKey, getLocalStorageLatestBackupKey } from '../lib/safeLocalStorage';

const STORAGE_KEY = 'tarot_user_annotations';

describe('cardAnnotationService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
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
