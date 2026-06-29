import { ReadingSlotData, SpreadDefinition } from '../types';
import { adaptFreeLayoutSlotsToCanvas } from './freeLayout';
import { mapSlotsToSpread } from './readingSlotSync';

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

  const nextSpreads = [...spreads];
  nextSpreads[existingIndex] = spread;
  return nextSpreads;
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

export const restoreAllOfficialSpreads = (
  spreads: SpreadDefinition[],
  officialSpreads: SpreadDefinition[],
) => {
  return mergeOfficialSpreadsWithCustom(spreads, officialSpreads);
};

export const createBlankSlotsForSpread = (spread: SpreadDefinition) => (
  mapSlotsToSpread([], spread)
);

export const mergeOfficialSpreadsWithCustom = (
  savedSpreads: Array<Partial<SpreadDefinition> | null | undefined> | null | undefined,
  officialSpreads: SpreadDefinition[],
): SpreadDefinition[] => {
  const officialNames = new Set(officialSpreads.map(spread => spread.name));
  const customSpreads = (Array.isArray(savedSpreads) ? savedSpreads : [])
    .filter((spread): spread is SpreadDefinition => Boolean(
      spread?.name
      && spread.layout
      && Array.isArray(spread.slots)
      && !officialNames.has(spread.name),
    ));

  return [...officialSpreads, ...customSpreads];
};
