import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeTab } from './HomeTab';

describe('HomeTab', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('keeps the review and daily draw entries available for feature spotlight', () => {
    const { container } = render(
      <HomeTab
        session={null}
        profile={null}
        dailyProverb="今日宜慢慢看清。"
        readings={[]}
        cardMetadata={[]}
        onNavigate={vi.fn()}
        onSearch={vi.fn()}
        onSelectSpread={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /日运复盘/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /典籍复盘/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /牌义注疏/ })).toBeInTheDocument();
    expect(container.querySelector('[data-tour="daily-review"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="library-review"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="card-annotations"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="daily-draw"]')).toBeInTheDocument();
  });
});
