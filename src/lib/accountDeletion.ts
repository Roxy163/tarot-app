const USER_STORAGE_PREFIXES = [
  'tarot_readings',
  'tarot_spreads',
  'tarot_card_metadata',
  'tarot_card_keyword_memory',
  'tarot_quiz_memory',
  'tarot_daily_fortunes',
  'tarot_cached_profile',
  'tarot_pending_profile_update',
  'tarot_last_cloud_sync_at',
];

const STORAGE_SUFFIXES = ['', '__backup', '__latest', '__backup_at', '__latest_at'];

export const clearDeletedAccountLocalData = (uid: string, email?: string | null): boolean => {
  try {
    for (const prefix of USER_STORAGE_PREFIXES) {
      const key = `${prefix}_${uid}`;
      for (const suffix of STORAGE_SUFFIXES) {
        localStorage.removeItem(`${key}${suffix}`);
      }
    }

    const accountsRaw = localStorage.getItem('tarot_user_accounts');
    if (accountsRaw) {
      const accounts = JSON.parse(accountsRaw) as Record<string, unknown>;
      delete accounts[uid];
      localStorage.setItem('tarot_user_accounts', JSON.stringify(accounts));
    }

    const historyRaw = localStorage.getItem('tarot_login_history');
    if (historyRaw && email) {
      const history = JSON.parse(historyRaw) as { identifier?: string };
      if (history.identifier?.toLowerCase() === email.toLowerCase()) {
        localStorage.removeItem('tarot_login_history');
      }
    }

    sessionStorage.removeItem(`tarot_email_verification_prompt_${uid}`);
    return true;
  } catch (error) {
    console.warn('Deleted account local data could not be fully cleared:', error);
    return false;
  }
};
