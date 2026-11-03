import { describe, expect, it } from 'vitest';
import { appendNoObviousDailyMatch, NO_OBVIOUS_DAILY_MATCH_TEXT } from './dailyFortuneReflection';

describe('daily review quick phrase', () => {
  it.each(['', ' \n  '])('fills a blank review without leading whitespace', text => {
    expect(appendNoObviousDailyMatch(text)).toBe(NO_OBVIOUS_DAILY_MATCH_TEXT);
  });

  it('keeps the full existing review and appends the phrase on a separate line', () => {
    const text = '早上有点焦虑。\n  晚上平静下来了。  ';
    expect(appendNoObviousDailyMatch(text)).toBe(`${text}\n${NO_OBVIOUS_DAILY_MATCH_TEXT}`);
  });

  it('uses an existing trailing newline', () => {
    expect(appendNoObviousDailyMatch('先记下来。\n')).toBe(`先记下来。\n${NO_OBVIOUS_DAILY_MATCH_TEXT}`);
  });

  it('does not add the phrase again, even if more writing follows it', () => {
    const text = `${NO_OBVIOUS_DAILY_MATCH_TEXT}\n后来又想起一些细节。`;
    expect(appendNoObviousDailyMatch(text)).toBe(text);
    const appended = appendNoObviousDailyMatch('先保留观察。');
    expect(appendNoObviousDailyMatch(appended)).toBe(appended);
  });
});
