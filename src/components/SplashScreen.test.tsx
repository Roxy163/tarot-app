import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  it('renders the launch copy and enters the pavilion from the CTA', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();

    render(<SplashScreen onEnter={onEnter} />);

    expect(screen.getByRole('heading', { name: '塔罗研习阁' })).toBeInTheDocument();
    expect(screen.getByText('你的塔罗，自有体系。')).toBeInTheDocument();
    expect(screen.getByText('记录·注疏·布阵，构建你的个人手札。')).toBeInTheDocument();
    expect(screen.getByText('不教塔罗，只陪你成为自己的塔罗师。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '开启研习' }));

    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
