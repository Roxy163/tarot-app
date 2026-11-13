import { describe, expect, it } from 'vitest';
import { TAROT_CARDS } from '../constants';
import { getDailyCardObservation } from './dailyCardObservations';

describe('日运观察问题', () => {
  it('给牌组里每张牌的正位和逆位各一条不同的观察问题', () => {
    const prompts = TAROT_CARDS.flatMap(card => [false, true].map(isReversed => {
      const prompt = getDailyCardObservation(card.id, isReversed);
      expect(prompt, `${card.name} ${isReversed ? '逆位' : '正位'}`).toMatch(/？$/);
      return prompt;
    }));

    expect(new Set(prompts).size).toBe(TAROT_CARDS.length * 2);
  });
});
