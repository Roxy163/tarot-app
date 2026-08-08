import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import { useState } from 'react';
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

    await user.click(screen.getByRole('button', { name: /筛选/ }));

    await user.click(screen.getByRole('button', { name: '小林' }));

    expect(screen.getByText('客户的问题')).toBeInTheDocument();
    expect(screen.queryByText('自己的记录')).not.toBeInTheDocument();
    expect(screen.getByText('客户: 小林')).toBeInTheDocument();
  });

  it('filters the archive by tags from the compact filter menu', async () => {
    const user = userEvent.setup();
    const readings = [
      createReading({ id: 'career-reading', question: '职业复盘', category: '职业、推进', keywords: ['AI词'] }),
      createReading({ id: 'love-reading', question: '感情复盘', manualTags: ['感情'], keywords: ['AI感情词'] }),
    ];

    const StatefulPrivateTab = () => {
      const [tags, setTags] = useState<string[]>([]);

      return (
        <PrivateTab
          readings={readings}
          searchQuery=""
          setSearchQuery={vi.fn()}
          searchTags={tags}
          onToggleTag={(tag) => {
            setTags(prev => (prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag]));
          }}
          onNavigate={vi.fn()}
          onTogglePublic={vi.fn()}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
          onViewDetails={vi.fn()}
          onAuthorClick={vi.fn()}
          onProcessAi={vi.fn()}
          onExtractKeywordCandidates={vi.fn()}
          onConfirmKeywordCandidates={vi.fn()}
          cardMetadata={[]}
        />
      );
    };

    render(<StatefulPrivateTab />);

    await user.click(screen.getByRole('button', { name: /筛选/ }));
    await user.click(screen.getByRole('button', { name: '按标签复盘：职业' }));

    expect(screen.getByText('职业复盘')).toBeInTheDocument();
    expect(screen.queryByText('感情复盘')).not.toBeInTheDocument();
    expect(screen.getByText('标签: 职业')).toBeInTheDocument();
  });

  it('does not use AI keywords as tag review options', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({ id: 'ai-reading', question: 'AI 关键词记录', category: '用户标签', keywords: ['AI生成词'] }),
    ]);

    await user.click(screen.getByRole('button', { name: /筛选/ }));

    expect(screen.getByRole('button', { name: '按标签复盘：用户标签' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '按标签复盘：AI生成词' })).not.toBeInTheDocument();
  });

  it('opens the archive index and filters records by card', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({
        id: 'career-choice',
        question: '三个月内要不要辞职？',
        spread: '选择牌阵',
        cards: [{ name: '战车', isReversed: true }],
      }),
      createReading({
        id: 'relationship',
        question: '关系要如何推进？',
        spread: '单牌阵',
        cards: [{ name: '圣杯二', isReversed: false }],
      }),
    ]);

    await user.click(screen.getByRole('button', { name: '典籍索引' }));
    const panel = screen.getByRole('dialog', { name: '典籍索引' });

    await user.click(within(panel).getByRole('button', { name: '按牌索引：战车' }));

    expect(screen.getByText('三个月内要不要辞职？')).toBeInTheDocument();
    expect(screen.queryByText('关系要如何推进？')).not.toBeInTheDocument();
    expect(screen.getByText('战车出现过的记录')).toBeInTheDocument();
  });

  it('filters archive records by spread and user-written tag from the index', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({
        id: 'choice',
        question: '工作选择记录',
        spread: '选择牌阵',
        manualTags: ['工作'],
        keywords: ['AI生成词'],
      }),
      createReading({
        id: 'daily',
        question: '日常状态记录',
        spread: '单牌阵',
        manualTags: ['情绪'],
      }),
    ]);

    await user.click(screen.getByRole('button', { name: '典籍索引' }));
    let panel = screen.getByRole('dialog', { name: '典籍索引' });
    await user.click(within(panel).getByRole('button', { name: '牌阵' }));
    await user.click(within(panel).getByRole('button', { name: '按牌阵索引：选择牌阵' }));

    expect(screen.getByText('工作选择记录')).toBeInTheDocument();
    expect(screen.queryByText('日常状态记录')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除全部' }));
    await user.click(screen.getByRole('button', { name: '典籍索引' }));
    panel = screen.getByRole('dialog', { name: '典籍索引' });
    await user.click(within(panel).getByRole('button', { name: '标签' }));

    expect(within(panel).getByRole('button', { name: '按标签索引：工作' })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '按标签索引：AI生成词' })).not.toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: '按标签索引：情绪' }));

    expect(screen.queryByText('工作选择记录')).not.toBeInTheDocument();
    expect(screen.getByText('日常状态记录')).toBeInTheDocument();
    expect(screen.getByText('标签「情绪」')).toBeInTheDocument();
  });

  it('filters archive records by question keyword from the index', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({ id: 'resign', question: '三个月内要不要辞职？' }),
      createReading({ id: 'relationship', question: '关系要如何推进？' }),
    ]);

    await user.click(screen.getByRole('button', { name: '典籍索引' }));
    const panel = screen.getByRole('dialog', { name: '典籍索引' });
    await user.click(within(panel).getByRole('button', { name: '问题' }));
    await user.type(within(panel).getByPlaceholderText('输入问题关键词...'), '辞职');
    await user.click(within(panel).getByRole('button', { name: '查看' }));

    expect(screen.getByText('三个月内要不要辞职？')).toBeInTheDocument();
    expect(screen.queryByText('关系要如何推进？')).not.toBeInTheDocument();
    expect(screen.getByText('问题包含「辞职」')).toBeInTheDocument();
  });

  it('closes the compact filter menu when clicking outside', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({ id: 'tagged-reading', question: '带标签记录', category: '职业' }),
    ]);

    await user.click(screen.getByRole('button', { name: /筛选/ }));
    expect(screen.getByText('标签复盘')).toBeInTheDocument();

    await user.click(screen.getByText('阁中典籍'));

    expect(screen.queryByText('标签复盘')).not.toBeInTheDocument();
  });

  it('keeps daily review out of the private archive header', () => {
    renderPrivateTab([]);

    expect(screen.queryByText('日运复盘')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索记录...')).toBeInTheDocument();
  });

  it('marks the saved reading as highlighted when opening the private archive', () => {
    const reading = createReading({ id: 'new-reading', question: '刚刚保存的记录' });
    renderPrivateTab([reading], { highlightedReadingId: 'new-reading' });

    expect(screen.getByText('刚刚保存的记录').closest('[data-highlighted-reading="true"]')).toBeInTheDocument();
  });

  it('exports selected unreviewed readings from the compact toolbar', async () => {
    renderPrivateTab([
      createReading({ id: 'reviewed-reading', userFeedback: '已经补了复盘。' }),
      createReading({ id: 'unreviewed-reading', question: '还没复盘', userFeedback: '' }),
    ], { ownerName: '阿若' });

    expect(screen.queryByText('当前复盘')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '导出' })).not.toBeInTheDocument();
    expect(screen.queryByText('已选 0 / 当前 2')).not.toBeInTheDocument();
    expect(screen.queryByText('长按记录进入多选，可批量导出。')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '选择记录：还没复盘' })).not.toBeInTheDocument();

    const unreviewedCard = screen
      .getByText('还没复盘')
      .closest('[data-reading-selection-target="true"]');
    expect(unreviewedCard).toBeInTheDocument();

    fireEvent.pointerDown(unreviewedCard!);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 560));
    });
    fireEvent.pointerUp(unreviewedCard!);

    expect(screen.getByText('已选 1 / 当前 2')).toBeInTheDocument();
    expect(screen.getByText('长按记录进入多选，可批量导出。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全选当前' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '导出1' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '导出1' }));
    expect(screen.getByRole('button', { name: '导出PDF' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '导出表格' })).toBeEnabled();
  });

  it('enters selection mode from the desktop multi-select button', async () => {
    const user = userEvent.setup();
    renderPrivateTab([
      createReading({ id: 'first-reading', question: '第一条记录' }),
      createReading({ id: 'second-reading', question: '第二条记录' }),
    ], { ownerName: '阿若' });

    await user.click(screen.getByRole('button', { name: '多选' }));

    expect(screen.getByText('已选 0 / 当前 2')).toBeInTheDocument();
    expect(screen.getByText('长按记录进入多选，可批量导出。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全选当前' }));

    expect(screen.getByText('已选 2 / 当前 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出2' })).toBeEnabled();
  });

  it('keeps delete hidden until users enter selection mode', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderPrivateTab([
      createReading({ id: 'first-reading', question: '第一条记录' }),
      createReading({ id: 'second-reading', question: '第二条记录' }),
    ], { onDelete });

    expect(screen.queryByRole('button', { name: '删除手记' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除所选' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '多选' }));
    await user.click(screen.getByRole('button', { name: '全选当前' }));

    expect(screen.queryByRole('button', { name: '删除手记' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除所选' }));
    expect(screen.getByRole('dialog', { name: '删除所选手记' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledWith('first-reading');
    expect(onDelete).toHaveBeenCalledWith('second-reading');
  });

  it('hides examples once real records exist and shows newest records first', () => {
    renderPrivateTab([
      createReading({
        id: 'example-reading',
        question: '示例问题',
        isExample: true,
        updatedAt: '2099-01-01T00:00:00.000Z',
      }),
      createReading({
        id: 'older-reading',
        question: '旧记录',
        updatedAt: '2026-07-01T00:00:00.000Z',
      }),
      createReading({
        id: 'newer-reading',
        question: '新记录',
        updatedAt: '2026-07-06T00:00:00.000Z',
      }),
    ]);

    expect(screen.queryByText('示例问题')).not.toBeInTheDocument();

    const cards = screen.getAllByText(/新记录|旧记录/).map(item => item.textContent);
    expect(cards).toEqual(['新记录', '旧记录']);
  });
});
