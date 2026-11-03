import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_READINGS } from '../constants';
import { DailyFortuneArchiveModal } from './DailyFortuneArchiveModal';
import type { DailyFortune } from '../types';
import { downloadTextFile } from '../lib/downloadFile';

vi.mock('../lib/downloadFile', () => ({ downloadTextFile: vi.fn(), downloadBlobFile: vi.fn() }));

const reading = { ...INITIAL_READINGS[0], id: 'daily-reading', isExample: false, question: '日运手记的原问题',
  manualTags: ['日运', '学习'], cards: [{ name: '隐士', isReversed: true }, { name: '愚者', isReversed: false }],
  cardInterpretations: ['湖边散步', '重新开始'], userFeedback: '',
};
const props = () => ({ isOpen: true, onClose: vi.fn(), fortunes: [], readings: [reading], onUpdateReflection: vi.fn(), onSaveToCardAnnotation: vi.fn(), onDeleteFortunes: vi.fn(), onEditReading: vi.fn() });
const fortune: DailyFortune = { id: 'daily-draw', userId: 'guest', date: '2026-11-03', cardName: '隐士', isReversed: false, interpretation: '', keywords: [], createdAt: '2026-11-03T08:00:00.000Z', dailyReview: '今天给自己留了一点独处时间。' };

describe('combined daily archive', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
  it('opens daily handnotes when there are no system draws and preserves every card in the reader', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<DailyFortuneArchiveModal {...callbacks} />);
    expect(screen.getByRole('tab', { name: '日运手记 1' })).toHaveAttribute('aria-selected', 'true');
    await user.type(screen.getByRole('textbox', { name: '搜索日运手记' }), '湖边散步');
    await user.click(screen.getByRole('button', { name: /日运手记的原问题/ }));
    expect(screen.getByRole('main', { name: '手记回看' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '牌面与逐牌解读（2）' }));
    expect(screen.getByAltText('隐士')).toBeInTheDocument();
    expect(screen.getByAltText('愚者')).toBeInTheDocument();
    expect(screen.getByText('湖边散步')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('main', { name: '手记回看' })).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: '搜索日运手记' })).toHaveValue('湖边散步');
    expect(callbacks.onUpdateReflection).not.toHaveBeenCalled();
    expect(callbacks.onDeleteFortunes).not.toHaveBeenCalled();
  });
  it('filters reviewed handnotes and sends edits to the original reading, not the draw store', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<DailyFortuneArchiveModal {...callbacks} />);
    await user.click(screen.getByRole('button', { name: '已复盘' }));
    expect(screen.queryByRole('button', { name: /日运手记的原问题/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '待复盘' }));
    await user.click(screen.getByRole('button', { name: /日运手记的原问题/ }));
    await user.click(screen.getByRole('button', { name: '编辑手记' }));
    expect(callbacks.onEditReading).toHaveBeenCalledWith(reading);
    expect(callbacks.onUpdateReflection).not.toHaveBeenCalled();
  });
  it('retains source and search across close/reopen and excludes examples', async () => {
    const callbacks = props();
    const view = render(<DailyFortuneArchiveModal {...callbacks} />);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索日运手记' }), { target: { value: '隐士' } });
    view.rerender(<DailyFortuneArchiveModal {...callbacks} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('main', { name: '日运复盘' })).not.toBeInTheDocument());
    view.rerender(<DailyFortuneArchiveModal {...callbacks} readings={[reading, { ...reading, id: 'example', isExample: true }]} />);
    expect(screen.getByRole('textbox', { name: '搜索日运手记' })).toHaveValue('隐士');
    expect(screen.getByRole('tab', { name: '日运手记 1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('saves a handnote review in place without calling the draw reflection store', async () => {
    const user = userEvent.setup(); const callbacks = props(); const save = vi.fn(() => true);
    render(<DailyFortuneArchiveModal {...callbacks} ownerScope="user-a" onUpdateReadingFeedback={save} />);
    await user.click(screen.getByRole('button', { name: /日运手记的原问题/ }));
    await user.click(screen.getByRole('button', { name: '添加复盘' }));
    await user.type(screen.getByRole('textbox', { name: '后来发生了什么' }), '之后散步时想通了');
    await user.click(screen.getByRole('button', { name: '保存复盘' }));
    expect(save).toHaveBeenCalledWith(reading.id, '之后散步时想通了');
    expect(callbacks.onUpdateReflection).not.toHaveBeenCalled();
    expect(callbacks.onEditReading).not.toHaveBeenCalled();
    expect(screen.getByRole('main', { name: '手记回看' })).toBeInTheDocument();
  });

  it('shows a failed annotation save next to the unchanged record and permits retry', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    const save = vi.fn().mockImplementationOnce(() => { throw new Error('本机保存失败，请重试。'); });
    render(<DailyFortuneArchiveModal {...callbacks} readings={[]} fortunes={[fortune]} onSaveToCardAnnotation={save} />);
    await user.click(screen.getByRole('button', { name: '归入牌义注疏' }));
    expect(screen.getByRole('alert')).toHaveTextContent('本机保存失败，请重试。');
    expect(screen.getByRole('button', { name: '归入牌义注疏' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '已归入牌义注疏' })).not.toBeInTheDocument();
    expect(callbacks.onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '归入牌义注疏' }));
    expect(save).toHaveBeenNthCalledWith(2, fortune.id);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retains deletion selection, confirmation, and the page when local deletion fails', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    const remove = vi.fn().mockImplementationOnce(() => { throw new Error('本机删除失败，记录已保留。'); });
    render(<DailyFortuneArchiveModal {...callbacks} readings={[]} fortunes={[fortune]} onDeleteFortunes={remove} />);
    await user.click(screen.getByRole('button', { name: '整理' }));
    await user.click(screen.getByRole('button', { name: '选择 2026-11-03 日运记录' }));
    await user.click(screen.getByRole('button', { name: '删除选中 1 条日运记录' }));
    await user.click(within(screen.getByRole('dialog', { name: '删除日运记录' })).getByRole('button', { name: '删除' }));
    const dialog = screen.getByRole('dialog', { name: '删除日运记录' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('本机删除失败，记录已保留。');
    expect(screen.getByRole('button', { name: '删除选中 1 条日运记录' })).toBeEnabled();
    expect(callbacks.onClose).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: '删除' }));
    expect(remove).toHaveBeenNthCalledWith(2, [fortune.id]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '删除日运记录' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '整理' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: '日运复盘' })).toBeInTheDocument();
  });

  it('searches draw text, card aliases and dates, then clears the current search without modifying records', async () => {
    const user = userEvent.setup(); const callbacks = props();
    render(<DailyFortuneArchiveModal {...callbacks} readings={[]} fortunes={[fortune]} />);
    const search = screen.getByRole('textbox', { name: '搜索日运抽牌' });
    for (const query of ['独处时间', '隐者', '2026年11月3日']) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByText('2026-11-03 · 系统抽牌')).toBeInTheDocument();
    }
    fireEvent.change(search, { target: { value: '没有写过的内容' } });
    expect(screen.getByText('没有符合条件的日运')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清空日运抽牌查找' }));
    expect(search).toHaveValue('');
    expect(screen.getByText('2026-11-03 · 系统抽牌')).toBeInTheDocument();
    expect(callbacks.onUpdateReflection).not.toHaveBeenCalled();
    expect(callbacks.onDeleteFortunes).not.toHaveBeenCalled();
  });

  it('keeps a historical month, its text search, statistics and exported content in agreement', async () => {
    const user = userEvent.setup();
    const october = [
      { ...fortune, id: 'oct-early', date: '2026-10-03', createdAt: '2026-10-03T08:00:00Z', dailyReview: '面试之后想通了' },
      { ...fortune, id: 'oct-late', date: '2026-10-30', createdAt: '2026-10-30T08:00:00Z', isReversed: true, dailyReview: '月末休息' },
      { ...fortune, id: 'oct-sun', date: '2026-10-04', createdAt: '2026-10-04T08:00:00Z', cardName: '太阳', dailyReview: '' },
    ];
    render(<DailyFortuneArchiveModal {...props()} readings={[]} fortunes={[fortune, ...october]} />);
    await user.click(screen.getByRole('button', { name: '切换到按月日运' }));
    fireEvent.change(screen.getByLabelText('日运抽牌月份'), { target: { value: '2026-10' } });
    fireEvent.change(screen.getByRole('textbox', { name: '搜索日运抽牌' }), { target: { value: '隐者' } });
    expect(screen.getByText('2026-10 月度回看')).toBeInTheDocument();
    expect(screen.getByText('当前结果').parentElement).toHaveTextContent('2天');
    expect(screen.getByText('逆位比例').parentElement).toHaveTextContent('50%');
    expect(screen.getByText('记录', { exact: true }).parentElement).toHaveTextContent('2天');
    expect(screen.getByText('当前主题：隐士×2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '导出' }));
    await user.click(screen.getByRole('menuitem', { name: /^Markdown/ }));
    const exported = vi.mocked(downloadTextFile).mock.calls[0][1];
    expect(exported).toContain('2026-10-03');
    expect(exported).toContain('2026-10-30');
    expect(exported).not.toContain('2026-11-03');
    expect(exported).not.toContain('2026-10-04');

    fireEvent.change(screen.getByLabelText('日运抽牌日期'), { target: { value: '2026-10-30' } });
    expect(screen.getByText('当前结果').parentElement).toHaveTextContent('1天');
    expect(screen.getByText('逆位比例').parentElement).toHaveTextContent('100%');
    expect(screen.getByText('记录', { exact: true }).parentElement).toHaveTextContent('1天');
    await user.click(screen.getByRole('button', { name: '导出' }));
    await user.click(screen.getByRole('menuitem', { name: /^Markdown/ }));
    expect(vi.mocked(downloadTextFile).mock.calls[1][1]).toContain('2026-10-30');
    expect(vi.mocked(downloadTextFile).mock.calls[1][1]).not.toContain('2026-10-03');

    fireEvent.change(screen.getByLabelText('日运抽牌日期'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox', { name: '搜索日运抽牌' }), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: '筛选待回看日运记录' }));
    expect(screen.getByText('当前结果').parentElement).toHaveTextContent('1天');
    expect(screen.getByText('记录', { exact: true }).parentElement).toHaveTextContent('1天');
    expect(screen.getByText('当前主题：太阳×1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '导出' }));
    await user.click(screen.getByRole('menuitem', { name: /^Markdown/ }));
    expect(vi.mocked(downloadTextFile).mock.calls[2][1]).toContain('2026-10-04');
    expect(vi.mocked(downloadTextFile).mock.calls[2][1]).not.toContain('2026-10-30');
  });

  it('keeps each source query and date filter across source switches and close/reopen', async () => {
    const user = userEvent.setup(); const callbacks = props();
    const datedReading = { ...reading, readingDate: '2026-10-02', date: '2026-11-03T08:00:00Z' };
    const view = render(<DailyFortuneArchiveModal {...callbacks} fortunes={[fortune]} readings={[datedReading]} />);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索日运抽牌' }), { target: { value: '11/3' } });
    await user.click(screen.getByRole('button', { name: '按日期查找' }));
    fireEvent.change(screen.getByLabelText('日运抽牌日期'), { target: { value: '2026-11-03' } });
    await user.click(screen.getByRole('tab', { name: '日运手记 1' }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索日运手记' }), { target: { value: '湖边散步' } });
    await user.click(screen.getByRole('button', { name: '按日期查找' }));
    fireEvent.change(screen.getByLabelText('日运手记日期'), { target: { value: '2026-10-02' } });
    expect(screen.getByRole('button', { name: /2026-10-02.*日运手记的原问题/ })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '日运抽牌 1' }));
    expect(screen.getByRole('textbox', { name: '搜索日运抽牌' })).toHaveValue('11/3');
    expect(screen.getByLabelText('日运抽牌日期')).toHaveValue('2026-11-03');
    await user.click(screen.getByRole('tab', { name: '日运手记 1' }));
    view.rerender(<DailyFortuneArchiveModal {...callbacks} fortunes={[fortune]} readings={[datedReading]} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('main', { name: '日运复盘' })).not.toBeInTheDocument());
    view.rerender(<DailyFortuneArchiveModal {...callbacks} fortunes={[fortune]} readings={[datedReading]} />);
    expect(screen.getByRole('textbox', { name: '搜索日运手记' })).toHaveValue('湖边散步');
    expect(screen.getByLabelText('日运手记日期')).toHaveValue('2026-10-02');
    expect(screen.getByLabelText('日运手记月份')).toHaveValue('2026-10');
    await user.click(screen.getByRole('button', { name: '清空日运手记查找' }));
    expect(screen.getByLabelText('日运手记日期')).toHaveValue('');
    expect(screen.getByLabelText('日运手记月份')).toHaveValue('');
    await user.click(screen.getByRole('tab', { name: '日运抽牌 1' }));
    expect(screen.getByRole('textbox', { name: '搜索日运抽牌' })).toHaveValue('11/3');
  });
});
