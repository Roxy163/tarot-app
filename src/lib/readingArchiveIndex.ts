import { TarotReading } from '../types';
import { parseReadingManualTags } from './readingSubmitPayload';

export type ReadingArchiveIndexFilter =
  | { type: 'card'; value: string; label: string }
  | { type: 'spread'; value: string; label: string }
  | { type: 'tag'; value: string; label: string }
  | { type: 'question'; value: string; label: string };

export interface ReadingArchiveCardIndexItem {
  cardName: string;
  count: number;
  uprightCount: number;
  reversedCount: number;
  reviewedCount: number;
  lastSeenAt: number;
  latestQuestion: string;
}

export interface ReadingArchiveSpreadIndexItem {
  spread: string;
  count: number;
  reviewedCount: number;
  lastSeenAt: number;
  latestQuestion: string;
}

export interface ReadingArchiveTagIndexItem {
  tag: string;
  count: number;
  reviewedCount: number;
  lastSeenAt: number;
  latestQuestion: string;
}

export interface ReadingArchiveQuestionIndexItem {
  question: string;
  count: number;
  lastSeenAt: number;
}

export interface ReadingArchiveIndex {
  cards: ReadingArchiveCardIndexItem[];
  spreads: ReadingArchiveSpreadIndexItem[];
  tags: ReadingArchiveTagIndexItem[];
  questions: ReadingArchiveQuestionIndexItem[];
}

const getReadingTime = (reading: TarotReading) => (
  new Date(reading.updatedAt || reading.readingDate || reading.date || 0).getTime()
);

export const getArchiveIndexReadings = (readings: TarotReading[]) => {
  const hasRealReadings = readings.some(reading => !reading.isExample);
  return readings.filter(reading => !(hasRealReadings && reading.isExample));
};

export const getReadingManualTagsForIndex = (reading: TarotReading) => (
  reading.manualTags && reading.manualTags.length > 0
    ? parseReadingManualTags(reading.manualTags)
    : parseReadingManualTags(reading.category)
);

export const buildReadingArchiveIndex = (readings: TarotReading[]): ReadingArchiveIndex => {
  const cardGroups = new Map<string, ReadingArchiveCardIndexItem>();
  const spreadGroups = new Map<string, ReadingArchiveSpreadIndexItem>();
  const tagGroups = new Map<string, ReadingArchiveTagIndexItem>();
  const questionGroups = new Map<string, ReadingArchiveQuestionIndexItem>();

  getArchiveIndexReadings(readings).forEach(reading => {
    const lastSeenAt = getReadingTime(reading);
    const reviewed = Boolean(reading.userFeedback?.trim());
    const spread = reading.spread?.trim() || '未命名牌阵';
    const question = reading.question?.trim() || '未命名问题';

    const spreadItem = spreadGroups.get(spread) || {
      spread,
      count: 0,
      reviewedCount: 0,
      lastSeenAt,
      latestQuestion: question,
    };
    spreadItem.count += 1;
    spreadItem.reviewedCount += reviewed ? 1 : 0;
    if (lastSeenAt >= spreadItem.lastSeenAt) {
      spreadItem.latestQuestion = question;
    }
    spreadItem.lastSeenAt = Math.max(spreadItem.lastSeenAt, lastSeenAt);
    spreadGroups.set(spread, spreadItem);

    const questionItem = questionGroups.get(question) || {
      question,
      count: 0,
      lastSeenAt,
    };
    questionItem.count += 1;
    questionItem.lastSeenAt = Math.max(questionItem.lastSeenAt, lastSeenAt);
    questionGroups.set(question, questionItem);

    getReadingManualTagsForIndex(reading).forEach(tag => {
      const tagItem = tagGroups.get(tag) || {
        tag,
        count: 0,
        reviewedCount: 0,
        lastSeenAt,
        latestQuestion: question,
      };
      tagItem.count += 1;
      tagItem.reviewedCount += reviewed ? 1 : 0;
      if (lastSeenAt >= tagItem.lastSeenAt) {
        tagItem.latestQuestion = question;
      }
      tagItem.lastSeenAt = Math.max(tagItem.lastSeenAt, lastSeenAt);
      tagGroups.set(tag, tagItem);
    });

    reading.cards.forEach(card => {
      const cardName = card.name?.trim();
      if (!cardName) return;

      const cardItem = cardGroups.get(cardName) || {
        cardName,
        count: 0,
        uprightCount: 0,
        reversedCount: 0,
        reviewedCount: 0,
        lastSeenAt,
        latestQuestion: question,
      };
      cardItem.count += 1;
      cardItem.uprightCount += card.isReversed ? 0 : 1;
      cardItem.reversedCount += card.isReversed ? 1 : 0;
      cardItem.reviewedCount += reviewed ? 1 : 0;
      if (lastSeenAt >= cardItem.lastSeenAt) {
        cardItem.latestQuestion = question;
      }
      cardItem.lastSeenAt = Math.max(cardItem.lastSeenAt, lastSeenAt);
      cardGroups.set(cardName, cardItem);
    });
  });

  const sortByCountAndTime = <T extends { count: number; lastSeenAt: number }>(a: T, b: T) => (
    b.count - a.count || b.lastSeenAt - a.lastSeenAt
  );

  return {
    cards: Array.from(cardGroups.values()).sort(sortByCountAndTime),
    spreads: Array.from(spreadGroups.values()).sort(sortByCountAndTime),
    tags: Array.from(tagGroups.values()).sort(sortByCountAndTime),
    questions: Array.from(questionGroups.values())
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || b.count - a.count)
      .slice(0, 8),
  };
};

export const readingMatchesArchiveIndexFilter = (
  reading: TarotReading,
  filter: ReadingArchiveIndexFilter | null,
) => {
  if (!filter) return true;

  if (filter.type === 'card') {
    return reading.cards.some(card => card.name === filter.value);
  }

  if (filter.type === 'spread') {
    return (reading.spread?.trim() || '未命名牌阵') === filter.value;
  }

  if (filter.type === 'tag') {
    return getReadingManualTagsForIndex(reading).includes(filter.value);
  }

  const q = filter.value.trim().toLowerCase();
  return Boolean(q) && reading.question.toLowerCase().includes(q);
};
