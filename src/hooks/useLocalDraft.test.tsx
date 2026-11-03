import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clearAccountDrafts, isLocalDraftDurable, readLocalDraft, resetDraftMemory, useLocalDraft, writeLocalDraft } from './useLocalDraft';

describe('local drafts', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); resetDraftMemory(); });
  afterEach(() => vi.restoreAllMocks());
  it('restores a draft after unmount and a fresh runtime', () => {
    const { unmount } = renderHook(() => useLocalDraft('draft', { question: '还没选牌的问题', slots: [{ isReversed: true, freePosition: { x: 42, y: 21 } }] }));
    unmount();
    resetDraftMemory();
    expect(readLocalDraft('draft')).toEqual({ question: '还没选牌的问题', slots: [{ isReversed: true, freePosition: { x: 42, y: 21 } }] });
  });
  it('removes successful drafts but resumes autosave when editing again', () => {
    const { result, rerender } = renderHook(({ note }) => useLocalDraft('draft', { note }), { initialProps: { note: 'first' } });
    act(() => result.current.clear());
    resetDraftMemory();
    expect(readLocalDraft('draft')).toBeNull();
    rerender({ note: 'second' });
    expect(readLocalDraft('draft')).toEqual({ note: 'second' });
  });
  it('retains failed writes across navigation and warns on page exit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    const { result, unmount } = renderHook(() => useLocalDraft('draft', { note: '保留我' }));
    expect(result.current.durable).toBe(false);
    unmount();
    expect(readLocalDraft('draft')).toEqual({ note: '保留我' });
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    resetDraftMemory();
  });
  it('clears daily drafts for a deleted account without clearing another account', () => {
    renderHook(() => useLocalDraft('tarot_daily_reflection_draft_user-a_fortune', { initialImpression: 'a' }));
    renderHook(() => useLocalDraft('tarot_daily_reflection_draft_user-b_fortune', { initialImpression: 'b' }));
    clearAccountDrafts('user-a');
    resetDraftMemory();
    expect(readLocalDraft('tarot_daily_reflection_draft_user-a_fortune')).toBeNull();
    expect(readLocalDraft('tarot_daily_reflection_draft_user-b_fortune')).toEqual({ initialImpression: 'b' });
  });
  it('shares imperative draft updates with hook reads and keeps the newest value after a failed write', () => {
    expect(writeLocalDraft('draft', { note: '旧稿' })).toBe(true);
    expect(readLocalDraft('draft')).toEqual({ note: '旧稿' });
    const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(writeLocalDraft('draft', { note: '写入失败的新稿' })).toBe(false);
    expect(readLocalDraft('draft')).toEqual({ note: '写入失败的新稿' });
    expect(isLocalDraftDurable('draft')).toBe(false);
    fail.mockRestore();
    expect(writeLocalDraft('draft', { note: '恢复写入后的新稿' })).toBe(true);
    expect(isLocalDraftDurable('draft')).toBe(true);
    resetDraftMemory();
    expect(readLocalDraft('draft')).toEqual({ note: '恢复写入后的新稿' });
  });
  it('clears shared card-note drafts only for the deleted account', () => {
    writeLocalDraft('tarot_card_personal_note_draft_user-a_ar00', { text: 'a' });
    writeLocalDraft('tarot_card_personal_note_draft_user-b_ar00', { text: 'b' });
    clearAccountDrafts('user-a');
    resetDraftMemory();
    expect(readLocalDraft('tarot_card_personal_note_draft_user-a_ar00')).toBeNull();
    expect(readLocalDraft('tarot_card_personal_note_draft_user-b_ar00')).toEqual({ text: 'b' });
  });
});
