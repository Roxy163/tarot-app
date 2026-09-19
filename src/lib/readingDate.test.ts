import { describe, expect, it } from 'vitest';
import { serializeReadingDate, toLocalReadingDate } from './readingDate';

describe('local reading dates', () => {
  it.each([[2026, 8, 16], [2026, 0, 1], [2026, 9, 1]])('preserves midnight records over repeated edits: %s/%s/%s', (year, month, day) => {
    const original = new Date(year, month, day, 1, 30).toISOString();
    let saved = original;
    for (let i = 0; i < 3; i++) saved = serializeReadingDate(toLocalReadingDate(saved), saved);
    expect(saved).toBe(original);
    expect(toLocalReadingDate(original)).toBe(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  });
  it('stores a new calendar date without timezone conversion', () => {
    expect(serializeReadingDate('2026-09-16')).toBe('2026-09-16');
    expect(serializeReadingDate('2026-10-01', '2026-09-16T01:30:00+08:00')).toBe('2026-10-01');
  });
  it.each(['', '2026-02-30', 'invalid'])('rejects an invalid calendar date: %s', value => {
    expect(() => serializeReadingDate(value)).toThrow();
  });
});
