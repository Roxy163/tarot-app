import { TarotReading } from '../types';

const hasText = (value?: string) => Boolean(value?.trim());

export const hasLegacyOverviewInterpretation = (reading: TarotReading) => (
  hasText(reading.interpretation?.singleCard)
  || hasText(reading.interpretation?.combination)
  || hasText(reading.interpretation?.summary)
);

export const isReadingIncomplete = (reading: TarotReading) => {
  const cards = reading.cards || [];
  return cards.length === 0 || cards.some(card => !hasText(card.name));
};

export const getReadingCompletionLabel = (reading: TarotReading) => (
  isReadingIncomplete(reading) ? '待补全' : '完整'
);
