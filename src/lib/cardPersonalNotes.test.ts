import { beforeEach, describe, expect, it } from 'vitest';
import { readLocalDraft, resetDraftMemory, writeLocalDraft } from '../hooks/useLocalDraft';
import { cardPersonalNotesPatch, getCardPersonalNotes } from './cardPersonalNotes';
import { clearCardPersonalNoteDrafts, getCardAnnotationDraftKey, readCardPersonalNoteText, writeCardPersonalNoteDraft } from './cardPersonalNoteDrafts';

describe('shared personal card notes', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); resetDraftMemory(); });

  it('deduplicates identical legacy fields and preserves different originals exactly', () => {
    expect(getCardPersonalNotes({ personalMeaning: '同一段\n原文', personalNotes: '同一段\n原文' })).toBe('同一段\n原文');
    expect(getCardPersonalNotes({ personalMeaning: ' 原笔记\n第一段 ', personalNotes: '另一入口\n第二段' })).toBe(' 原笔记\n第一段 \n\n另一入口\n第二段');
    expect(cardPersonalNotesPatch('同一份新笔记')).toEqual({ personalMeaning: '同一份新笔记', personalNotes: '同一份新笔记' });
  });

  it('reads both legacy drafts without changing the originals and shares intentional empty text by account', () => {
    const meaningKey = 'tarot_personal_meaning_draft_alice';
    const editorKey = getCardAnnotationDraftKey('alice', 'ar00');
    writeLocalDraft(meaningKey, { 愚者: '旧入口草稿\n未写完' });
    writeLocalDraft(editorKey, { personalNotes: '另一入口的未保存原文', uprightMeaning: '未保存的正位' });
    expect(readCardPersonalNoteText('alice', 'ar00', '愚者')).toBe('旧入口草稿\n未写完\n\n另一入口的未保存原文');
    expect(readLocalDraft(editorKey)).toEqual({ personalNotes: '另一入口的未保存原文', uprightMeaning: '未保存的正位' });
    expect(readLocalDraft(meaningKey)).toEqual({ 愚者: '旧入口草稿\n未写完' });
    writeCardPersonalNoteDraft('alice', 'ar00', '');
    expect(readCardPersonalNoteText('alice', 'ar00', '愚者', { personalMeaning: '原已保存内容' })).toBe('');
    expect(readCardPersonalNoteText('bob', 'ar00', '愚者', { personalNotes: 'Bob 的笔记' })).toBe('Bob 的笔记');
  });

  it('retires one saved note draft while keeping other cards and unsaved official fields', () => {
    writeLocalDraft('tarot_personal_meaning_draft_alice', { 愚者: '旧稿', 魔术师: '另一张牌旧稿' });
    const editorKey = getCardAnnotationDraftKey('alice', 'ar00');
    writeLocalDraft(editorKey, { personalNotes: '旧编辑笔记', personalNotesUnified: true, uprightMeaning: '仍未保存的正位释义' });
    writeCardPersonalNoteDraft('alice', 'ar00', '已保存的合并内容');
    clearCardPersonalNoteDrafts('alice', 'ar00', '愚者');
    expect(readLocalDraft('tarot_personal_meaning_draft_alice')).toEqual({ 魔术师: '另一张牌旧稿' });
    expect(readLocalDraft(editorKey)).toEqual({ uprightMeaning: '仍未保存的正位释义' });
    expect(readCardPersonalNoteText('alice', 'ar00', '愚者', cardPersonalNotesPatch('已保存的合并内容'))).toBe('已保存的合并内容');
  });
});
