import { describe, expect, it } from 'vitest';
import {
  getCardImageFormatUrl,
  getCardImageSources,
  getCardImageUrl,
  TAROT_CARD_IMAGE_BASE_PATH,
} from './constants';

describe('tarot card image urls', () => {
  it('uses local static card images instead of remote image providers', () => {
    expect(getCardImageUrl('ar00')).toBe(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.jpg`);
    expect(getCardImageUrl('cu10')).toBe(`${TAROT_CARD_IMAGE_BASE_PATH}/cu10.jpg`);
  });

  it('provides AVIF and WebP sources next to the JPG fallback', () => {
    expect(getCardImageSources('ar00')).toEqual({
      avif: `${TAROT_CARD_IMAGE_BASE_PATH}/ar00.avif`,
      webp: `${TAROT_CARD_IMAGE_BASE_PATH}/ar00.webp`,
      jpg: `${TAROT_CARD_IMAGE_BASE_PATH}/ar00.jpg`,
    });
  });

  it('derives alternate local card image formats from a JPG URL', () => {
    expect(getCardImageFormatUrl(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.jpg`, 'avif')).toBe(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.avif`);
    expect(getCardImageFormatUrl(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.jpg?v=1`, 'webp')).toBe(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.webp?v=1`);
    expect(getCardImageFormatUrl('https://example.com/card.jpg', 'webp')).toBeNull();
  });

  it('falls back to the fool image for invalid card ids', () => {
    expect(getCardImageUrl('missing-card')).toBe(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.jpg`);
    expect(getCardImageSources('missing-card').avif).toBe(`${TAROT_CARD_IMAGE_BASE_PATH}/ar00.avif`);
  });
});
