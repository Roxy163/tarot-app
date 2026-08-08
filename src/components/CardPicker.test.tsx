import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardPicker } from './CardPicker';

const renderPicker = () => {
  const props = {
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  render(<CardPicker {...props} />);

  return props;
};

describe('CardPicker', () => {
  it('prioritizes the first visible card thumbnails', () => {
    renderPicker();

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    expect(images[17]).toHaveAttribute('loading', 'eager');
    expect(images[18]).toHaveAttribute('loading', 'lazy');
  });

  it('finds cards by common Chinese aliases', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByPlaceholderText('搜索牌名、别称或英文...'), '圣杯侍卫');

    expect(screen.getByText('圣杯侍从')).toBeInTheDocument();
    expect(screen.queryByText('权杖侍从')).not.toBeInTheDocument();
  });

  it('keeps bare emperor and empress searches focused on major arcana', async () => {
    const user = userEvent.setup();
    renderPicker();
    const searchInput = screen.getByPlaceholderText('搜索牌名、别称或英文...');

    await user.type(searchInput, '皇帝');

    expect(screen.getByText('皇帝')).toBeInTheDocument();
    expect(screen.queryByText('星币国王')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, '圣杯皇后');

    expect(screen.getByText('圣杯王后')).toBeInTheDocument();
    expect(screen.queryByText('皇后')).not.toBeInTheDocument();
  });

  it('does not ask for orientation inside the picker and selects cards upright by default', async () => {
    const user = userEvent.setup();
    const props = renderPicker();

    expect(screen.queryByRole('button', { name: '正位' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '逆位' })).not.toBeInTheDocument();

    await user.click(screen.getByText('皇帝'));

    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ar04' }), false);
  });
});
