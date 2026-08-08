import { describe, expect, it, beforeEach } from 'vitest';
import {
  getLocalStorageBackupKey,
  getLocalStorageLatestBackupKey,
  readJsonArrayWithBackup,
  readJsonRecordWithBackup,
  writeJsonWithBackup,
} from './safeLocalStorage';

describe('safeLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
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
