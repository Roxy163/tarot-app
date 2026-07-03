import { OFFICIAL_SPREADS } from '../constants';
import { SpreadDefinition, TarotReading } from '../types';
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
