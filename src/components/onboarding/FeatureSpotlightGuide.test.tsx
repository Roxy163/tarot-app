import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureSpotlightGuide } from './FeatureSpotlightGuide';

const steps = [
  {
    target: '[data-tour="daily-review"]',
    title: '这里回看每天的一张牌',
    description: '日运复盘会把你每天抽到或现实录入的牌整理起来。',
  },
  {
    target: '[data-tour="library-review"]',
    title: '这里进入全部典籍复盘',
    description: '典籍复盘会带你回到所有抽牌手记。',
  },
];

describe('FeatureSpotlightGuide', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('points at feature targets and advances through the guide', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();

    render(
      <>
        <button data-tour="daily-review" type="button">
          日运复盘
        </button>
        <button data-tour="library-review" type="button">
          典籍复盘
        </button>
        <FeatureSpotlightGuide isOpen steps={steps} onFinish={onFinish} />
      </>,
    );

    expect(screen.getByRole('dialog', { name: '功能导览' })).toBeInTheDocument();
    expect(screen.getByText('这里回看每天的一张牌')).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('这里进入全部典籍复盘')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '完成' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('can be skipped from the first step', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();

    render(<FeatureSpotlightGuide isOpen steps={steps} onFinish={onFinish} />);

    await user.click(screen.getByRole('button', { name: '跳过' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
