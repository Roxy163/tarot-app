import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TarotCardImage } from './TarotCardImage';

describe('TarotCardImage', () => {
  it('keeps the card name visible when the remote image fails', () => {
    render(
      <TarotCardImage
        src="https://example.com/card.jpg"
        alt="女祭司"
        name="女祭司"
        className="h-24 w-16"
      />,
    );

    fireEvent.error(screen.getByAltText('女祭司'));

    expect(screen.getByTestId('tarot-card-image-fallback')).toHaveAccessibleName('女祭司牌面暂不可用');
    expect(screen.getByText('女祭司')).toBeInTheDocument();
  });
});
