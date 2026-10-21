import { describe, expect, it } from 'vitest';
import { INITIAL_READINGS } from '../constants';
import { isDailyReading, readingMatchesSearch } from './readingSearch';

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
});
