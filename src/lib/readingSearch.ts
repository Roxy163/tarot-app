import type { TarotReading } from '../types';
import { TAROT_CARDS } from '../constants';
import { cardMatchesSearch } from './cardSearch';
import { parseReadingManualTags } from './readingSubmitPayload';

export function isDailyReading(reading: TarotReading) {
  return !reading.isExample && parseReadingManualTags(
    reading.manualTags?.length ? reading.manualTags : reading.category,
  ).includes('日运');
}

export function readingMatchesSearch(reading: TarotReading, search: string) {
  const query = search.trim().normalize('NFKC').toLowerCase();
  if (!query) return true;
  const fields = [
    reading.id, reading.question, reading.spread, reading.authorName, reading.clientName,
    reading.category, ...(reading.manualTags || []), ...(reading.keywords || []),
    ...reading.cards.flatMap(card => [card.name, card.label]),
    ...(reading.slotLabels || []), ...(reading.cardInterpretations || []),
    ...(reading.cardQuestions || []), ...Object.values(reading.interpretation || {}),
    reading.userFeedback, reading.clientFeedback, reading.aiAnswer,
    reading.choicePathA, reading.choicePathB,
  ];
  return fields.some(value => value?.normalize('NFKC').toLowerCase().includes(query))
    || reading.cards.some(slot => {
      const card = TAROT_CARDS.find(item => item.name === slot.name);
      return card ? cardMatchesSearch(card, query) : false;
    });
}
