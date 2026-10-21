import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_READINGS } from '../constants';
import { DailyFortuneArchiveModal } from './DailyFortuneArchiveModal';

const reading = { ...INITIAL_READINGS[0], id: 'daily-reading', isExample: false, question: '日运手记的原问题',
  manualTags: ['日运', '学习'], cards: [{ name: '隐士', isReversed: true }, { name: '愚者', isReversed: false }],
  cardInterpretations: ['湖边散步', '重新开始'], userFeedback: '',
};
const props = () => ({ isOpen: true, onClose: vi.fn(), fortunes: [], readings: [reading], onUpdateReflection: vi.fn(), onSaveToCardAnnotation: vi.fn(), onDeleteFortunes: vi.fn(), onEditReading: vi.fn() });

describe('combined daily archive', () => {
  beforeEach(() => localStorage.clear());
  it('opens daily handnotes when there are no system draws and preserves every card in the reader', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<DailyFortuneArchiveModal {...callbacks} />);
    expect(screen.getByRole('tab', { name: '日运手记 1' })).toHaveAttribute('aria-selected', 'true');
    await user.type(screen.getByRole('textbox', { name: '搜索日运手记' }), '湖边散步');
    await user.click(screen.getByRole('button', { name: /日运手记的原问题/ }));
    expect(screen.getByRole('main', { name: '手记详情' })).toBeInTheDocument();
    expect(screen.getAllByText('隐士').length).toBeGreaterThan(0);
    expect(screen.getAllByText('愚者').length).toBeGreaterThan(0);
    expect(screen.getByText('湖边散步')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('main', { name: '手记详情' })).not.toBeInTheDocument());
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
    await user.click(screen.getByRole('button', { name: '编辑' }));
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
});
