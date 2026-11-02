import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ReadingDetailView } from './ReadingDetailView';

const baseProps = {
  activeSlotIndex: 0,
  cardSlots: [
    { name: '愚者', isReversed: false, label: '主牌' },
  ],
  cardMetadata: [],
  cardInterpretations: [''],
  cardQuestions: [''],
  isLoggedIn: false,
  isMultiCard: false,
  isDailyMode: false,
  onToggleReverse: vi.fn(),
  onSetCardInterpretations: vi.fn(),
  onSetCardQuestions: vi.fn(),
  onSetActiveSlotIndex: vi.fn(),
  onSetShowPicker: vi.fn(),
};

describe('ReadingDetailView', () => {
  it('keeps the selected-card editor compact while preserving core actions', async () => {
    const user = userEvent.setup();
    render(<ReadingDetailView {...baseProps} />);

    const noteBox = screen.getByPlaceholderText('记录关于“主牌”的直觉与洞察...');
    const detailPanel = noteBox.closest('.grid');

    expect(detailPanel).toHaveClass('grid-cols-[5rem_minmax(0,1fr)]');
    expect(screen.getByAltText('愚者')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '随机换牌' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切换为逆位' })).toHaveTextContent('切为逆位');
    expect(screen.getByRole('button', { name: '重新选牌' })).toBeInTheDocument();
    expect(noteBox).toBeInTheDocument();
    expect(screen.queryByLabelText('牌面疑问：主牌')).not.toBeInTheDocument();
    expect(screen.queryByText('行星: 天王星')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '添加疑问' }));
    expect(screen.getByLabelText('牌面疑问：主牌')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '牌面对应' }));
    expect(screen.getByText(/元素:/)).toBeInTheDocument();
  });
});
