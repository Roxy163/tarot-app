import { ReadingSlotData, SpreadDefinition } from '../types';
import { DEFAULT_CUSTOM_SPREAD_NAME } from '../constants';
import { adaptFreeLayoutSlotsToCanvas } from './freeLayout';
import { mapSlotsToSpread } from './readingSlotSync';

const LEGACY_DEFAULT_CUSTOM_SPREAD_NAME = '我的新牌阵';

export const normalizeLegacyCustomSpreadName = (name: string) => {
  const trimmedName = name.trim();
  const legacyCopyPrefix = `${LEGACY_DEFAULT_CUSTOM_SPREAD_NAME} 副本`;

  if (trimmedName === LEGACY_DEFAULT_CUSTOM_SPREAD_NAME) {
    return DEFAULT_CUSTOM_SPREAD_NAME;
  }

  if (trimmedName === legacyCopyPrefix || trimmedName.startsWith(`${legacyCopyPrefix} `)) {
    return `${DEFAULT_CUSTOM_SPREAD_NAME}${trimmedName.slice(LEGACY_DEFAULT_CUSTOM_SPREAD_NAME.length)}`;
  }

  return name;
};

const getUniqueMigratedSpreadName = (baseName: string, usedNames: Set<string>) => {
  if (!usedNames.has(baseName)) return baseName;

  let copyIndex = 2;
  let nextName = `${baseName} ${copyIndex}`;

  while (usedNames.has(nextName)) {
    copyIndex += 1;
    nextName = `${baseName} ${copyIndex}`;
  }

  return nextName;
};

const getNormalizedCustomSpreadEntries = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
) => {
  const officialNames = new Set(officialSpreads.map(spread => spread.name));
  const customSpreads = Array.from(
    (Array.isArray(savedSpreads) ? savedSpreads : [])
      .filter((spread): spread is SpreadDefinition => Boolean(
        spread?.name
        && spread.layout
        && Array.isArray(spread.slots)
        && !officialNames.has(spread.name),
      ))
      .reduce((byName, spread) => {
        if (byName.has(spread.name)) {
          byName.delete(spread.name);
        }
        byName.set(spread.name, spread);
        return byName;
      }, new Map<string, SpreadDefinition>())
      .values(),
  );
  const stableCustomNames = new Set(
    customSpreads
      .filter(spread => normalizeLegacyCustomSpreadName(spread.name) === spread.name)
      .map(spread => spread.name),
  );
  const usedNames = new Set(officialNames);
  const nameMap: Record<string, string> = {};
  const spreads = customSpreads.map(spread => {
    const migratedName = normalizeLegacyCustomSpreadName(spread.name);
    const namesToAvoid = migratedName === spread.name
      ? usedNames
      : new Set([...usedNames, ...stableCustomNames]);
    const uniqueName = getUniqueMigratedSpreadName(migratedName, namesToAvoid);

    usedNames.add(uniqueName);
    if (uniqueName !== spread.name) {
      nameMap[spread.name] = uniqueName;
    }

    return uniqueName === spread.name ? spread : { ...spread, name: uniqueName };
  });

  return { nameMap, spreads };
};

const getOfficialSpreadVisibilityMap = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
) => {
  const officialNames = new Set(officialSpreads.map(spread => spread.name));
  const visibilityByName = new Map<string, boolean>();

  (Array.isArray(savedSpreads) ? savedSpreads : []).forEach(spread => {
    if (!spread?.name || !officialNames.has(spread.name)) return;
    if (typeof spread.isHidden === 'boolean') {
      visibilityByName.set(spread.name, spread.isHidden);
    }
  });

  return visibilityByName;
};

export const applyOfficialSpreadVisibility = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
) => {
  const visibilityByName = getOfficialSpreadVisibilityMap(savedSpreads, officialSpreads);

  return officialSpreads.map(spread => (
    visibilityByName.get(spread.name)
      ? { ...spread, isHidden: true }
      : spread
  ));
};

export const getSafeCustomSpreadName = (
  currentSpreadName: string,
  requestedName: string,
  officialSpreads: SpreadDefinition[],
) => {
  const trimmedName = requestedName.trim();
  const isCurrentOfficial = officialSpreads.some(spread => spread.name === currentSpreadName);
  const suggestedName = isCurrentOfficial ? `${currentSpreadName} (自定义)` : currentSpreadName;
  const baseName = trimmedName || suggestedName;

  if (!baseName) return '';

  return officialSpreads.some(spread => spread.name === baseName)
    ? `${baseName} (自定义)`
    : baseName;
};

export const getUniqueSpreadName = (
  baseName: string,
  spreads: SpreadDefinition[],
  officialSpreads: SpreadDefinition[] = [],
) => {
  const trimmedName = baseName.trim();
  if (!trimmedName) return '';

  const existingNames = new Set([
    ...spreads.map(spread => spread.name),
    ...officialSpreads.map(spread => spread.name),
  ]);
  const firstCopyName = `${trimmedName} 副本`;

  if (!existingNames.has(firstCopyName)) {
    return firstCopyName;
  }

  let copyIndex = 2;
  let nextName = `${firstCopyName} ${copyIndex}`;

  while (existingNames.has(nextName)) {
    copyIndex += 1;
    nextName = `${firstCopyName} ${copyIndex}`;
  }

  return nextName;
};

export const createSpreadDefinitionFromSlots = ({
  name,
  layout,
  slots,
  gridCols,
  gridRows,
  freeLayoutSaveMode = 'original',
}: {
  name: string;
  layout: string;
  slots: ReadingSlotData[];
  gridCols: number;
  gridRows: number;
  freeLayoutSaveMode?: 'original' | 'adaptive';
}): SpreadDefinition => ({
  name,
  layout,
  slots: slots.map((slot, index) => slot.label || `第${index + 1}张`),
  slotPositions: slots.map(slot => slot.position || ''),
  rotatedSlots: slots
    .map((slot, index) => (slot.isRotated ? index : -1))
    .filter(index => index !== -1),
  gridCols,
  gridRows,
  freePositions: (layout === 'free' && freeLayoutSaveMode === 'adaptive' ? adaptFreeLayoutSlotsToCanvas(slots) : slots).map(slot => ({
    x: slot.x,
    y: slot.y,
    rotation: slot.rotation,
    scale: slot.scale,
  })),
});

export const upsertSpreadDefinition = (
  spreads: SpreadDefinition[],
  spread: SpreadDefinition,
) => {
  const existingIndex = spreads.findIndex(item => item.name === spread.name);

  if (existingIndex === -1) {
    return [...spreads, spread];
  }

  return [
    ...spreads.slice(0, existingIndex),
    spread,
    ...spreads.slice(existingIndex + 1).filter(item => item.name !== spread.name),
  ];
};

export const restoreOfficialSpread = (
  spreads: SpreadDefinition[],
  officialSpreads: SpreadDefinition[],
  name: string,
) => {
  const official = officialSpreads.find(spread => spread.name === name);
  if (!official) return { spreads, official: null };

  return {
    official,
    spreads: spreads.map(spread => (spread.name === name ? official : spread)),
  };
};

export const hideOfficialSpread = (
  spreads: SpreadDefinition[],
  officialSpreads: SpreadDefinition[],
  name: string,
) => {
  const official = officialSpreads.find(spread => spread.name === name);
  if (!official) return { spreads, official: null };

  const hiddenOfficial = { ...official, isHidden: true };
  const hasSpread = spreads.some(spread => spread.name === name);

  return {
    official: hiddenOfficial,
    spreads: hasSpread
      ? spreads.map(spread => (spread.name === name ? hiddenOfficial : spread))
      : [hiddenOfficial, ...spreads],
  };
};

export const restoreAllOfficialSpreads = (
  spreads: SpreadDefinition[],
  officialSpreads: SpreadDefinition[],
) => {
  return [...officialSpreads, ...normalizeLegacyCustomSpreads(spreads, officialSpreads)];
};

export const createBlankSlotsForSpread = (spread: SpreadDefinition) => (
  mapSlotsToSpread([], spread)
);

export const normalizeLegacyCustomSpreads = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
): SpreadDefinition[] => getNormalizedCustomSpreadEntries(savedSpreads, officialSpreads).spreads;

export const getLegacyCustomSpreadNameMap = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
) => getNormalizedCustomSpreadEntries(savedSpreads, officialSpreads).nameMap;

export const normalizeLegacyReadingSpreadNames = <T extends { spread?: string }>(
  readings: T[],
  spreadNameMap: Record<string, string> = {},
): T[] => (
  readings.map(reading => {
    if (!reading.spread) return reading;

    const spreadName = spreadNameMap[reading.spread] || normalizeLegacyCustomSpreadName(reading.spread);
    return spreadName === reading.spread ? reading : { ...reading, spread: spreadName };
  })
);

export const mergeOfficialSpreadsWithCustom = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
): SpreadDefinition[] => {
  const customSpreads = normalizeLegacyCustomSpreads(savedSpreads, officialSpreads);

  return [...applyOfficialSpreadVisibility(savedSpreads, officialSpreads), ...customSpreads];
};
