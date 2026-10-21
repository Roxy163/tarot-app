import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardNumerology } from './useCardNumerology';
import { getNumerologySetting, saveNumerologySetting, deleteNumerologySetting } from '../lib/firebaseData';
import { cacheNumerologySetting, getLocalBackupNumerology } from '../lib/backupNumerology';

vi.mock('../lib/firebaseData', () => ({ getNumerologySetting: vi.fn(), saveNumerologySetting: vi.fn(), deleteNumerologySetting: vi.fn() }));
describe('numerology restored to the current account', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it.each(['save', 'reset'])('preserves a restored setting when %s cannot update its local cache', async action => {
    const setting = { numerology: 9, meaning: '不能丢的导入内容', keywords: '安静' };
    localStorage.setItem('tarot_numerology_restore_one', JSON.stringify({ 隐士: setting }));
    const { result } = renderHook(() => useCardNumerology('隐士', true, 'one'));
    const setItem = Storage.prototype.setItem;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (key === 'tarot_numerology_cache_one') throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    vi.mocked(saveNumerologySetting).mockResolvedValue();
    vi.mocked(deleteNumerologySetting).mockResolvedValue();
    await act(async () => {
      expect(await (action === 'save' ? result.current.saveNumerology(8, '新内容', '') : result.current.restoreDefault())).toBe(false);
    });
    expect(getLocalBackupNumerology('one')).toEqual({ 隐士: setting });
    expect(JSON.parse(localStorage.getItem('tarot_numerology_restore_one')!)).toEqual({ 隐士: setting });
    expect(result.current.meaning).toBe(setting.meaning);
  });
  it('keeps cached custom numerology available offline and mirrors save/reset to backups', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    cacheNumerologySetting('one', '隐士', { numerology: 9, meaning: '离线可读', keywords: '独处' });
    vi.mocked(getNumerologySetting).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useCardNumerology('隐士', true, 'one'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.meaning).toBe('离线可读');
    expect(result.current.isCustom).toBe(true);
    vi.mocked(saveNumerologySetting).mockResolvedValue();
    await act(async () => { await result.current.saveNumerology(8, '新缓存', '新词'); });
    expect(getLocalBackupNumerology('one').隐士.meaning).toBe('新缓存');
    vi.mocked(deleteNumerologySetting).mockResolvedValue();
    await act(async () => { await result.current.restoreDefault(); });
    expect(getLocalBackupNumerology('one')).toEqual({});
    warn.mockRestore();
  });
  it('reads a restored local setting immediately, then retires it after an explicit save', async () => {
    localStorage.setItem('tarot_numerology_restore_one', JSON.stringify({ 隐士: { numerology: 9, meaning: '已恢复', keywords: '安静' } }));
    const { result } = renderHook(() => useCardNumerology('隐士', true, 'one'));
    expect(result.current.meaning).toBe('已恢复');
    expect(getNumerologySetting).not.toHaveBeenCalled();
    vi.mocked(saveNumerologySetting).mockResolvedValue();
    await act(async () => { await result.current.saveNumerology(8, '后来修改', '新词'); });
    expect(result.current.meaning).toBe('后来修改');
    expect(JSON.parse(localStorage.getItem('tarot_numerology_restore_one')!)).toEqual({});
  });
  it('ignores a previous account response after switching accounts', async () => {
    let resolveOld: (value: { numerology: number; meaning: string; keywords: string }) => void;
    vi.mocked(getNumerologySetting).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ numerology: 2, meaning: '当前账号', keywords: '' });
    const { result, rerender } = renderHook(({ uid }) => useCardNumerology('隐士', true, uid), { initialProps: { uid: 'one' } });
    rerender({ uid: 'two' });
    await waitFor(() => expect(result.current.meaning).toBe('当前账号'));
    await act(async () => { resolveOld!({ numerology: 9, meaning: '过期响应', keywords: '' }); });
    expect(result.current.meaning).toBe('当前账号');
    expect(deleteNumerologySetting).not.toHaveBeenCalled();
  });
});
