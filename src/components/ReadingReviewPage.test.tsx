import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingDetailModal } from './ReadingDetailModal';
import { clearAccountDrafts, readLocalDraft, resetDraftMemory } from '../hooks/useLocalDraft';
import type { TarotReading } from '../types';

const reading: TarotReading = { id: 'review-1', userId: 'user-a', date: '2026-11-02', question: '这次沟通怎么样？', spread: '单牌阵', cards: [{ name: '隐士', isReversed: true }], cardInterpretations: [''], interpretation: { singleCard: '先整理好要说的话。', combination: '', summary: '' }, keywords: [], isPublic: false, isAnonymous: false, authorName: 'Roxy', aiAnswer: '很长的 AI 参照文字' };
const renderReview = (overrides: Partial<React.ComponentProps<typeof ReadingDetailModal>> = {}) => render(<ReadingDetailModal reading={reading} ownerScope="user-a" onClose={vi.fn()} onSaveFeedback={vi.fn(() => true)} {...overrides} />);

describe('reading review', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); resetDraftMemory(); });

  it('opens a full page focused on thoughts without checklists or empty note rows', () => {
    renderReview();
    expect(screen.getByRole('heading', { name: '手记回看' })).toBeInTheDocument();
    expect(screen.getByText('先整理好要说的话。')).toBeInTheDocument();
    expect(screen.queryByText('学习闭环')).not.toBeInTheDocument();
    expect(screen.queryByText('待复盘')).not.toBeInTheDocument();
    expect(screen.queryByText('还没有填写这张牌的解读。')).not.toBeInTheDocument();
    expect(screen.queryByText('很长的 AI 参照文字')).not.toBeInTheDocument();
  });

  it('saves only the feedback and remains in the same reading', async () => {
    const user = userEvent.setup(); const save = vi.fn(() => true); const close = vi.fn();
    renderReview({ onSaveFeedback: save, onClose: close });
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    await user.type(screen.getByRole('textbox', { name: '后来发生了什么' }), '后来聊开了，没那么紧张。');
    await user.click(screen.getByRole('button', { name: '保存复盘' }));
    expect(save).toHaveBeenCalledWith('review-1', '后来聊开了，没那么紧张。');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText('后来聊开了，没那么紧张。')).toBeInTheDocument();
    expect(readLocalDraft('tarot_reading_review_draft_user-a_review-1')).toBeNull();
    expect(reading.userFeedback).toBeUndefined();
  });

  it('shows the current single-card thought first while retaining legacy notes in extra records', async () => {
    const user = userEvent.setup();
    renderReview({ reading: { ...reading, cardInterpretations: ['刚修改的单牌想法'], interpretation: { singleCard: '刚修改的单牌想法', combination: '保留的旧组合笔记', summary: '保留的旧总结' } } });
    expect(screen.getByText('刚修改的单牌想法')).toBeInTheDocument();
    expect(screen.queryByText('保留的旧组合笔记')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '补充记录' }));
    expect(screen.getByText('保留的旧组合笔记')).toBeInTheDocument();
    expect(screen.getByText('保留的旧总结')).toBeInTheDocument();
  });

  it('preserves a failed save for retry and after remounting', async () => {
    const user = userEvent.setup(); const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const first = renderReview({ onSaveFeedback: save });
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    await user.type(screen.getByRole('textbox', { name: '后来发生了什么' }), '不能丢失的复盘');
    await user.click(screen.getByRole('button', { name: '保存复盘' }));
    expect(screen.getByRole('textbox', { name: '后来发生了什么' })).toHaveValue('不能丢失的复盘');
    expect(screen.getByText(/本机保存失败/)).toBeInTheDocument();
    first.unmount(); resetDraftMemory(); renderReview({ onSaveFeedback: save });
    expect(screen.getByRole('textbox', { name: '后来发生了什么' })).toHaveValue('不能丢失的复盘');
    await user.click(screen.getByRole('button', { name: '保存复盘' }));
    expect(screen.getByText('不能丢失的复盘')).toBeInTheDocument();
  });

  it('blocks Back and duplicate submission while saving', async () => {
    const user = userEvent.setup(); let finish!: (value: boolean) => void;
    const save = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; })); const close = vi.fn();
    renderReview({ onSaveFeedback: save, onClose: close });
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    await user.type(screen.getByRole('textbox', { name: '后来发生了什么' }), '提交中的文字');
    await user.click(screen.getByRole('button', { name: '保存复盘' }));
    expect(screen.getByRole('button', { name: '返回（手记回看）' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(close).not.toHaveBeenCalled(); expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { finish(true); });
    await waitFor(() => expect(screen.getByRole('button', { name: '返回（手记回看）' })).toBeEnabled());
  });

  it('isolates drafts by account and clears them on logout', async () => {
    const user = userEvent.setup(); const first = renderReview();
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    await user.type(screen.getByRole('textbox', { name: '后来发生了什么' }), 'A 的私人复盘');
    first.unmount(); renderReview({ ownerScope: 'user-b' });
    expect(screen.queryByDisplayValue('A 的私人复盘')).not.toBeInTheDocument();
    clearAccountDrafts('user-a');
    expect(readLocalDraft('tarot_reading_review_draft_user-a_review-1')).toBeNull();
  });

  it('does not expose private feedback or draft controls in public view', () => {
    renderReview({ reading: { ...reading, userFeedback: '私密的后续经历', clientName: '私密客户' }, isPublicView: true });
    expect(screen.queryByText('私密的后续经历')).not.toBeInTheDocument();
    expect(screen.queryByText('私密客户')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加复盘' })).not.toBeInTheDocument();
  });

  it('does not resurrect a review draft after reverting to the saved text', async () => {
    const user = userEvent.setup(); const close = vi.fn(); const first = renderReview({ onClose: close });
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    const textbox = screen.getByRole('textbox', { name: '后来发生了什么' });
    await user.type(textbox, '稍后删除'); await user.clear(textbox);
    await user.click(screen.getByRole('button', { name: '返回（手记回看）' }));
    expect(close).toHaveBeenCalled(); first.unmount(); resetDraftMemory(); renderReview();
    expect(screen.queryByRole('textbox', { name: '后来发生了什么' })).not.toBeInTheDocument();
  });

  it('requires an explicit leave confirmation if the draft cannot be saved locally', async () => {
    const user = userEvent.setup(); const close = vi.fn(); renderReview({ onClose: close });
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    const original = Storage.prototype.setItem;
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) { if (key.startsWith('tarot_reading_review_draft_')) throw new Error('full'); original.call(this, key, value); });
    try {
      await user.type(screen.getByRole('textbox', { name: '后来发生了什么' }), '本机暂存不了的文字');
      await user.click(screen.getByRole('button', { name: '返回（手记回看）' }));
      expect(screen.getByRole('dialog', { name: '草稿尚未保存' })).toBeInTheDocument();
      expect(close).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: '继续填写' }));
      expect(screen.getByRole('textbox', { name: '后来发生了什么' })).toHaveValue('本机暂存不了的文字');
    } finally { failing.mockRestore(); }
  });
});
