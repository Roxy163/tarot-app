import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';

const OnboardingProbe = () => {
  const { state } = useOnboarding();

  return (
    <div>
      <span data-testid="first-entry-open">{state.showFirstEntry ? 'yes' : 'no'}</span>
      <span data-testid="first-entry-complete">{state.hasCompletedFirstEntry ? 'yes' : 'no'}</span>
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

  it('does not auto-open the legacy full-screen first-entry guide for new users', async () => {
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('first-entry-complete')).toHaveTextContent('yes');
    });

    expect(screen.getByTestId('first-entry-open')).toHaveTextContent('no');
    expect(localStorage.getItem('has_seen_first_entry_scroll')).toBe('true');
  });

  it('upgrades older stored onboarding state without reopening the legacy guide', async () => {
    localStorage.setItem('tarot_onboarding_state', JSON.stringify({ hasCompletedFirstEntry: false }));

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('first-entry-complete')).toHaveTextContent('yes');
    });

    expect(screen.getByTestId('first-entry-open')).toHaveTextContent('no');
  });
});
