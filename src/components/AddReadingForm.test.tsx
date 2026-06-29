import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_SPREADS } from '../constants';
import { AddReadingForm } from './AddReadingForm';

const renderForm = () => {
  const props = {
    onSubmit: vi.fn(),
    isLoading: false,
    isLoggedIn: false,
    spreads: OFFICIAL_SPREADS,
    onUpdateSpreads: vi.fn(),
    cardMetadata: [],
    onUpdateCardMetadata: vi.fn(),
  };

  render(<AddReadingForm {...props} />);
  return props;
};

describe('AddReadingForm spread designer flow', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 640,
      height: 460,
      top: 0,
      right: 640,
      bottom: 460,
      left: 0,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('closes the spread designer after saving and using a new free layout spread', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: '牌阵工作台' }));
    await user.click(screen.getByTestId('free-layout-canvas'));
    await user.click(screen.getByTestId('free-layout-pending-slot'));
    await user.click(screen.getByRole('button', { name: '保存并使用' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: '我的新牌阵',
          layout: 'free',
          slots: ['位置1'],
          freePositions: [expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), scale: 1 })],
        }),
      ]),
    );
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '牌阵工作台' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('已保存，当前手记正在使用这个牌阵')).toBeInTheDocument();

    const spreadSelect = screen.getByText('牌阵：').closest('div')?.parentElement;
    expect(spreadSelect).toBeTruthy();
    expect(within(spreadSelect as HTMLElement).getByRole('button', { name: '牌阵工作台' })).toBeInTheDocument();
  });
});
