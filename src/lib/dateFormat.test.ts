import { describe, expect, it } from 'vitest';
import { formatReadingDateTime } from './dateFormat';

describe('formatReadingDateTime', () => {
  it('formats ISO datetime into a human-readable Chinese date', () => {
    const formatted = formatReadingDateTime('2026-07-03T08:00:00');

    expect(formatted).toContain('2026年7月3日');
    expect(formatted).toContain('08:00');
  });

  it('keeps invalid date text as-is', () => {
    expect(formatReadingDateTime('不是日期')).toBe('不是日期');
  });
});
