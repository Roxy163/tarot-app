import { TarotReading } from '../types';

const hasText = (value?: string) => Boolean(value?.trim());

export const hasLegacyOverviewInterpretation = (reading: TarotReading) => (
  hasText(reading.interpretation?.singleCard)
  || hasText(reading.interpretation?.combination)
  || hasText(reading.interpretation?.summary)
);

export const isReadingIncomplete = (reading: TarotReading) => {
  if (reading.status === 'draft') return true;
  if (reading.status === 'complete') return false;

  const cards = reading.cards || [];
  if (cards.length === 0) return true;
  if (cards.some(card => !hasText(card.name))) return true;

  if (reading.cardInterpretations?.some(hasText)) {
    return cards.some((card, index) => hasText(card.name) && !hasText(reading.cardInterpretations?.[index]));
  }

  return !hasLegacyOverviewInterpretation(reading);
};

export const getReadingCompletionLabel = (reading: TarotReading) => (
  isReadingIncomplete(reading) ? '待补全' : '完整'
);
