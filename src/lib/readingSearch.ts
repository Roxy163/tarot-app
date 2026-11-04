import type { TarotReading } from '../types';
import { TAROT_CARDS } from '../constants';
import { cardMatchesSearch } from './cardSearch';
import { parseReadingManualTags } from './readingSubmitPayload';
import { toLocalReadingDate } from './readingDate';

export function getRecordCalendarDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return toLocalReadingDate(value);
}

export function recordDateMatchesSearch(value: string | undefined, search: string) {
  const calendarDate = getRecordCalendarDate(value);
  if (!calendarDate) return false;
  const query = search.trim().normalize('NFKC').replace(/\s/g, '');
  if (!query) return true;
  const normalized = query.replace(/[年/月.\-]/g, '/').replace(/[日号]$/, '').replace(/\/$/, '');
  const fullDate = normalized.match(/^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (fullDate) {
    const target = `${fullDate[1]}-${fullDate[2].padStart(2, '0')}${fullDate[3] ? `-${fullDate[3].padStart(2, '0')}` : ''}`;
    return fullDate[3] ? calendarDate === target : calendarDate.startsWith(`${target}-`);
  }
  const monthDay = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (monthDay) return calendarDate.slice(5) === `${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`;
  if (/^\d{1,2}月$/.test(query)) return calendarDate.slice(5, 7) === query.slice(0, -1).padStart(2, '0');
  return calendarDate.includes(query);
}

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
    reading.userFeedback, reading.clientFeedback, reading.aiAnswer, reading.aiContext,
    reading.choicePathA, reading.choicePathB,
  ];
  return fields.some(value => value?.normalize('NFKC').toLowerCase().includes(query))
    || recordDateMatchesSearch(reading.readingDate, query)
    || recordDateMatchesSearch(reading.date, query)
    || reading.cards.some(slot => {
      const card = TAROT_CARDS.find(item => item.name === slot.name);
      return card ? cardMatchesSearch(card, query) : false;
    });
}
