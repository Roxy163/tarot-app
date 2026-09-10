import { OFFICIAL_SPREADS, TAROT_CARDS, SPREAD_TO_LAYOUT } from '../constants';
import { SpreadDefinition, TarotCardMetadata, TarotReading } from '../types';
import { parseReadingManualTags } from './readingSubmitPayload';

export type PublicReadingFilter = 'all' | 'reviewed' | 'collected';

export interface PublicTopicChip {
  tag: string;
  count: number;
}

export interface PublicCardExample {
  id: string;
  cardId?: string;
  cardName: string;
  reading: TarotReading;
  slotLabel: string;
  orientation: 'upright' | 'reversed';
  text: string;
  lastSeenAt: number;
}

export interface PublicCardExampleGroup {
  cardId?: string;
  cardName: string;
  count: number;
  uprightCount: number;
  reversedCount: number;
  reviewedCount: number;
  latestQuestion: string;
  lastSeenAt: number;
  examples: PublicCardExample[];
}

export interface PublicSpreadGroup {
  key: string;
  name: string;
  layout: string;
  slots: string[];
  slotPositions: string[];
  rotatedSlots: number[];
  count: number;
  reviewedCount: number;
  latestQuestion: string;
  lastSeenAt: number;
  latestReading: TarotReading;
  definition: SpreadDefinition;
  isOfficial: boolean;
}

const getReadingTime = (reading: TarotReading) => {
  const time = new Date(reading.updatedAt || reading.readingDate || reading.date || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const isPublicReadingReviewed = (reading: TarotReading) => Boolean(
  reading.userFeedback?.trim()
  || reading.interpretation?.summary?.trim()
  || reading.interpretation?.combination?.trim()
);

export const getPublicReadingTags = (reading: TarotReading) => {
  const visibleTags = [
    ...parseReadingManualTags(reading.manualTags),
    ...parseReadingManualTags(reading.category),
  ];

  return Array.from(new Set(visibleTags.map(tag => tag.trim()).filter(Boolean)));
};

const getCanonicalCard = (
  rawName: string | undefined,
  cardMetadata: TarotCardMetadata[] = [],
) => {
  const name = rawName?.trim();
  if (!name) return null;

  const card = [...cardMetadata, ...TAROT_CARDS].find(item => (
    item.name === name || item.english === name || item.id === name
  ));

  return {
    id: card?.id,
    name: card?.name || name,
  };
};

const getCardExampleText = (reading: TarotReading, slotIndex: number) => {
  const directText = reading.cardInterpretations?.[slotIndex]?.trim();
  if (directText) return directText;

  if ((reading.cards?.length || 0) <= 1) {
    const singleText = reading.interpretation?.singleCard?.trim();
    if (singleText) return singleText;
  }

  return (
    reading.interpretation?.combination?.trim()
    || reading.interpretation?.summary?.trim()
    || reading.userFeedback?.trim()
    || ''
  );
};

export const buildPublicTopicChips = (
  readings: TarotReading[],
  limit = 12,
): PublicTopicChip[] => {
  const groups = new Map<string, PublicTopicChip & { latest: number }>();

  readings.forEach(reading => {
    const latest = getReadingTime(reading);
    getPublicReadingTags(reading).forEach(tag => {
      const item = groups.get(tag) || { tag, count: 0, latest };
      item.count += 1;
      item.latest = Math.max(item.latest, latest);
      groups.set(tag, item);
    });
  });

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count || b.latest - a.latest || a.tag.localeCompare(b.tag, 'zh-Hans-CN'))
    .slice(0, limit)
    .map(({ tag, count }) => ({ tag, count }));
};

export const filterPublicReadings = ({
  readings,
  query,
  topic,
  filter,
  collectedIds,
  cardMetadata = [],
}: {
  readings: TarotReading[];
  query: string;
  topic: string;
  filter: PublicReadingFilter;
  collectedIds: string[];
  cardMetadata?: TarotCardMetadata[];
}) => {
  const normalizedQuery = query.trim().toLowerCase();
  const collectedSet = new Set(collectedIds);

  return readings.filter(reading => {
    if (filter === 'reviewed' && !isPublicReadingReviewed(reading)) return false;
    if (filter === 'collected' && !collectedSet.has(reading.id)) return false;

    const cardNames = (reading.cards || [])
      .map(card => getCanonicalCard(card.name, cardMetadata)?.name || card.name || '')
      .filter(Boolean);
    const tags = getPublicReadingTags(reading);

    if (topic && !tags.includes(topic)) return false;
    if (!normalizedQuery) return true;

    const searchText = [
      reading.question,
      reading.spread,
      reading.category,
      ...tags,
      ...cardNames,
      reading.interpretation?.singleCard,
      reading.interpretation?.combination,
      reading.interpretation?.summary,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchText.includes(normalizedQuery);
  });
};

export const buildPublicCardExampleGroups = (
  readings: TarotReading[],
  cardMetadata: TarotCardMetadata[] = [],
): PublicCardExampleGroup[] => {
  const groups = new Map<string, PublicCardExampleGroup>();

  readings.forEach(reading => {
    const lastSeenAt = getReadingTime(reading);
    (reading.cards || []).forEach((slot, slotIndex) => {
      const card = getCanonicalCard(slot.name, cardMetadata);
      if (!card) return;

      const group = groups.get(card.name) || {
        cardId: card.id,
        cardName: card.name,
        count: 0,
        uprightCount: 0,
        reversedCount: 0,
        reviewedCount: 0,
        latestQuestion: reading.question || '未命名手记',
        lastSeenAt,
        examples: [],
      };
      const orientation = slot.isReversed ? 'reversed' : 'upright';
      const slotLabel = reading.slotLabels?.[slotIndex] || slot.label || `第 ${slotIndex + 1} 张`;
      const text = getCardExampleText(reading, slotIndex);

      group.count += 1;
      group.uprightCount += orientation === 'upright' ? 1 : 0;
      group.reversedCount += orientation === 'reversed' ? 1 : 0;
      group.reviewedCount += isPublicReadingReviewed(reading) ? 1 : 0;
      if (lastSeenAt >= group.lastSeenAt) {
        group.latestQuestion = reading.question || '未命名手记';
      }
      group.lastSeenAt = Math.max(group.lastSeenAt, lastSeenAt);
      group.examples.push({
        id: `${reading.id}-${slotIndex}`,
        cardId: card.id,
        cardName: card.name,
        reading,
        slotLabel,
        orientation,
        text,
        lastSeenAt,
      });

      groups.set(card.name, group);
    });
  });

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      examples: group.examples.sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    }))
    .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt || a.cardName.localeCompare(b.cardName, 'zh-Hans-CN'));
};

const getReadingSlots = (reading: TarotReading) => {
  const slotLabels = reading.slotLabels?.filter(label => label?.trim()) || [];
  if (slotLabels.length > 0) return slotLabels;

  const cardLabels = (reading.cards || [])
    .map((card, index) => card.label?.trim() || card.position?.trim() || `第 ${index + 1} 张`);

  return cardLabels.length > 0 ? cardLabels : ['第一张'];
};

const getReadingLayout = (reading: TarotReading) => (
  reading.layoutType || SPREAD_TO_LAYOUT[reading.spread] || 'horizontal'
);

const getOfficialSpreadByName = (name: string) => (
  OFFICIAL_SPREADS.find(spread => spread.name === name)
);

export const buildPublicSpreadGroups = (readings: TarotReading[]): PublicSpreadGroup[] => {
  const groups = new Map<string, PublicSpreadGroup>();

  readings.forEach(reading => {
    const name = reading.spread?.trim();
    if (!name) return;

    const official = getOfficialSpreadByName(name);
    const slots = official?.slots || getReadingSlots(reading);
    const layout = official?.layout || getReadingLayout(reading);
    const slotPositions = official?.slotPositions || reading.slotPositions || [];
    const rotatedSlots = official?.rotatedSlots || reading.rotatedSlots || [];
    const key = `${name}|${layout}|${slots.join('｜')}`;
    const lastSeenAt = getReadingTime(reading);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        name,
        layout,
        slots,
        slotPositions,
        rotatedSlots,
        count: 1,
        reviewedCount: isPublicReadingReviewed(reading) ? 1 : 0,
        latestQuestion: reading.question || '未命名手记',
        lastSeenAt,
        latestReading: reading,
        definition: {
          name,
          layout,
          slots,
          slotPositions,
          rotatedSlots,
        },
        isOfficial: Boolean(official),
      });
      return;
    }

    existing.count += 1;
    existing.reviewedCount += isPublicReadingReviewed(reading) ? 1 : 0;
    if (lastSeenAt >= existing.lastSeenAt) {
      existing.latestQuestion = reading.question || '未命名手记';
      existing.latestReading = reading;
    }
    existing.lastSeenAt = Math.max(existing.lastSeenAt, lastSeenAt);
  });

  return Array.from(groups.values())
    .sort((a, b) => Number(a.isOfficial) - Number(b.isOfficial) || b.count - a.count || b.lastSeenAt - a.lastSeenAt);
};

export const isSpreadInLibrary = (
  spreads: SpreadDefinition[],
  definition: SpreadDefinition,
) => spreads.some(spread => (
  spread.name === definition.name
  || (
    spread.layout === definition.layout
    && spread.slots.length === definition.slots.length
    && spread.slots.every((slot, index) => slot === definition.slots[index])
  )
));
