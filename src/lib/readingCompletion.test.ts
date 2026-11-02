import { describe, expect, it } from 'vitest';
import { isReadingIncomplete } from './readingCompletion';
import type { TarotReading } from '../types';

describe('reading completion', () => {
  const reading = { cards: [{ name: '隐士', isReversed: false }, { name: '太阳', isReversed: true }] } as TarotReading;

  it('does not treat missing optional writing or legacy draft status as unfinished', () => {
    expect(isReadingIncomplete({ ...reading, status: 'draft', cardInterpretations: ['只写这一张', ''] })).toBe(false);
    expect(isReadingIncomplete(reading)).toBe(false);
  });

  it('still identifies missing cards even if an old status says complete', () => {
    expect(isReadingIncomplete({ ...reading, status: 'complete', cards: [reading.cards[0], { name: '', isReversed: false }] })).toBe(true);
    expect(isReadingIncomplete({ ...reading, cards: [] })).toBe(true);
  });
});
