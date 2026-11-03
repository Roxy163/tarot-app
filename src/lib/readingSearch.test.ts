import { describe, expect, it } from 'vitest';
import { INITIAL_READINGS } from '../constants';
import { getRecordCalendarDate, isDailyReading, readingMatchesSearch, recordDateMatchesSearch } from './readingSearch';

const reading = {
  ...INITIAL_READINGS[0], isExample: false,
  question: '接下来关注什么', spread: '无牌阵三张',
  cards: [{ name: '隐士', isReversed: false, label: '现在' }],
  manualTags: ['日运', '学习'],
  cardInterpretations: ['湖边散步让我安静下来'], cardQuestions: ['独处还是交流？'],
  userFeedback: '留出了独处的时间', clientFeedback: '很有帮助',
};

describe('private reading search', () => {
  it.each(['隐士', '隐者', ' HERMIT ', '日运', '无牌阵', '湖边散步', '独处还是', '很有帮助', '留出了', '现在', '   '])('finds %s', query => {
    expect(readingMatchesSearch(reading, query)).toBe(true);
  });
  it('does not match unrelated cards or text', () => {
    expect(readingMatchesSearch(reading, '权杖国王')).toBe(false);
    expect(readingMatchesSearch(reading, '找不到的文字')).toBe(false);
  });
  it('recognizes multi-tag and legacy daily readings but excludes examples', () => {
    expect(isDailyReading(reading)).toBe(true);
    expect(isDailyReading({ ...reading, manualTags: [], category: '日运，学习' })).toBe(true);
    expect(isDailyReading({ ...reading, isExample: true })).toBe(false);
  });
  it.each(['2026-11-03', '2026/11/3', '2026.11.03', '2026年11月3日', '11月3号', '11/3', '11-03', '2026/11', '2026年11月', '１１／３'])('searches actual reading dates in the common form %s', query => {
    expect(readingMatchesSearch({ ...reading, readingDate: '2026-11-03', date: '2026-10-20T08:00:00Z' }, query)).toBe(true);
  });
  it('searches the local calendar date of legacy timestamps and keeps date-only values unchanged', () => {
    const timestamp = new Date(2026, 10, 3, 0, 15).toISOString();
    expect(getRecordCalendarDate(timestamp)).toBe('2026-11-03');
    expect(getRecordCalendarDate('2026-11-03')).toBe('2026-11-03');
    expect(readingMatchesSearch({ ...reading, readingDate: undefined, date: timestamp }, '2026年11月3日')).toBe(true);
    expect(recordDateMatchesSearch(timestamp, '11/2')).toBe(false);
  });
  it('does not mistake a different day or month for an unpadded date search', () => {
    expect(recordDateMatchesSearch('2026-11-30', '11/3')).toBe(false);
    expect(recordDateMatchesSearch('2026-11-03', '2026/1')).toBe(false);
    expect(recordDateMatchesSearch('not-a-date', '2026')).toBe(false);
    expect(recordDateMatchesSearch(undefined, '2026')).toBe(false);
  });
});
