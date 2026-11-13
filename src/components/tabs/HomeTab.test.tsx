import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeTab } from './HomeTab';

const renderHome = (dailyFortune: React.ComponentProps<typeof HomeTab>['dailyFortune']) => render(
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
      deleteDailyFortune: vi.fn(),
      deleteDailyFortunes: vi.fn(),
      getArchivedFortunes: vi.fn(() => []),
      getMonthlySummary: vi.fn(),
      getSeasonalSummary: vi.fn(),
      getYearlySummary: vi.fn(),
    } as any;

    const { container } = renderHome(dailyFortune);

    expect(screen.queryByTestId('home-hero')).not.toBeInTheDocument();
    expect(screen.queryByText('把抽到的牌')).not.toBeInTheDocument();
    expect(screen.queryByText('写成看见自己的证据')).not.toBeInTheDocument();
    expect(screen.getByText('今日研习')).toBeInTheDocument();
    expect(screen.getByText('日运回看')).toBeInTheDocument();
    expect(screen.getByText('手记复盘')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /日运复盘/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /典籍复盘/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /牌义注疏/ })).toBeInTheDocument();
    expect(container.querySelector('[data-tour="daily-review"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="library-review"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="card-annotations"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="daily-draw"]')).toBeInTheDocument();
  });

  it('refreshes the draw after local midnight and after a suspended page is focused', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 12, 23, 59, 59));
      const first = {
        id: 'first', userId: 'local', date: '2026-11-12', cardName: '魔术师',
        interpretation: '', keywords: [], isReversed: false, isRevealed: true,
        createdAt: '2026-11-12T10:00:00.000Z',
      };
      const second = { ...first, id: 'second', date: '2026-11-13', cardName: '女祭司' };
      const fortunes = [first, second];
      renderHome({ fortunes, getToday: (day: string) => fortunes.find(fortune => fortune.date === day) } as any);
      expect(screen.getByRole('heading', { name: '魔术师' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole('heading', { name: '女祭司' })).toBeInTheDocument();
      vi.setSystemTime(new Date(2026, 10, 14, 9));
      fireEvent.focus(window);
      expect(screen.getByRole('button', { name: '随机一张' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: '女祭司' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
