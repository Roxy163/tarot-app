import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicTab } from './PublicTab';
import { getPublicModerationSnapshot, getPublicReadings, reportPublicReading, updatePublicReadingModeration, getPublicReadingLike, setPublicReadingLike } from '../../lib/firebaseData';
import type { PublicReadingReport, TarotReading } from '../../types';

vi.mock('../../lib/firebaseData', () => ({
  getPublicReadings: vi.fn(),
  getPublicModerationSnapshot: vi.fn(),
  reportPublicReading: vi.fn(),
  updatePublicReadingModeration: vi.fn(),
  getPublicReadingLike: vi.fn(),
  setPublicReadingLike: vi.fn(),
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
    vi.mocked(getPublicReadingLike).mockReset().mockResolvedValue({ count: 0, liked: false });
    vi.mocked(setPublicReadingLike).mockReset();
  });

  it.each([false, true])('opens the full public reading with moderator=%s without private fields or editing', async (isModerator) => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading({
      question: '可以打开的长案例',
      interpretation: { singleCard: '牌面的原始观察', combination: '完整综合解读\n第二段保留换行', summary: '完整总结' },
      cardInterpretations: ['完整逐牌解读'], cardQuestions: ['公开牌面疑问'],
      isForClient: true, clientName: '私人客户姓名', clientFeedback: '私人客户反馈',
      userFeedback: '私人复盘', aiAnswer: '私人 AI 记录',
      isAnonymous: true, authorName: '不该出现的真名',
    })]);
    render(<PublicTab readings={[]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} isModerator={isModerator} currentUserId="viewer" />);
    await userEvent.click(await screen.findByRole('button', { name: '查看手记：可以打开的长案例' }));
    const dialog = screen.getByRole('dialog', { name: '可以打开的长案例' });
    expect(within(dialog).getByText(/完整综合解读/)).toHaveTextContent('第二段保留换行');
    expect(within(dialog).getByText('完整逐牌解读')).toBeInTheDocument();
    expect(within(dialog).getByText('完整总结')).toBeInTheDocument();
    expect(within(dialog).getByText(/公开牌面疑问/)).toBeInTheDocument();
    for (const text of ['私人客户姓名', '私人客户反馈', '私人复盘', '私人 AI 记录', '不该出现的真名']) expect(within(dialog).queryByText(text, { exact: false })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看手记：可以打开的长案例' })).toHaveFocus();
  });

  it('opens card examples directly and keeps filtering behind its entry', async () => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading({ manualTags: ['日运'], cardInterpretations: ['详细牌例内容'] })]);
    render(<PublicTab readings={[]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} />);
    await screen.findByText('缓存公开记录');
    expect(screen.queryByRole('button', { name: '全部标签' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '收藏研习' }));
    await userEvent.click(screen.getByRole('button', { name: '筛选手记' }));
    const filter = screen.getByRole('dialog', { name: '筛选手记' });
    await userEvent.click(within(filter).getByRole('button', { name: '收藏' }));
    await userEvent.click(within(filter).getByRole('button', { name: '查看结果' }));
    expect(screen.getByText('缓存公开记录')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '牌例' }));
    await userEvent.click(screen.getByText('详细牌例内容'));
    expect(screen.getByRole('dialog', { name: '缓存公开记录' })).toBeInTheDocument();
  });

  it('persists likes and supports cancelling without opening the reading', async () => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading()]);
    vi.mocked(getPublicReadingLike).mockResolvedValue({ count: 3, liked: false });
    vi.mocked(setPublicReadingLike).mockResolvedValueOnce({ count: 4, liked: true });
    render(<PublicTab readings={[]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} currentUserId="viewer" />);
    await userEvent.click(await screen.findByRole('button', { name: '点赞' }));
    expect(await screen.findByRole('button', { name: '取消点赞' })).toHaveAttribute('aria-pressed', 'true');
    expect(setPublicReadingLike).toHaveBeenCalledWith('public-reading-1', 'viewer', true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.mocked(getPublicReadingLike).mockResolvedValue({ count: 4, liked: true });
    vi.mocked(setPublicReadingLike).mockResolvedValueOnce({ count: 3, liked: false });
    await userEvent.click(screen.getByRole('button', { name: '取消点赞' }));
    expect(await screen.findByRole('button', { name: '点赞' })).toHaveAttribute('aria-pressed', 'false');
    expect(setPublicReadingLike).toHaveBeenLastCalledWith('public-reading-1', 'viewer', false);
  });

  it('does not show a successful like when saving fails', async () => {
    const notice = vi.fn();
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading()]);
    vi.mocked(setPublicReadingLike).mockRejectedValueOnce(new Error('offline'));
    render(<PublicTab readings={[]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} currentUserId="viewer" onNotice={notice} />);
    await userEvent.click(await screen.findByRole('button', { name: '点赞' }));
    await waitFor(() => expect(notice).toHaveBeenCalledWith('点赞暂时未能保存，请稍后再试。'));
    expect(screen.getByRole('button', { name: '点赞' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks guests to log in before writing a like', async () => {
    const login = vi.fn();
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading()]);
    render(<PublicTab readings={[]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} onLoginRequest={login} />);
    await userEvent.click(await screen.findByRole('button', { name: '点赞' }));
    expect(login).toHaveBeenCalledTimes(1);
    expect(setPublicReadingLike).not.toHaveBeenCalled();
  });

  it('keeps the bookmark unchanged when local storage is full', async () => {
    const notice = vi.fn();
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading()]);
    render(<PublicTab readings={[]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} onNotice={notice} />);
    const bookmark = await screen.findByRole('button', { name: '收藏研习' });
    const original = Storage.prototype.setItem;
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'tarot_public_reading_collection_v1') throw new Error('quota exceeded');
      return original.call(this, key, value);
    });
    try {
      await userEvent.click(bookmark);
      expect(bookmark).toHaveAttribute('aria-pressed', 'false');
      expect(notice).toHaveBeenCalledWith('收藏未能保存在本机，请稍后再试。');
      expect(localStorage.getItem('tarot_public_reading_collection_v1')).toBeNull();
    } finally { storage.mockRestore(); }
  });

  it('does not mix built-in practice examples into real public shares', async () => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading(), createReading({ id: 'cloud-example', question: '云端练习示例', isExample: true })]);
    render(<PublicTab readings={[createReading({ id: 'local-example', question: '本机练习示例', isExample: true })]} cardMetadata={[]} onTagClick={vi.fn()} onAuthorClick={vi.fn()} onProcessAi={vi.fn()} />);
    await screen.findByRole('button', { name: '查看手记：缓存公开记录' });
    expect(screen.queryByText('本机练习示例')).not.toBeInTheDocument();
    expect(screen.queryByText('云端练习示例')).not.toBeInTheDocument();
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

    await userEvent.click(await screen.findByRole('button', { name: '更多案例操作' }));
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

    expect(screen.queryByText('作者账号')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '管理' }));

    expect(await screen.findByText('需要处理的公开手记')).toBeInTheDocument();
    expect(screen.getByText('广告骚扰')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '从广场下架' }));

    await waitFor(() => {
      expect(updatePublicReadingModeration).toHaveBeenCalledWith('public-reading-1', 'hidden', 'admin-1');
    });
    expect(screen.getByRole('button', { name: '恢复公开' })).toBeInTheDocument();
  });

  it('can open the moderation view from an outside request', async () => {
    const reportedReading = createReading({ question: '侧边栏直达管理' });
    const report: PublicReadingReport = {
      id: 'user-3',
      readingId: reportedReading.id,
      userId: 'user-3',
      reason: 'privacy',
      note: '疑似泄露隐私',
      createdAt: '2026-07-30T08:12:37.036Z',
    };
    vi.mocked(getPublicReadings).mockResolvedValueOnce([reportedReading]);
    vi.mocked(getPublicModerationSnapshot).mockResolvedValueOnce({
      readings: [reportedReading],
      reports: [report],
    });

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
        currentUserId="admin-1"
        isModerator
        requestedView="moderation"
        viewRequestKey={1}
      />,
    );

    expect(screen.getByRole('button', { name: '管理' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('侧边栏直达管理')).toBeInTheDocument();
    expect(screen.getByText('隐私泄露')).toBeInTheDocument();
  });

  it('returns to public readings when the ordinary square entry is requested again', async () => {
    vi.mocked(getPublicReadings).mockResolvedValueOnce([createReading()]);
    vi.mocked(getPublicModerationSnapshot).mockResolvedValueOnce({ readings: [], reports: [] });

    const props = {
      readings: [] as TarotReading[],
      cardMetadata: [],
      onTagClick: vi.fn(),
      onAuthorClick: vi.fn(),
      onProcessAi: vi.fn(),
      currentUserId: 'admin-1',
      isModerator: true,
    };
    const { rerender } = render(<PublicTab {...props} requestedView="moderation" viewRequestKey={1} />);

    expect(screen.getByRole('button', { name: '管理' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<PublicTab {...props} requestedView="readings" viewRequestKey={2} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /手记/ })).toHaveAttribute('aria-selected', 'true');
    });
  });
});
