import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import { TarotReading } from '../../types';
import { PrivateTab } from './PrivateTab';

const createReading = (overrides: Partial<TarotReading>): TarotReading => ({
  id: 'reading-1',
  userId: 'user-1',
  date: '2026-07-03T08:00:00.000Z',
  question: '给自己的一次记录',
  spread: '单牌阵',
  cards: [{ name: '女祭司', isReversed: false }],
  interpretation: { singleCard: '倾听直觉。', combination: '', summary: '' },
  keywords: [],
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
  isForClient: false,
  ...overrides,
});

const renderPrivateTab = (
  readings: TarotReading[] = [],
  overrides: Partial<React.ComponentProps<typeof PrivateTab>> = {},
) => {
  const props = {
    readings,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    searchTags: [],
    onToggleTag: vi.fn(),
    onNavigate: vi.fn(),
    onTogglePublic: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onViewDetails: vi.fn(),
    onAuthorClick: vi.fn(),
    onProcessAi: vi.fn(),
    onExtractKeywordCandidates: vi.fn(),
    onConfirmKeywordCandidates: vi.fn(),
    cardMetadata: [],
    highlightedReadingId: null as string | null,
    ...overrides,
  };

  render(<PrivateTab {...props} />);
  return props;
};

describe('PrivateTab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters client readings by client nickname', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({ id: 'self-reading', question: '自己的记录' }),
      createReading({
        id: 'client-reading',
        question: '客户的问题',
        isForClient: true,
        clientName: '小林',
      }),
    ]);

    expect(screen.getByText('给自己')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客户记录' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '小林' }));

    expect(screen.getByText('客户的问题')).toBeInTheDocument();
    expect(screen.queryByText('自己的记录')).not.toBeInTheDocument();
    expect(screen.getByText('客户: 小林')).toBeInTheDocument();
  });

  it('keeps daily review out of the private archive header', () => {
    renderPrivateTab([]);

    expect(screen.queryByText('日运复盘')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('🔍 搜索记录...')).toBeInTheDocument();
  });

  it('marks the saved reading as highlighted when opening the private archive', () => {
    const reading = createReading({ id: 'new-reading', question: '刚刚保存的记录' });
    renderPrivateTab([reading], { highlightedReadingId: 'new-reading' });

    expect(screen.getByText('刚刚保存的记录').closest('[data-highlighted-reading="true"]')).toBeInTheDocument();
  });
});
