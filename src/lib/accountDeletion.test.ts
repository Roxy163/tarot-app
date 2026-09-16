import { beforeEach, describe, expect, it } from 'vitest';
import { clearDeletedAccountLocalData } from './accountDeletion';

describe('clearDeletedAccountLocalData', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears only the deleted account and its recoverable local backups', () => {
    localStorage.setItem('tarot_readings_user-1', '[{"id":"r1"}]');
    localStorage.setItem('tarot_readings_user-1__backup', '[{"id":"old"}]');
    localStorage.setItem('tarot_readings_user-1__latest', '[{"id":"r1"}]');
    localStorage.setItem('tarot_daily_fortunes_user-1', '[{"id":"day"}]');
    localStorage.setItem('tarot_cached_profile_user-1', '{"id":"user-1"}');
    localStorage.setItem('tarot_readings_user-2', '[{"id":"r2"}]');
    localStorage.setItem('tarot_user_accounts', JSON.stringify({ 'user-1': { email: 'one@example.com' }, 'user-2': { email: 'two@example.com' } }));
    localStorage.setItem('tarot_login_history', JSON.stringify({ identifier: 'one@example.com' }));
    sessionStorage.setItem('tarot_email_verification_prompt_user-1', 'shown');

    expect(clearDeletedAccountLocalData('user-1', 'one@example.com')).toBe(true);

    expect(localStorage.getItem('tarot_readings_user-1')).toBeNull();
    expect(localStorage.getItem('tarot_readings_user-1__backup')).toBeNull();
    expect(localStorage.getItem('tarot_readings_user-1__latest')).toBeNull();
    expect(localStorage.getItem('tarot_daily_fortunes_user-1')).toBeNull();
    expect(localStorage.getItem('tarot_cached_profile_user-1')).toBeNull();
    expect(localStorage.getItem('tarot_readings_user-2')).toBe('[{"id":"r2"}]');
    expect(JSON.parse(localStorage.getItem('tarot_user_accounts') || '{}')).toEqual({ 'user-2': { email: 'two@example.com' } });
    expect(localStorage.getItem('tarot_login_history')).toBeNull();
    expect(sessionStorage.getItem('tarot_email_verification_prompt_user-1')).toBeNull();
  });
});
