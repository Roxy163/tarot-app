import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllNumerologySettings, saveNumerologySetting } from './firebaseData';
import { cacheNumerologySetting, clearRestoredNumerology, getBackupNumerology, getLocalBackupNumerology, getNumerologyCacheInfo, readRestoredNumerology, syncRestoredNumerology } from './backupNumerology';

vi.mock('./firebaseData', () => ({ getAllNumerologySettings: vi.fn(), saveNumerologySetting: vi.fn() }));
const setting = { numerology: 9, meaning: '我的理解', keywords: '独处' };
describe('backed up numerology', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.mocked(saveNumerologySetting).mockResolvedValue(); });
  afterEach(() => { vi.restoreAllMocks(); });
  const failCacheWrites = () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key === 'tarot_numerology_cache_one') throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
  };

  it('does not report a successful cloud refresh when the local cache cannot be saved', async () => {
    cacheNumerologySetting('one', '隐士', setting);
    failCacheWrites();
    vi.mocked(getAllNumerologySettings).mockResolvedValue({ 愚者: setting });
    await expect(getBackupNumerology('one')).rejects.toThrow('本机保存失败');
    expect(getLocalBackupNumerology('one')).toEqual({ 隐士: setting });
    expect(getNumerologyCacheInfo('one').checkedAt).toBeUndefined();
  });

  it('keeps imported numerology in the backup until its local cache is durable', async () => {
    localStorage.setItem('tarot_numerology_restore_one', JSON.stringify({ 隐士: setting }));
    failCacheWrites();
    vi.mocked(getAllNumerologySettings).mockResolvedValue({});
    await syncRestoredNumerology('one', () => true);
    expect(saveNumerologySetting).toHaveBeenCalledWith('one', '隐士', setting);
    expect(readRestoredNumerology('one')).toEqual({ 隐士: setting });
    expect(getLocalBackupNumerology('one')).toEqual({ 隐士: setting });
  });
  it('exports scoped cached settings immediately without fetching cloud data', () => {
    cacheNumerologySetting('one', '隐士', setting);
    cacheNumerologySetting('two', '愚者', setting);
    expect(getLocalBackupNumerology('one')).toEqual({ 隐士: setting });
    expect(getLocalBackupNumerology('guest')).toEqual({});
    expect(getAllNumerologySettings).not.toHaveBeenCalled();
  });
  it('keeps the cache after offline refresh and ignores a late response after switching accounts', async () => {
    cacheNumerologySetting('one', '隐士', setting);
    vi.mocked(getAllNumerologySettings).mockRejectedValueOnce(new Error('offline'));
    await expect(getBackupNumerology('one')).rejects.toThrow('本机备份仍可正常导出');
    expect(getLocalBackupNumerology('one')).toEqual({ 隐士: setting });
    vi.mocked(getAllNumerologySettings).mockResolvedValueOnce({ 愚者: setting });
    await expect(getBackupNumerology('one', () => false)).rejects.toThrow();
    expect(getNumerologyCacheInfo('one').checkedAt).toBeUndefined();
    expect(getLocalBackupNumerology('one')).toEqual({ 隐士: setting });
  });
  it('reads guest legacy numbers without accessing another account or the cloud', async () => {
    localStorage.setItem('tarot_user_numerology', JSON.stringify({ 隐士: 9 }));
    localStorage.setItem('tarot_numerology_restore_someone-else', JSON.stringify({ 愚者: setting }));
    expect(await getBackupNumerology()).toEqual({ 隐士: { numerology: 9, meaning: '', keywords: '' } });
    expect(getAllNumerologySettings).not.toHaveBeenCalled();
  });
  it('uses the current cloud setting before the queued import and keeps other-account queues isolated', async () => {
    localStorage.setItem('tarot_numerology_restore_one', JSON.stringify({ 隐士: setting, 愚者: setting }));
    localStorage.setItem('tarot_numerology_restore_two', JSON.stringify({ 隐士: { ...setting, meaning: '另一个账号' } }));
    vi.mocked(getAllNumerologySettings).mockResolvedValue({ 隐士: { ...setting, meaning: '云端更新' } });
    const backup = await getBackupNumerology('one');
    expect(backup.隐士.meaning).toBe('云端更新');
    expect(backup.愚者).toEqual(setting);
    await syncRestoredNumerology('one', () => true);
    expect(saveNumerologySetting).toHaveBeenCalledTimes(1);
    expect(saveNumerologySetting).toHaveBeenCalledWith('one', '愚者', setting);
    expect(readRestoredNumerology('one')).toEqual({});
    expect(getLocalBackupNumerology('one').愚者).toEqual(setting);
    expect(readRestoredNumerology('two').隐士.meaning).toBe('另一个账号');
  });
  it('retains imports after offline errors and stops when the account changes', async () => {
    localStorage.setItem('tarot_numerology_restore_one', JSON.stringify({ 隐士: setting }));
    vi.mocked(getAllNumerologySettings).mockRejectedValueOnce(new Error('offline'));
    await syncRestoredNumerology('one', () => true);
    expect(readRestoredNumerology('one')).toEqual({ 隐士: setting });
    vi.mocked(getAllNumerologySettings).mockResolvedValue({});
    await syncRestoredNumerology('one', () => false);
    expect(saveNumerologySetting).not.toHaveBeenCalled();
    expect(readRestoredNumerology('one')).toEqual({ 隐士: setting });
    clearRestoredNumerology('one', '隐士');
    expect(readRestoredNumerology('one')).toEqual({});
  });
});
