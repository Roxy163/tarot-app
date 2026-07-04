import { OFFICIAL_SPREADS } from '../constants';
import { CardKeywordMemory, CardKeywordMemoryEntry, SpreadDefinition, TarotCardMetadata, TarotReading } from '../types';
import { getReadingVersionTime, pickNewestReading } from './readingCloudSync';
import { normalizeLegacyCustomSpreads } from './spreadPersistence';

export const getPersistableReadings = (readings: TarotReading[]) => (
  readings.filter(reading => Boolean(reading?.id) && !reading.isExample)
);

export const mergeReadingsForSignedInUser = (
  uid: string,
  readingSources: TarotReading[][],
) => {
  const readingsById = new Map<string, TarotReading>();

  readingSources.flatMap(getPersistableReadings).forEach(reading => {
    const previous = readingsById.get(reading.id);
    const newest = pickNewestReading(reading, previous);
    readingsById.set(reading.id, {
      ...newest,
      userId: uid,
    });
  });

  return Array.from(readingsById.values()).sort((a, b) => (
    getReadingVersionTime(b) - getReadingVersionTime(a)
  ));
};

export const mergeSpreadSources = (
  spreadSources: SpreadDefinition[][],
  officialSpreads: SpreadDefinition[] = OFFICIAL_SPREADS,
) => {
  const customByName = new Map<string, SpreadDefinition>();

  spreadSources.forEach(source => {
    normalizeLegacyCustomSpreads(source, officialSpreads).forEach(spread => {
      customByName.set(spread.name, spread);
    });
  });

  return [...officialSpreads, ...customByName.values()];
};

const mergeKeywordLists = (sources: Array<string[] | undefined>) => (
  Array.from(new Set(sources.flatMap(keywords => keywords || []).map(keyword => keyword.trim()).filter(Boolean)))
);

export const mergeCardMetadataSources = (
  metadataSources: TarotCardMetadata[][],
) => {
  const metadataById = new Map<string, TarotCardMetadata>();

  metadataSources.flat().forEach(card => {
    if (!card?.id) return;

    const previous = metadataById.get(card.id);
    if (!previous) {
      metadataById.set(card.id, { ...card, astrology: card.astrology ? { ...card.astrology } : undefined });
      return;
    }

    metadataById.set(card.id, {
      ...previous,
      ...card,
      astrology: {
        ...previous.astrology,
        ...card.astrology,
      },
      keywords: mergeKeywordLists([previous.keywords, card.keywords]),
    });
  });

  return Array.from(metadataById.values());
};

const getEarlierDate = (left?: string, right?: string) => {
  if (!left) return right || new Date(0).toISOString();
  if (!right) return left;
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
};

const getLaterDate = (left?: string, right?: string) => {
  if (!left) return right || new Date(0).toISOString();
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
};

const mergeKeywordMemoryEntry = (
  previous: CardKeywordMemoryEntry | undefined,
  incoming: CardKeywordMemoryEntry,
): CardKeywordMemoryEntry => {
  if (!previous) {
    return {
      ...incoming,
      readingIds: [...(incoming.readingIds || [])],
      examples: [...(incoming.examples || [])],
    };
  }

  const readingIds = Array.from(new Set([...(previous.readingIds || []), ...(incoming.readingIds || [])]));
  const examples = Array.from(new Set([...(previous.examples || []), ...(incoming.examples || [])])).slice(0, 3);

  return {
    ...previous,
    ...incoming,
    count: Math.max(previous.count, incoming.count, readingIds.length),
    readingIds,
    examples,
    createdAt: getEarlierDate(previous.createdAt, incoming.createdAt),
    updatedAt: getLaterDate(previous.updatedAt, incoming.updatedAt),
  };
};

export const mergeKeywordMemorySources = (
  memorySources: CardKeywordMemory[][],
) => {
  const memoryByCard = new Map<string, CardKeywordMemory>();

  memorySources.flat().forEach(memory => {
    if (!memory?.cardName) return;

    const previous = memoryByCard.get(memory.cardName);
    const keywordsByName = new Map<string, CardKeywordMemoryEntry>();

    (previous?.keywords || []).forEach(entry => {
      keywordsByName.set(entry.keyword, {
        ...entry,
        readingIds: [...(entry.readingIds || [])],
        examples: [...(entry.examples || [])],
      });
    });

    (memory.keywords || []).forEach(entry => {
      const keyword = (entry.keyword || '').trim();
      if (!keyword) return;
      keywordsByName.set(keyword, mergeKeywordMemoryEntry(keywordsByName.get(keyword), { ...entry, keyword }));
    });

    const keywords = Array.from(keywordsByName.values()).sort((a, b) => (
      b.count - a.count || b.updatedAt.localeCompare(a.updatedAt) || a.keyword.localeCompare(b.keyword)
    ));

    memoryByCard.set(memory.cardName, {
      cardName: memory.cardName,
      keywords,
      updatedAt: getLaterDate(previous?.updatedAt, memory.updatedAt),
    });
  });

  return Array.from(memoryByCard.values()).sort((a, b) => a.cardName.localeCompare(b.cardName));
};
