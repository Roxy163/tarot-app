import { describe, expect, it } from 'vitest';
import { TAROT_CARDS } from '../constants';
import { cardMatchesSearch } from './cardSearch';

const findCard = (id: string) => {
  const card = TAROT_CARDS.find(item => item.id === id);
  if (!card) throw new Error(`Missing card ${id}`);
  return card;
};

describe('cardSearch', () => {
  it('matches common Chinese aliases for court cards', () => {
    expect(cardMatchesSearch(findCard('cupa'), '圣杯侍者')).toBe(true);
    expect(cardMatchesSearch(findCard('cupa'), '杯侍从')).toBe(true);
    expect(cardMatchesSearch(findCard('peki'), '金币皇帝')).toBe(true);
  });

  it('keeps major arcana distinct when users search major names', () => {
    expect(cardMatchesSearch(findCard('ar04'), '皇帝')).toBe(true);
    expect(cardMatchesSearch(findCard('ar04'), '大阿尔卡纳皇帝')).toBe(true);
    expect(cardMatchesSearch(findCard('ar00'), '大阿尔卡纳皇帝')).toBe(false);
    expect(cardMatchesSearch(findCard('peki'), '大阿尔卡纳皇帝')).toBe(false);
  });

  it('still allows broad arcana category searches', () => {
    expect(cardMatchesSearch(findCard('ar00'), '大阿尔卡纳')).toBe(true);
    expect(cardMatchesSearch(findCard('cupa'), '小阿尔卡纳')).toBe(true);
    expect(cardMatchesSearch(findCard('ar04'), '小阿尔卡纳')).toBe(false);
  });

  it('matches English names and normalized suit aliases', () => {
    expect(cardMatchesSearch(findCard('ar02'), 'High Priestess')).toBe(true);
    expect(cardMatchesSearch(findCard('pepa'), '钱币公主')).toBe(true);
  });
});
