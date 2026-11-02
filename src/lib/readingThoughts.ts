import type { TarotReading } from '../types';

export const getReadingOverview = (reading: TarotReading): string => {
  const { singleCard, combination, summary } = reading.interpretation || {};
  const candidates = reading.cards?.length === 1
    ? [reading.cardInterpretations?.[0], singleCard, combination, summary]
    : [combination, summary, singleCard];
  return candidates.find(value => value?.trim())?.trim() || '';
};
