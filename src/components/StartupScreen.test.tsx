import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartupScreen } from './StartupScreen';

describe('startup loading message', () => {
  afterEach(() => vi.useRealTimers());
  it('explains the local fallback only after waiting, without implying an account problem', () => {
    vi.useFakeTimers();
    render(<StartupScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('正在加载…');
    expect(screen.queryByText(/恢复账号|连接稍慢/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole('status')).toHaveTextContent('连接稍慢，将自动进入本机模式。');
  });
});
