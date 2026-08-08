import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  onUpdateCardSlotsWithHistory: vi.fn(),
};

describe('ReadingDetailView', () => {
  it('keeps the selected-card editor compact while preserving core actions', () => {
    render(<ReadingDetailView {...baseProps} />);

    const noteBox = screen.getByPlaceholderText('记录关于“主牌”的直觉与洞察...');
    const detailPanel = noteBox.closest('.grid');

    expect(detailPanel).toHaveClass('grid-cols-[5rem_minmax(0,1fr)]');
    expect(screen.getByAltText('愚者')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '随机换牌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '正逆位' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新选牌' })).toBeInTheDocument();
    expect(noteBox).toBeInTheDocument();
    expect(screen.getByLabelText('牌面疑问：主牌')).toBeInTheDocument();
  });
});
