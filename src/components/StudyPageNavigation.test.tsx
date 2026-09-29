import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardMetadataManager } from './CardMetadataManager';
import { CardCorrespondenceEditor } from './CardCorrespondenceEditor';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { resetDraftMemory } from '../hooks/useLocalDraft';
import { closeTopModal } from '../hooks/useModalFocus';
import * as firebaseData from '../lib/firebaseData';

describe('study page navigation', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); resetDraftMemory();
    cardAnnotationService.clearAllUserData();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns from annotation editing to the same detail page with its scroll and personal notes intact', async () => {
    const user = userEvent.setup();
    const { container } = render(<CardMetadataManager metadata={[]} onUpdate={vi.fn()} readings={[]} isLoggedIn={false} />);
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const detail = screen.getByRole('main', { name: '愚者研习资料' });
    const scroll = detail.querySelector('[data-page-scroll]')!;
    scroll.scrollTop = 240;
    await user.type(screen.getByPlaceholderText('在此记录你对这张牌的独特见解、私人感悟或研习心得...'), '保留我的独特见解');
    await user.click(screen.getByRole('button', { name: '编辑这张牌义' }));
    expect(screen.getByRole('main', { name: '编辑牌义' })).toBeInTheDocument();
    expect(detail.inert).toBe(true);
    await user.type(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...'), '稍后继续写');
    act(() => { closeTopModal(); });
    await waitFor(() => expect(screen.queryByRole('main', { name: '编辑牌义' })).not.toBeInTheDocument());
    expect(screen.getByRole('main', { name: '愚者研习资料' })).toBe(detail);
    expect(scroll.scrollTop).toBe(240);
    expect(screen.getByPlaceholderText('在此记录你对这张牌的独特见解、私人感悟或研习心得...')).toHaveValue('保留我的独特见解');
    expect(detail.inert).toBe(false);
    expect(container.inert).toBe(true);
    await user.click(screen.getByRole('button', { name: '编辑这张牌义' }));
    expect(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...')).toHaveValue('稍后继续写');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('main', { name: '编辑牌义' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '返回（愚者研习资料）' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '愚者研习资料' })).not.toBeInTheDocument());
    expect(container.inert).toBeFalsy();
    await waitFor(() => expect(screen.getByRole('button', { name: '查看愚者研习资料' })).toHaveFocus());
  });

  it('keeps correspondence edits after save failure and guards leaving an unsaved page', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CardCorrespondenceEditor card={{ name: '愚者', isReversed: false }} metadata={{ id: 'ar00', name: '愚者', english: 'The Fool', astrology: { element: '风' } }} onClose={onClose} onUpdate={() => { throw new Error('full'); }} />);
    await user.type(screen.getByPlaceholderText('如：月亮、水星...'), '水星');
    await user.click(screen.getByRole('button', { name: '保存对应关系' }));
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败');
    expect(screen.getByPlaceholderText('如：月亮、水星...')).toHaveValue('水星');
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: '离开对应关系编辑' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '继续编辑' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText('如：月亮、水星...')).toHaveValue('水星');
  });

  it('keeps numerology input when local save or restore fails and returns to the same detail after saving', async () => {
    const user = userEvent.setup();
    render(<CardMetadataManager metadata={[]} onUpdate={vi.fn()} readings={[]} isLoggedIn={false} />);
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    const detail = screen.getByRole('main', { name: '愚者研习资料' });
    await user.click(screen.getByRole('button', { name: '编辑灵数注解' }));
    await user.type(screen.getByPlaceholderText('输入该灵数的象征意义...'), '新的开始');
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败');
    expect(screen.getByPlaceholderText('输入该灵数的象征意义...')).toHaveValue('新的开始');
    expect(detail.inert).toBe(true);
    storage.mockRestore();
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '灵数注解 · 愚者' })).not.toBeInTheDocument());
    expect(screen.getByRole('main', { name: '愚者研习资料' })).toBe(detail);
    expect(screen.getByText('新的开始')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '编辑灵数注解' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await user.click(screen.getByTitle('恢复默认'));
    await user.click(screen.getByRole('button', { name: '恢复' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('恢复失败');
    expect(screen.getByPlaceholderText('输入该灵数的象征意义...')).toHaveValue('新的开始');
  });

  it('locks numerology fields and Back until an in-flight cloud save completes', async () => {
    const user = userEvent.setup();
    vi.spyOn(firebaseData, 'getNumerologySetting').mockResolvedValue(null);
    let finish!: () => void;
    vi.spyOn(firebaseData, 'saveNumerologySetting').mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<CardMetadataManager metadata={[]} onUpdate={vi.fn()} readings={[]} isLoggedIn userId="page-test" />);
    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));
    await user.click(screen.getByRole('button', { name: '编辑灵数注解' }));
    await user.type(screen.getByPlaceholderText('输入该灵数的象征意义...'), '等待保存');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('button', { name: '返回（灵数注解 · 愚者）' })).toBeDisabled();
    expect(screen.getByPlaceholderText('输入该灵数的象征意义...')).toBeDisabled();
    act(() => { closeTopModal(); });
    expect(screen.getByRole('main', { name: '灵数注解 · 愚者' })).toBeInTheDocument();
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole('main', { name: '灵数注解 · 愚者' })).not.toBeInTheDocument());
    expect(screen.getByText('等待保存')).toBeInTheDocument();
  });
});
