import { beforeEach, describe, expect, it } from 'vitest';
import { resetDraftMemory } from '../hooks/useLocalDraft';
import { findResumableReading } from './resumableReading';
import type { TarotReading } from '../types';

const put = (scope: string, id: string, question: string, extra = {}) => localStorage.setItem(`tarot_reading_draft_${scope}_${id}`, JSON.stringify({
  formData: { question }, cardSlots: [{ name: '', isReversed: false }], cardInterpretations: [], cardQuestions: [], ...extra,
}));
describe('resume reading entry', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); resetDraftMemory(); });
  it('ignores empty and unchanged drafts, including a default daily title', () => {
    put('guest', 'new', '今日抽牌记录');
    expect(findResumableReading('guest', [])).toBeNull();
    put('guest', 'new', '只是打开过', { hasUnsavedChanges: false });
    expect(findResumableReading('guest', [])).toBeNull();
  });
  it('chooses the latest meaningful new or saved-reading draft and ignores deleted readings', () => {
    put('one', 'new', '新手记', { updatedAt: '2026-10-21T10:00:00Z' });
    put('one', 'saved', '继续修改', { updatedAt: '2026-10-21T11:00:00Z', cardSlots: [{ name: '隐士' }] });
    put('one', 'deleted', '已删除', { updatedAt: '2026-10-21T12:00:00Z' });
    expect(findResumableReading('one', [{ id: 'saved' } as TarotReading])).toMatchObject({ id: 'saved', question: '继续修改', filled: 1 });
    expect(findResumableReading('one', [])).toMatchObject({ id: 'new' });
  });
  it('does not read other owners, including accounts whose IDs share a prefix', () => {
    put('one_two', 'new', '另一个账号');
    put('guest', 'new', '游客草稿');
    expect(findResumableReading('one', [])).toBeNull();
    expect(findResumableReading('two', [])).toBeNull();
    put('one', 'new', '', { cardInterpretations: ['只写了解读'] });
    expect(findResumableReading('one', [])).toMatchObject({ id: 'new', question: '未完成的手记' });
  });
});
