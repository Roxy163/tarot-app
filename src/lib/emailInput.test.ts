import { describe, expect, it } from 'vitest';
import { normalizeEmailInput } from './emailInput';

describe('normalizeEmailInput', () => {
  it('converts Chinese and full-width punctuation used by Chinese keyboards', () => {
    expect(normalizeEmailInput('Roxy。Test＠Example。Com')).toBe('roxy.test@example.com');
  });

  it('removes accidental spaces while preserving a normal email address', () => {
    expect(normalizeEmailInput('  roxy . tarot @ example.com  ')).toBe('roxy.tarot@example.com');
  });
});
