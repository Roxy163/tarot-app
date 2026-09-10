import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicTab } from './PublicTab';
import { getPublicModerationSnapshot, getPublicReadings, reportPublicReading, updatePublicReadingModeration } from '../../lib/firebaseData';
import type { PublicReadingReport, TarotReading } from '../../types';

vi.mock('../../lib/firebaseData', () => ({
  getPublicReadings: vi.fn(),
  getPublicModerationSnapshot: vi.fn(),
  reportPublicReading: vi.fn(),
  updatePublicReadingModeration: vi.fn(),
}));

const createReading = (overrides: Partial<TarotReading> = {}): TarotReading => ({
  id: 'public-reading-1',
  userId: 'user-1',
  date: '2026-07-28T08:12:37.036Z',
  question: '缓存公开记录',
  spread: '单牌阵',
  cards: [{ name: '愚者', isReversed: false }],
  interpretation: { singleCard: '保持开放。', combination: '', summary: '' },
  keywords: [],
  isPublic: true,
  authorName: 'Roxy',
  isAnonymous: false,
  ...overrides,
});

describe('PublicTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getPublicReadings).mockReset();
    vi.mocked(getPublicModerationSnapshot).mockReset();
    vi.mocked(reportPublicReading).mockReset();
    vi.mocked(updatePublicReadingModeration).mockReset();
  });

  it('keeps cached public readings visible when cloud loading fails', async () => {
    localStorage.setItem('tarot_public_readings_cache_v1', JSON.stringify([createReading()]));
    vi.mocked(getPublicReadings).mockRejectedValueOnce(new Error('offline'));

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
      />,
    );

    expect(screen.getByText('缓存公开记录')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('云端读取慢，先展示上次保存的公开手记。')).toBeInTheDocument();
    });
  });

  it('builds card examples from public readings', async () => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([
      createReading({
        cards: [{ name: '圣杯七', isReversed: true }],
        cardInterpretations: ['选择太多时，先分清幻想和真正想要的东西。'],
        slotLabels: ['今日课题'],
        interpretation: { singleCard: '', combination: '', summary: '晚上复盘后更清楚。' },
      }),
    ]);

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: /牌例/ }));

    expect((await screen.findAllByText('圣杯七')).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 个位置/)).toBeInTheDocument();
    expect(screen.getByText('选择太多时，先分清幻想和真正想要的东西。')).toBeInTheDocument();
  });

  it('lets users collect a public spread into their spread library', async () => {
    const onCollectSpread = vi.fn();
    vi.mocked(getPublicReadings).mockResolvedValueOnce([
      createReading({
        question: '灵感牌阵案例',
        spread: '关系回声牌阵',
        cards: [
          { name: '愚者', isReversed: false },
          { name: '魔术师', isReversed: false },
        ],
        slotLabels: ['我看见的', '对方看见的'],
        slotPositions: ['col-start-1 row-start-1', 'col-start-2 row-start-1'],
        layoutType: 'custom',
      }),
    ]);

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        spreads={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
        onCollectSpread={onCollectSpread}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: /牌阵/ }));
    expect(await screen.findByText('关系回声牌阵')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /收进牌阵/ }));

    expect(onCollectSpread).toHaveBeenCalledWith(expect.objectContaining({
      name: '关系回声牌阵',
      layout: 'custom',
      slots: ['我看见的', '对方看见的'],
    }));
  });

  it('lets signed-in users report a public reading', async () => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading()]);
    vi.mocked(reportPublicReading).mockResolvedValueOnce();
    const onNotice = vi.fn();

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
        onNotice={onNotice}
        currentUserId="user-2"
      />,
    );

    expect(screen.queryByText('普通账号')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: '举报' }));
    await userEvent.click(screen.getByRole('button', { name: '隐私泄露' }));
    await userEvent.type(screen.getByPlaceholderText('哪里不合适？一句话就够。'), '里面有联系方式');
    await userEvent.click(screen.getByRole('button', { name: '提交举报' }));

    await waitFor(() => {
      expect(reportPublicReading).toHaveBeenCalledWith('public-reading-1', expect.objectContaining({
        userId: 'user-2',
        reason: 'privacy',
        note: '里面有联系方式',
      }));
    });
    expect(onNotice).toHaveBeenCalledWith('已收到举报，作者会在后台处理。');
  });

  it('shows moderation tools to the official moderator and can hide a reading', async () => {
    const reportedReading = createReading({ question: '需要处理的公开手记' });
    const report: PublicReadingReport = {
      id: 'user-2',
      readingId: reportedReading.id,
      userId: 'user-2',
      reason: 'spam',
      note: '像广告',
      createdAt: '2026-07-29T08:12:37.036Z',
    };
    vi.mocked(getPublicReadings).mockResolvedValueOnce([reportedReading]);
    vi.mocked(getPublicModerationSnapshot).mockResolvedValueOnce({
      readings: [reportedReading],
      reports: [report],
    });
    vi.mocked(updatePublicReadingModeration).mockResolvedValueOnce();

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
        currentUserId="admin-1"
        isModerator
      />,
    );

    expect(screen.getByText('作者账号')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /管理/ }));

    expect(await screen.findByText('需要处理的公开手记')).toBeInTheDocument();
    expect(screen.getByText('广告骚扰')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '从广场下架' }));

    await waitFor(() => {
      expect(updatePublicReadingModeration).toHaveBeenCalledWith('public-reading-1', 'hidden', 'admin-1');
    });
    expect(screen.getByRole('button', { name: '恢复公开' })).toBeInTheDocument();
  });
});
