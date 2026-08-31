import { describe, expect, it } from 'vitest';
import { TarotReading } from '../types';
import {
  applyTagSuggestionToInput,
  buildReadingTagSuggestions,
  getActiveTagDraft,
} from './readingTagSuggestions';

const makeReading = (
  id: string,
  manualTags: string[],
  readingDate: string,
  overrides: Partial<TarotReading> = {},
): TarotReading => ({
  id,
  userId: 'user-1',
  date: readingDate,
  question: `问题 ${id}`,
  spread: '单牌阵',
  cards: [{ name: '愚者', isReversed: false }],
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  manualTags,
  isPublic: false,
  authorName: '见习阁主',
  isAnonymous: false,
  readingDate,
  ...overrides,
});

describe('readingTagSuggestions', () => {
  it('sorts historical tags by recent use when the field is empty', () => {
    const suggestions = buildReadingTagSuggestions([
      makeReading('old', ['事业'], '2026-07-01T08:00:00.000Z'),
      makeReading('new', ['情绪'], '2026-07-03T08:00:00.000Z'),
    ], '');

    expect(suggestions.map(item => item.tag)).toEqual(['情绪', '事业']);
  });

  it('filters historical tags by the active draft while typing', () => {
    const suggestions = buildReadingTagSuggestions([
      makeReading('old', ['事业'], '2026-07-01T08:00:00.000Z'),
      makeReading('new', ['情绪'], '2026-07-03T08:00:00.000Z'),
      makeReading('middle', ['工作'], '2026-07-02T08:00:00.000Z'),
    ], '事');

    expect(suggestions.map(item => item.tag)).toEqual(['事业']);
  });

  it('tracks historical tag counts for reusable tag chips', () => {
    const suggestions = buildReadingTagSuggestions([
      makeReading('career-old', ['事业'], '2026-07-01T08:00:00.000Z'),
      makeReading('career-new', ['事业'], '2026-07-03T08:00:00.000Z'),
      makeReading('emotion', ['情绪'], '2026-07-02T08:00:00.000Z'),
    ], '');

    expect(suggestions[0]).toEqual(expect.objectContaining({
      tag: '事业',
      count: 2,
    }));
  });

  it('replaces the active tag draft when applying a suggestion', () => {
    expect(getActiveTagDraft('工作、事')).toEqual({
      draft: '事',
      committedTags: ['工作'],
    });
    expect(applyTagSuggestionToInput('工作、事', '事业')).toBe('工作、事业');
  });
});
