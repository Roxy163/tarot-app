import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';

const OnboardingProbe = () => {
  const { state, checkAndUnlockAchievements } = useOnboarding();
  const unlockedCount = state.achievements.filter(achievement => achievement.unlockedAt).length;

  return (
    <div>
      <span data-testid="achievement-count">{state.achievements.length}</span>
      <span data-testid="unlocked-count">{unlockedCount}</span>
      <button type="button" onClick={() => checkAndUnlockAchievements(1, false, 0, 0)}>
        unlock first
      </button>
    </div>
  );
};

const renderProbe = () => render(
  <OnboardingProvider>
    <OnboardingProbe />
  </OnboardingProvider>,
);

describe('OnboardingProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads achievement state without reopening legacy guides', async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('achievement-count')).toHaveTextContent('6');
    });

    expect(localStorage.getItem('has_seen_first_entry_scroll')).toBe('true');
  });

  it('ignores old guide flags while preserving stored achievements shape', async () => {
    localStorage.setItem('tarot_onboarding_state', JSON.stringify({ hasCompletedFirstEntry: false, completedGuides: ['legacy'] }));

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('achievement-count')).toHaveTextContent('6');
    });

    const saved = JSON.parse(localStorage.getItem('tarot_onboarding_state') || '{}');
    expect(saved.completedGuides).toBeUndefined();
    expect(saved.hasCompletedFirstEntry).toBeUndefined();
  });
});
