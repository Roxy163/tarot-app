import { TarotReading } from '../types';

export interface UserReadingSyncPlan {
  mergedReadings: TarotReading[];
  readingsToWrite: TarotReading[];
  readingsToDelete: TarotReading[];
  publicReadingsToSave: TarotReading[];
  publicReadingIdsToDelete: string[];
}

const normalizeForComparison = (reading: TarotReading) => JSON.stringify(JSON.parse(JSON.stringify(reading)));

export const getReadingVersionTime = (reading: TarotReading) => (
  new Date(reading.updatedAt || reading.date || reading.readingDate || 0).getTime()
);

export const pickNewestReading = (incoming: TarotReading, previous?: TarotReading) => {
  if (!previous) return incoming;
  return getReadingVersionTime(previous) > getReadingVersionTime(incoming) ? previous : incoming;
};

export const hasReadingChanged = (incoming: TarotReading, previous?: TarotReading) => (
  !previous || normalizeForComparison(incoming) !== normalizeForComparison(previous)
);

export const createUserReadingSyncPlan = (
  uid: string,
  incomingReadings: TarotReading[],
  previousReadings: TarotReading[],
): UserReadingSyncPlan => {
  const previousReadingsById = new Map<string, TarotReading>(
    previousReadings.map(reading => [reading.id, reading]),
  );
  const ownedReadings = incomingReadings.map(reading => ({ ...reading, userId: uid }));
  const incomingIds = new Set(ownedReadings.map(reading => reading.id));
  const mergedReadings = ownedReadings.map(reading => (
    pickNewestReading(reading, previousReadingsById.get(reading.id))
  ));
  const readingsToDelete = previousReadings.filter(reading => !incomingIds.has(reading.id));
  const publicReadingIdsToDelete = Array.from(new Set([
    ...mergedReadings
      .filter(reading => !reading.isPublic && previousReadingsById.get(reading.id)?.isPublic === true)
      .map(reading => reading.id),
    ...readingsToDelete
      .filter(reading => reading.isPublic)
      .map(reading => reading.id),
  ]));

  return {
    mergedReadings,
    readingsToWrite: mergedReadings.filter(reading => (
      hasReadingChanged(reading, previousReadingsById.get(reading.id))
    )),
    readingsToDelete,
    // Keep public saves idempotent so a missing public mirror can self-heal on the next sync.
    publicReadingsToSave: mergedReadings.filter(reading => reading.isPublic),
    publicReadingIdsToDelete,
  };
};
