import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  getLocalStorageBackupKey,
  getLocalStorageLatestBackupKey,
  readJsonArrayWithBackup,
  readJsonRecordWithBackup,
  writeJsonWithBackup,
} from './safeLocalStorage';

describe('safeLocalStorage', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    localStorage.clear();
  });

  describe.each([
    { kind: 'array', read: (key: string) => readJsonArrayWithBackup(key), valid: '["saved"]', invalid: '{}' },
    { kind: 'record', read: (key: string) => readJsonRecordWithBackup(key), valid: '{"note":"saved"}', invalid: '[]' },
  ])('$kind recovery', ({ read, valid, invalid }) => {
    it('uses a valid primary without reading or rewriting backups', () => {
      localStorage.setItem('record', valid);
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      expect(read('record')).toEqual(JSON.parse(valid));
      expect(getItem).toHaveBeenCalledTimes(1);
      expect(getItem).toHaveBeenCalledWith('record');
      expect(setItem).not.toHaveBeenCalled();
    });

    it('returns a usable previous backup even when restoring the primary is forbidden', () => {
      localStorage.setItem('record', '{broken');
      localStorage.setItem(getLocalStorageLatestBackupKey('record'), invalid);
      localStorage.setItem(getLocalStorageBackupKey('record'), valid);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });

      expect(read('record')).toEqual(JSON.parse(valid));
      expect(localStorage.getItem('record')).toBe('{broken');
    });

    it('returns null if storage cannot be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      expect(read('record')).toBeNull();
    });
  });

  it('saves the primary record even when the previous backup cannot fit', () => {
    localStorage.setItem('records', '["old"]');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key.includes('__backup')) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    expect(writeJsonWithBackup('records', ['new']).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem('records')!)).toEqual(['new']);
  });

  it('reports a primary write failure without replacing the saved data', () => {
    localStorage.setItem('records', '["old"]');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key === 'records') throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    expect(writeJsonWithBackup('records', ['new']).ok).toBe(false);
    expect(JSON.parse(localStorage.getItem('records')!)).toEqual(['old']);
  });

  it('does not report failure when only the latest mirror fails', () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key.includes('__latest')) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    expect(writeJsonWithBackup('records', ['new']).ok).toBe(true);
    expect(readJsonArrayWithBackup('records')).toEqual(['new']);
  });

  it('keeps a valid previous copy before overwriting local JSON', () => {
    writeJsonWithBackup('tarot_test_records', [{ id: 'first' }]);
    writeJsonWithBackup('tarot_test_records', [{ id: 'second' }]);

    expect(JSON.parse(localStorage.getItem(getLocalStorageBackupKey('tarot_test_records')) || '[]')).toEqual([
      { id: 'first' },
    ]);
    expect(JSON.parse(localStorage.getItem(getLocalStorageLatestBackupKey('tarot_test_records')) || '[]')).toEqual([
      { id: 'second' },
    ]);
    expect(readJsonArrayWithBackup('tarot_test_records')).toEqual([{ id: 'second' }]);
  });

  it('restores from the latest mirror when the primary local JSON is corrupted', () => {
    localStorage.setItem('tarot_test_records', JSON.stringify([{ id: 'safe' }]));
    writeJsonWithBackup('tarot_test_records', [{ id: 'newer' }]);
    localStorage.setItem('tarot_test_records', '{broken-json');

    expect(readJsonArrayWithBackup('tarot_test_records')).toEqual([{ id: 'newer' }]);
    expect(localStorage.getItem('tarot_test_records')).toBe(JSON.stringify([{ id: 'newer' }]));
  });

  it('restores array-shaped data from the latest mirror when the primary shape is wrong', () => {
    localStorage.setItem('tarot_test_records', JSON.stringify([{ id: 'safe' }]));
    writeJsonWithBackup('tarot_test_records', [{ id: 'newer' }]);
    localStorage.setItem('tarot_test_records', JSON.stringify({ id: 'wrong-shape' }));

    expect(readJsonArrayWithBackup('tarot_test_records')).toEqual([{ id: 'newer' }]);
    expect(localStorage.getItem('tarot_test_records')).toBe(JSON.stringify([{ id: 'newer' }]));
  });

  it('falls back to the previous backup if the latest mirror is corrupted too', () => {
    localStorage.setItem('tarot_test_records', JSON.stringify([{ id: 'safe' }]));
    writeJsonWithBackup('tarot_test_records', [{ id: 'newer' }]);
    localStorage.setItem('tarot_test_records', '{broken-json');
    localStorage.setItem(getLocalStorageLatestBackupKey('tarot_test_records'), '{also-broken');

    expect(readJsonArrayWithBackup('tarot_test_records')).toEqual([{ id: 'safe' }]);
    expect(localStorage.getItem('tarot_test_records')).toBe(JSON.stringify([{ id: 'safe' }]));
  });

  it('restores object-shaped local JSON from the latest mirror too', () => {
    localStorage.setItem('tarot_test_settings', JSON.stringify({ fool: { note: 'old' } }));
    writeJsonWithBackup('tarot_test_settings', { fool: { note: 'new' } });
    localStorage.setItem('tarot_test_settings', '{broken-json');

    expect(readJsonRecordWithBackup('tarot_test_settings')).toEqual({ fool: { note: 'new' } });
    expect(localStorage.getItem('tarot_test_settings')).toBe(JSON.stringify({ fool: { note: 'new' } }));
  });

  it('restores object-shaped data from the latest mirror when the primary shape is wrong', () => {
    localStorage.setItem('tarot_test_settings', JSON.stringify({ fool: { note: 'old' } }));
    writeJsonWithBackup('tarot_test_settings', { fool: { note: 'new' } });
    localStorage.setItem('tarot_test_settings', JSON.stringify(['wrong-shape']));

    expect(readJsonRecordWithBackup('tarot_test_settings')).toEqual({ fool: { note: 'new' } });
    expect(localStorage.getItem('tarot_test_settings')).toBe(JSON.stringify({ fool: { note: 'new' } }));
  });
});
