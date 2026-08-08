import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyFortune } from '../types';
import { DailyFortuneCard } from './DailyFortuneCard';

const baseFortune: DailyFortune = {
  id: 'fortune-1',
  userId: 'local',
  date: '2026-07-02',
  cardName: '女祭司',
  isReversed: false,
  interpretation: '信任你的直觉，内心深处的智慧正在指引你。',
  keywords: ['女祭司', '正位'],
  source: 'app-draw',
  createdAt: '2026-07-02T08:00:00.000Z',
  isRevealed: true,
};

const defaultProps = {
  fortune: null,
  fortunes: [],
  onGenerateWithNumber: vi.fn(),
  onCreateFromCard: vi.fn(),
  onUpdateCard: vi.fn(),
  onArchive: vi.fn(),
  onUpdateReflection: vi.fn(),
  onSaveToCardAnnotation: vi.fn(),
};

const renderCard = (props: Partial<React.ComponentProps<typeof DailyFortuneCard>> = {}) => {
  const mergedProps = {
    ...defaultProps,
    ...props,
  };

  render(<DailyFortuneCard {...mergedProps} />);

  return mergedProps;
};

describe('DailyFortuneCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('offers physical card entry before a fortune exists', async () => {
    const user = userEvent.setup();
    const props = renderCard();

    expect(screen.getByText('今日单牌练习')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '洗牌' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '从洗好的牌组随机一张' })).not.toBeInTheDocument();
    expect(screen.getByText('现实牌')).toBeInTheDocument();
    expect(screen.getByText('洗牌后可输入数字或随机一张，也能用来抽查牌义。')).toBeInTheDocument();

    await user.click(screen.getByText('现实牌'));
    expect(screen.getByRole('heading', { name: '选择现实中抽到的牌' })).toBeInTheDocument();

    await user.click(screen.getByText('愚者'));
    expect(props.onCreateFromCard).toHaveBeenCalledWith('ar00', false, 'physical-draw');
  });

  it('shows random draw only after shuffling the daily deck', async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByRole('button', { name: '洗牌' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '从洗好的牌组随机一张' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '洗牌' }));
    expect(await screen.findByRole('heading', { name: '选择今日日运牌' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从洗好的牌组随机一张' })).toBeInTheDocument();
  });

  it('archives a revealed daily fortune with split reflection fields', async () => {
    const user = userEvent.setup();
    const props = renderCard({ fortune: baseFortune, fortunes: [baseFortune] });

    expect(screen.getByText('今天这张牌，先看见了什么？')).toBeInTheDocument();
    expect(screen.getByText('还没写下今天的第一眼感受。可以先记一点，晚上再回看。')).toBeInTheDocument();
    expect(screen.queryByText('今日回看')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '记录日运手札' }));
    await user.type(screen.getByLabelText('第一直觉'), '保持安静观察。');
    await user.type(screen.getByLabelText('今日回看'), '晚上对应到一次真实判断。');
    await user.click(screen.getByRole('button', { name: '保存到日运复盘' }));

    expect(props.onArchive).toHaveBeenCalledWith(baseFortune.id, {
      initialImpression: '保持安静观察。',
      dailyReview: '晚上对应到一次真实判断。',
    });
  });

  it('offers a low-pressure shortcut when no daily match is visible', async () => {
    const user = userEvent.setup();
    const props = renderCard({ fortune: baseFortune, fortunes: [baseFortune] });

    await user.click(screen.getByRole('button', { name: '记录日运手札' }));
    await user.click(screen.getByRole('button', { name: '今天暂未看见明显对应' }));
    await user.click(screen.getByRole('button', { name: '保存到日运复盘' }));

    expect(props.onArchive).toHaveBeenCalledWith(baseFortune.id, {
      initialImpression: '',
      dailyReview: '今天暂未看见明显对应',
    });
  });

  it('shows archived status and opens the daily archive zone', async () => {
    const user = userEvent.setup();
    const archivedFortune: DailyFortune = {
      ...baseFortune,
      archivedAt: '2026-07-02T09:00:00.000Z',
      reflection: '晚上对应到一次真实的直觉判断。',
      source: 'physical-draw',
    };

    renderCard({ fortune: archivedFortune, fortunes: [archivedFortune] });

    expect(screen.getByText('已归档')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续补写' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开日运复盘' }));
    expect(screen.getByRole('dialog', { name: '日运复盘' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /时间线/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /按牌/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /本月/ })).toBeInTheDocument();
    expect(screen.getByText('现实抽牌')).toBeInTheDocument();
    expect(screen.getAllByText('晚上对应到一次真实的直觉判断。').length).toBeGreaterThan(0);
  });

  it('lets users save an archived daily fortune into card annotations once', async () => {
    const user = userEvent.setup();
    const archivedFortune: DailyFortune = {
      ...baseFortune,
      archivedAt: '2026-07-02T09:00:00.000Z',
      initialImpression: '第一眼觉得要慢下来。',
      dailyReview: '晚上发现确实需要减少争辩。',
      reflection: '第一直觉：第一眼觉得要慢下来。\n\n今日回看：晚上发现确实需要减少争辩。',
    };
    const props = renderCard({ fortune: archivedFortune, fortunes: [archivedFortune] });

    await user.click(screen.getByRole('button', { name: '打开日运复盘' }));
    await user.click(screen.getByRole('button', { name: '归入牌义注疏' }));

    expect(props.onSaveToCardAnnotation).toHaveBeenCalledWith(archivedFortune.id);
  });

  it('marks saved daily fortune examples as already added to card annotations', async () => {
    const user = userEvent.setup();
    const archivedFortune: DailyFortune = {
      ...baseFortune,
      archivedAt: '2026-07-02T09:00:00.000Z',
      reflection: '已经沉淀为一条例证。',
      savedToCardAnnotationAt: '2026-07-02T22:00:00.000Z',
    };
    const props = renderCard({ fortune: archivedFortune, fortunes: [archivedFortune] });

    await user.click(screen.getByRole('button', { name: '打开日运复盘' }));

    const button = screen.getByRole('button', { name: '已归入牌义注疏' });
    expect(button).toBeDisabled();
    expect(props.onSaveToCardAnnotation).not.toHaveBeenCalled();
  });

  it('preserves line breaks when showing daily reflection on the home card', () => {
    const archivedFortune: DailyFortune = {
      ...baseFortune,
      archivedAt: '2026-07-02T09:00:00.000Z',
      reflection: '问：今日主线\n第一印象：保持安静观察\n复盘：对应到真实判断。',
    };

    renderCard({ fortune: archivedFortune, fortunes: [archivedFortune] });

    expect(screen.getByText(/问：今日主线/)).toHaveClass('whitespace-pre-wrap');
  });

  it('shows split daily reflection blocks on the home card', () => {
    const archivedFortune: DailyFortune = {
      ...baseFortune,
      archivedAt: '2026-07-02T09:00:00.000Z',
      initialImpression: '第一眼觉得要慢下来。',
      dailyReview: '晚上发现确实需要减少争辩。',
      reflection: '第一直觉：第一眼觉得要慢下来。\n\n今日回看：晚上发现确实需要减少争辩。',
    };

    renderCard({ fortune: archivedFortune, fortunes: [archivedFortune] });

    expect(screen.getByText('第一直觉')).toBeInTheDocument();
    expect(screen.getByText('第一眼觉得要慢下来。')).toBeInTheDocument();
    expect(screen.getByText('今日回看')).toBeInTheDocument();
    expect(screen.getByText('晚上发现确实需要减少争辩。')).toBeInTheDocument();
  });

  it('only shows written reflection blocks and points users to finish daily review', () => {
    const archivedFortune: DailyFortune = {
      ...baseFortune,
      archivedAt: '2026-07-02T09:00:00.000Z',
      initialImpression: '第一眼觉得要慢下来。',
      reflection: '第一直觉：第一眼觉得要慢下来。',
    };

    renderCard({ fortune: archivedFortune, fortunes: [archivedFortune] });

    expect(screen.getByText('第一直觉')).toBeInTheDocument();
    expect(screen.getByText('第一眼觉得要慢下来。')).toBeInTheDocument();
    expect(screen.queryByText('晚上回来看看今天有没有对应。')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '补写今日回看' })).toBeInTheDocument();
  });

  it('lets users adjust a physical daily card from the home card', async () => {
    const user = userEvent.setup();
    const physicalFortune: DailyFortune = {
      ...baseFortune,
      source: 'physical-draw',
    };
    const props = renderCard({ fortune: physicalFortune, fortunes: [physicalFortune] });

    await user.click(screen.getByRole('button', { name: '切换为逆位' }));
    expect(props.onUpdateCard).toHaveBeenCalledWith(physicalFortune.id, 'ar02', true);

    await user.click(screen.getByRole('button', { name: '更换牌' }));
    expect(screen.getByRole('heading', { name: '更换今日日运牌' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: '逆位' })).not.toBeInTheDocument();
    await user.click(screen.getByText('皇帝'));

    expect(props.onUpdateCard).toHaveBeenCalledWith(physicalFortune.id, 'ar04', false);
  });

  it('asks for a number before replacing today fortune when redrawing', async () => {
    const user = userEvent.setup();
    const props = renderCard({ fortune: baseFortune, fortunes: [baseFortune] });

    await user.click(screen.getByRole('button', { name: '重新洗牌抽日运' }));
    await user.click(screen.getByRole('button', { name: '重新洗牌' }));
    expect(await screen.findByRole('heading', { name: '重新选择今日日运牌' }, { timeout: 3000 })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('输入你心中的数字...'), '7');
    await user.click(screen.getByRole('button', { name: '确认选择' }));

    expect(screen.getByText('你抽到了今天的第 7 张牌')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '揭晓答案' }));
    expect(props.onGenerateWithNumber).toHaveBeenCalledWith(7, expect.any(Number), true);
  });
});
