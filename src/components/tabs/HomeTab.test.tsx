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

  it('keeps primary home actions available without the promotional first screen', () => {
    const dailyFortune = {
      fortunes: [],
      shuffledDeck: [],
      shuffleDeck: vi.fn(),
      getToday: vi.fn(() => null),
      generateDailyFortune: vi.fn(),
      generateDailyFortuneWithNumber: vi.fn(),
      reshuffleDailyFortune: vi.fn(),
      createDailyFortuneFromCard: vi.fn(),
      updateDailyFortuneCard: vi.fn(),
      addReflection: vi.fn(),
      archiveDailyFortune: vi.fn(),
      updateDailyFortuneReflection: vi.fn(),
      saveDailyFortuneToCardAnnotation: vi.fn(),
      getArchivedFortunes: vi.fn(() => []),
      getMonthlySummary: vi.fn(),
      getSeasonalSummary: vi.fn(),
      getYearlySummary: vi.fn(),
    } as any;

    const { container } = render(
      <HomeTab
        session={null}
        profile={null}
        dailyProverb="今日宜慢慢看清。"
        readings={[]}
        cardMetadata={[]}
        quizMemory={[]}
        onUpdateQuizMemory={vi.fn()}
        onNavigate={vi.fn()}
        onSearch={vi.fn()}
        onSelectSpread={vi.fn()}
        dailyFortune={dailyFortune}
      />,
    );

    expect(screen.queryByTestId('home-hero')).not.toBeInTheDocument();
    expect(screen.queryByText('把抽到的牌')).not.toBeInTheDocument();
    expect(screen.queryByText('写成看见自己的证据')).not.toBeInTheDocument();
    expect(screen.getByText('今日研习')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /日运复盘/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /典籍复盘/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /牌义注疏/ })).toBeInTheDocument();
    expect(container.querySelector('[data-tour="daily-review"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="library-review"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="card-annotations"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="daily-draw"]')).toBeInTheDocument();
  });
});
