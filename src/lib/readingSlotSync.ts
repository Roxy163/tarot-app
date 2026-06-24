import { ReadingSlotData, SpreadDefinition } from '../types';

export const mapSlotsToSpread = (
  currentSlots: ReadingSlotData[],
  spreadDef: SpreadDefinition,
): ReadingSlotData[] => (
  spreadDef.slots.map((label, index) => ({
    name: currentSlots[index]?.name || '',
    isReversed: currentSlots[index]?.isReversed || false,
    position: spreadDef.slotPositions?.[index] || '',
    label,
    isRotated: spreadDef.rotatedSlots?.includes(index) || false,
  }))
);

export const normalizeInterpretationsForSlots = (
  currentInterpretations: string[],
  slotCount: number,
) => {
  const nextInterpretations = [...currentInterpretations];

  while (nextInterpretations.length < slotCount) {
    nextInterpretations.push('');
  }

  return nextInterpretations.slice(0, slotCount);
};
