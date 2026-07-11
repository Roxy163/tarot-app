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
  onArchive: vi.fn(),
  onUpdateReflection: vi.fn(),
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

  it('archives a revealed daily fortune with one reflection dialog', async () => {
    const user = userEvent.setup();
    const props = renderCard({ fortune: baseFortune, fortunes: [baseFortune] });

    expect(screen.getByText('这张牌和今天的什么事对应？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '写下今天并归档' }));
    await user.type(screen.getByLabelText('日运记录内容'), '今天第一直觉是保持安静观察。');
    await user.click(screen.getByRole('button', { name: '保存到日运复盘' }));

    expect(props.onArchive).toHaveBeenCalledWith(baseFortune.id, '今天第一直觉是保持安静观察。');
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
    expect(screen.getByRole('button', { name: '补写今日对应' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开日运复盘' }));
    expect(screen.getByRole('dialog', { name: '日运复盘' })).toBeInTheDocument();
    expect(screen.getByText('现实抽牌')).toBeInTheDocument();
    expect(screen.getAllByText('晚上对应到一次真实的直觉判断。').length).toBeGreaterThan(0);
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
