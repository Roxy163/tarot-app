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
});
