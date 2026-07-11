import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandIntro } from './BrandIntro';

describe('BrandIntro', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the app mark and concise slogan, then finishes automatically', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();

    render(<BrandIntro onDone={onDone} />);

    expect(screen.getByTestId('brand-intro')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '塔罗研习阁图标' })).toHaveAttribute('src', '/app-icon.svg');
    expect(screen.getByRole('heading', { name: '塔罗研习阁' })).toBeInTheDocument();
    expect(screen.getByText('观牌，也观心')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
