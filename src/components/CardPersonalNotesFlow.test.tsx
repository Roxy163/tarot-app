import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardMetadataManager } from './CardMetadataManager';
import { CardAnnotationEditor } from './CardAnnotationEditor';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { getCardPersonalNotes } from '../lib/cardPersonalNotes';
import { getCardAnnotationDraftKey, readCardPersonalNoteText } from '../lib/cardPersonalNoteDrafts';
import { readLocalDraft, resetDraftMemory, writeLocalDraft } from '../hooks/useLocalDraft';
import { getAnnotationByCardId } from '../constants/cardAnnotations';

const meaningPlaceholder = '在此记录你对这张牌的独特见解、私人感悟或研习心得...';
const notesPlaceholder = '记录你个人对这张牌的理解和感悟...';
const renderLibrary = () => render(<CardMetadataManager metadata={[]} onUpdate={vi.fn()} readings={[]} />);

describe('shared personal notes and safe official restore', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); resetDraftMemory();
    cardAnnotationService.setScope();
    cardAnnotationService.clearAllUserData();
  });
  afterEach(() => { cleanup(); resetDraftMemory(); vi.restoreAllMocks(); });

  it('shows both saved originals in both entries without writing on view, then saves one shared text', async () => {
    const user = userEvent.setup();
    cardAnnotationService.saveUserAnnotation('ar00', { personalMeaning: ' 旧笔记\n原来的换行 ', personalNotes: '另一入口的注解\n也保留' });
    const original = { ...cardAnnotationService.getUserAnnotation('ar00')! };
    const joined = getCardPersonalNotes(original);
    renderLibrary();
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const source = screen.getByRole('main', { name: '愚者研习资料' });
    expect(within(source).getByPlaceholderText(meaningPlaceholder)).toHaveValue(joined);
    await user.click(within(source).getByRole('button', { name: '编辑这张牌义' }));
    const editor = screen.getByRole('main', { name: '编辑牌义' });
    const text = within(editor).getByPlaceholderText(notesPlaceholder);
    expect(text).toHaveValue(joined);
    expect(cardAnnotationService.getUserAnnotation('ar00')).toEqual(original);
    await user.type(text, '新的补充');
    await user.click(within(editor).getByRole('button', { name: '保存修改' }));
    expect(cardAnnotationService.getUserAnnotation('ar00')).toMatchObject({ personalMeaning: `${joined}新的补充`, personalNotes: `${joined}新的补充` });
    await user.click(within(editor).getByRole('button', { name: '返回（编辑牌义）' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '编辑牌义' })).not.toBeInTheDocument());
    expect(within(source).getByPlaceholderText(meaningPlaceholder)).toHaveValue(`${joined}新的补充`);
  });

  it('shares an unsaved note through both entries and saves from the library without reviving an old editor draft', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const source = screen.getByRole('main', { name: '愚者研习资料' });
    await user.type(within(source).getByPlaceholderText(meaningPlaceholder), '资料页尚未保存的笔记');
    await user.click(within(source).getByRole('button', { name: '编辑这张牌义' }));
    const editor = screen.getByRole('main', { name: '编辑牌义' });
    expect(within(editor).getByPlaceholderText(notesPlaceholder)).toHaveValue('资料页尚未保存的笔记');
    await user.type(within(editor).getByPlaceholderText(notesPlaceholder), '，从编辑页继续写');
    await user.clear(within(editor).getByPlaceholderText('请输入正位的详细释义...'));
    await user.type(within(editor).getByPlaceholderText('请输入正位的详细释义...'), '另有尚未保存的正位修改');
    await user.click(within(editor).getByRole('button', { name: '返回（编辑牌义）' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '编辑牌义' })).not.toBeInTheDocument());
    expect(within(source).getByPlaceholderText(meaningPlaceholder)).toHaveValue('资料页尚未保存的笔记，从编辑页继续写');
    await user.click(within(source).getByRole('button', { name: '保存' }));
    expect(cardAnnotationService.getUserAnnotation('ar00')).toMatchObject({ personalMeaning: '资料页尚未保存的笔记，从编辑页继续写', personalNotes: '资料页尚未保存的笔记，从编辑页继续写' });
    await user.click(within(source).getByRole('button', { name: '编辑这张牌义' }));
    expect(screen.getByPlaceholderText(notesPlaceholder)).toHaveValue('资料页尚未保存的笔记，从编辑页继续写');
    expect(screen.getByPlaceholderText('请输入正位的详细释义...')).toHaveValue('另有尚未保存的正位修改');
  });

  it('keeps both legacy draft texts until an explicit save and leaves other cards’ drafts intact', async () => {
    const user = userEvent.setup();
    writeLocalDraft('tarot_personal_meaning_draft_guest', { 愚者: '旧牌库草稿\n未完成', 魔术师: '另一张牌草稿' });
    writeLocalDraft(getCardAnnotationDraftKey('guest', 'ar00'), { personalNotes: '旧编辑页草稿\n仍要保留', uprightMeaning: '旧的未保存释义' });
    renderLibrary();
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const source = screen.getByRole('main', { name: '愚者研习资料' });
    expect(within(source).getByPlaceholderText(meaningPlaceholder)).toHaveValue('旧牌库草稿\n未完成\n\n旧编辑页草稿\n仍要保留');
    expect(cardAnnotationService.getUserAnnotation('ar00')).toBeNull();
    await user.click(within(source).getByRole('button', { name: '保存' }));
    expect(readLocalDraft('tarot_personal_meaning_draft_guest')).toEqual({ 魔术师: '另一张牌草稿' });
    await user.click(within(source).getByRole('button', { name: '编辑这张牌义' }));
    expect(screen.getByPlaceholderText(notesPlaceholder)).toHaveValue('旧牌库草稿\n未完成\n\n旧编辑页草稿\n仍要保留');
    expect(screen.getByPlaceholderText('请输入正位的详细释义...')).toHaveValue('旧的未保存释义');
  });

  it('confirms the restore scope and retains saved originals and the current unsaved personal text across reopening', async () => {
    const user = userEvent.setup();
    cardAnnotationService.saveUserAnnotation('ar00', { personalMeaning: '已保存的笔记原文', personalNotes: '已保存的注解原文', uprightMeaning: '自定义正位' });
    const original = { ...cardAnnotationService.getUserAnnotation('ar00')! };
    const first = render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    const text = screen.getByPlaceholderText(notesPlaceholder);
    await user.type(text, '，尚未保存的补充');
    const expected = `${getCardPersonalNotes(original)}，尚未保存的补充`;
    await user.click(screen.getByRole('button', { name: '恢复官方' }));
    const confirm = screen.getByRole('dialog', { name: '恢复官方字段' });
    expect(within(confirm).getByText(/正在填写的个人笔记、日运例证都会保留/)).toBeInTheDocument();
    expect(cardAnnotationService.getUserAnnotation('ar00')).toEqual(original);
    await user.click(within(confirm).getByRole('button', { name: '取消' }));
    expect(text).toHaveValue(expected);
    await user.click(screen.getByRole('button', { name: '恢复官方' }));
    await user.click(within(screen.getByRole('dialog', { name: '恢复官方字段' })).getByRole('button', { name: '恢复官方字段' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '恢复官方字段' })).not.toBeInTheDocument());
    expect(cardAnnotationService.getUserAnnotation('ar00')).toMatchObject({ personalMeaning: original.personalMeaning, personalNotes: original.personalNotes, uprightMeaning: getAnnotationByCardId('ar00')!.uprightMeaning });
    expect(text).toHaveValue(expected);
    first.unmount(); resetDraftMemory();
    render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(notesPlaceholder)).toHaveValue(expected);
    expect(screen.getByPlaceholderText('请输入正位的详细释义...')).toHaveValue(getAnnotationByCardId('ar00')!.uprightMeaning);
  });

  it('keeps the restore confirmation, saved record and draft on failure, then retries successfully', async () => {
    const user = userEvent.setup();
    cardAnnotationService.saveUserAnnotation('ar00', { personalMeaning: '已保存笔记', personalNotes: '旧注解', uprightMeaning: '原自定义正位' });
    const original = { ...cardAnnotationService.getUserAnnotation('ar00')! };
    render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(notesPlaceholder), '待保存');
    const expected = `${getCardPersonalNotes(original)}待保存`;
    await user.click(screen.getByRole('button', { name: '恢复官方' }));
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await user.click(within(screen.getByRole('dialog', { name: '恢复官方字段' })).getByRole('button', { name: '恢复官方字段' }));
    expect(screen.getByRole('dialog', { name: '恢复官方字段' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('恢复失败');
    expect(cardAnnotationService.getUserAnnotation('ar00')).toEqual(original);
    expect(screen.getByPlaceholderText(notesPlaceholder)).toHaveValue(expected);
    expect(readLocalDraft<{ personalNotes: string }>(getCardAnnotationDraftKey('guest', 'ar00'))?.personalNotes).toBe(expected);
    blocked.mockRestore();
    await user.click(within(screen.getByRole('dialog', { name: '恢复官方字段' })).getByRole('button', { name: '恢复官方字段' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '恢复官方字段' })).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText(notesPlaceholder)).toHaveValue(expected);
    expect(cardAnnotationService.getMergedAnnotation('ar00').uprightMeaning).toBe(getAnnotationByCardId('ar00')!.uprightMeaning);
  });

  it('keeps the latest shared draft and saved record when a library save fails', async () => {
    const user = userEvent.setup();
    const onShowSnackbar = vi.fn();
    cardAnnotationService.saveUserAnnotation('ar00', { personalMeaning: '原笔记', personalNotes: '原笔记' });
    render(<CardMetadataManager metadata={[]} onUpdate={vi.fn()} readings={[]} onShowSnackbar={onShowSnackbar} />);
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const source = screen.getByRole('main', { name: '愚者研习资料' });
    await user.type(within(source).getByPlaceholderText(meaningPlaceholder), '待保存');
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await user.click(within(source).getByRole('button', { name: '保存' }));
    expect(cardAnnotationService.getUserAnnotation('ar00')).toMatchObject({ personalMeaning: '原笔记', personalNotes: '原笔记' });
    expect(within(source).getByPlaceholderText(meaningPlaceholder)).toHaveValue('原笔记待保存');
    expect(onShowSnackbar).toHaveBeenCalledWith(expect.stringContaining('保存失败'));
    blocked.mockRestore();
    await user.click(within(source).getByRole('button', { name: '保存' }));
    expect(cardAnnotationService.getUserAnnotation('ar00')).toMatchObject({ personalMeaning: '原笔记待保存', personalNotes: '原笔记待保存' });
  });

  it('reports a successful note save even if retiring a legacy draft cannot write to disk', async () => {
    const user = userEvent.setup();
    const onShowSnackbar = vi.fn();
    writeLocalDraft('tarot_personal_meaning_draft_guest', { 愚者: '旧笔记草稿', 魔术师: '另一张牌仍未保存' });
    render(<CardMetadataManager metadata={[]} onUpdate={vi.fn()} readings={[]} onShowSnackbar={onShowSnackbar} />);
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const source = screen.getByRole('main', { name: '愚者研习资料' });
    await user.type(within(source).getByPlaceholderText(meaningPlaceholder), '，正式保存的新文字');
    const originalSetItem = Storage.prototype.setItem;
    const failedCleanup = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'tarot_personal_meaning_draft_guest') throw new Error('legacy cleanup full');
      return originalSetItem.call(this, key, value);
    });
    await user.click(within(source).getByRole('button', { name: '保存' }));
    expect(cardAnnotationService.getUserAnnotation('ar00')).toMatchObject({ personalMeaning: '旧笔记草稿，正式保存的新文字', personalNotes: '旧笔记草稿，正式保存的新文字' });
    expect(within(source).getByPlaceholderText(meaningPlaceholder)).toHaveValue('旧笔记草稿，正式保存的新文字');
    expect(readLocalDraft('tarot_personal_meaning_draft_guest')).toEqual({ 魔术师: '另一张牌仍未保存' });
    expect(onShowSnackbar).toHaveBeenCalledWith('《愚者》的注疏已保存在本机。');
    expect(onShowSnackbar).not.toHaveBeenCalledWith(expect.stringContaining('保存失败'));
    failedCleanup.mockRestore();
    cleanup(); resetDraftMemory();
    expect(readCardPersonalNoteText('guest', 'ar00', '愚者', cardAnnotationService.getUserAnnotation('ar00'))).toBe('旧笔记草稿，正式保存的新文字');
  });
});
