import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureSpotlightGuide } from './FeatureSpotlightGuide';

const steps = [
  {
    target: '[data-tour="daily-review"]',
    title: '回看每日对应',
    description: '晚上看这张牌对应了什么事。',
  },
  {
    target: '[data-tour="library-review"]',
    title: '进入典籍复盘',
    description: '回看自己的手记和客户记录。',
  },
];

describe('FeatureSpotlightGuide', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 });
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
    expect(screen.getByText('回看每日对应')).toBeInTheDocument();
    expect(screen.getByText('晚上看这张牌对应了什么事。')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-floating-note')).toBeInTheDocument();
    expect(screen.queryByTestId('spotlight-target-frame')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spotlight-target-loop')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('spotlight-dim-mask')).toHaveLength(4);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('进入典籍复盘')).toBeInTheDocument();

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

  it('uses a lighter arrow annotation on mobile viewports', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });

    render(
      <>
        <button data-tour="daily-review" type="button">
          日运复盘
        </button>
        <FeatureSpotlightGuide isOpen steps={steps} onFinish={vi.fn()} />
      </>,
    );

    expect(await screen.findByTestId('spotlight-mobile-note')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-arrow')).toBeInTheDocument();
    expect(screen.queryByTestId('spotlight-target-loop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spotlight-target-frame')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('spotlight-dim-mask')).toHaveLength(4);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  });
});
