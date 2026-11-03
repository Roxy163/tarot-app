import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarotCardImage } from './TarotCardImage';

describe('TarotCardImage', () => {
  it('renders AVIF and WebP sources for local tarot card images', () => {
    const { container } = render(
      <TarotCardImage
        src="/tarot-cards/ar00.jpg"
        alt="愚者"
        name="愚者"
        className="h-24 w-16 object-cover"
      />,
    );

    expect(container.querySelector('source[type="image/avif"]')).toHaveAttribute('srcset', '/tarot-cards/ar00.avif');
    expect(container.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset', '/tarot-cards/ar00.webp');
    expect(screen.getByAltText('愚者')).toHaveAttribute('src', '/tarot-cards/ar00.jpg');
  });

  it('keeps the card name visible when the remote image fails', () => {
    const { container } = render(
      <TarotCardImage
        src="https://example.com/card.jpg"
        alt="女祭司"
        name="女祭司"
        className="h-24 w-16"
      />,
    );

    expect(container.querySelector('source')).not.toBeInTheDocument();
    fireEvent.error(screen.getByAltText('女祭司'));

    expect(screen.getByTestId('tarot-card-image-fallback')).toHaveAccessibleName('女祭司牌面暂不可用');
    expect(screen.getByText('女祭司')).toBeInTheDocument();
  });

  it('tries cached WebP and JPEG copies when preferred formats fail', () => {
    const { container } = render(<TarotCardImage src="/tarot-cards/ar00.jpg" alt="愚者" name="愚者" />);
    fireEvent.error(screen.getByAltText('愚者'));
    expect(container.querySelector('source[type="image/avif"]')).not.toBeInTheDocument();
    expect(container.querySelector('source[type="image/webp"]')).toBeInTheDocument();
    fireEvent.error(screen.getByAltText('愚者'));
    expect(container.querySelector('source')).not.toBeInTheDocument();
    expect(screen.getByAltText('愚者')).toHaveAttribute('src', '/tarot-cards/ar00.jpg');
    fireEvent.load(screen.getByAltText('愚者'));
    expect(screen.queryByTestId('tarot-card-image-fallback')).not.toBeInTheDocument();
    expect(screen.getByAltText('愚者')).toHaveClass('opacity-100');
  });

  it('retries a failed card after connectivity returns without changing its source', () => {
    const { container } = render(<TarotCardImage src="/tarot-cards/ar00.jpg" alt="愚者" name="愚者" />);
    for (let failure = 0; failure < 3; failure += 1) fireEvent.error(screen.getByAltText('愚者'));
    expect(screen.getByTestId('tarot-card-image-fallback')).toBeInTheDocument();
    fireEvent(window, new Event('online'));
    expect(screen.queryByTestId('tarot-card-image-fallback')).not.toBeInTheDocument();
    expect(container.querySelector('source[type="image/avif"]')).toBeInTheDocument();
    fireEvent.load(screen.getByAltText('愚者'));
    expect(screen.getByAltText('愚者')).toHaveClass('opacity-100');
  });

  it('skips formats the browser has already bypassed and resets for another card', () => {
    const { container, rerender } = render(<TarotCardImage src="/tarot-cards/ar00.jpg" alt="愚者" name="愚者" />);
    Object.defineProperty(screen.getByAltText('愚者'), 'currentSrc', { value: 'https://tarot.test/tarot-cards/ar00.webp' });
    fireEvent.error(screen.getByAltText('愚者'));
    expect(container.querySelector('source')).not.toBeInTheDocument();
    rerender(<TarotCardImage src="/tarot-cards/ar01.jpg" alt="魔术师" name="魔术师" />);
    expect(container.querySelector('source[type="image/avif"]')).toHaveAttribute('srcset', '/tarot-cards/ar01.avif');
    expect(screen.getByAltText('魔术师')).toHaveAttribute('src', '/tarot-cards/ar01.jpg');
  });
});
