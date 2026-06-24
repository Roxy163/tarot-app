import { ReadingSlotData } from '../types';

export const HISTORY_LIMIT = 20;

export const appendSlotHistory = (
  history: ReadingSlotData[][],
  currentSlots: ReadingSlotData[],
) => [...history, currentSlots].slice(-HISTORY_LIMIT);

export const selectCardForSlot = (
  slots: ReadingSlotData[],
  index: number,
  cardName: string,
  isReversed: boolean,
) => {
  if (!slots[index]) return slots;

  const nextSlots = [...slots];
  nextSlots[index] = { ...nextSlots[index], name: cardName, isReversed };
  return nextSlots;
};

export const toggleSlotReversal = (
  slots: ReadingSlotData[],
  index: number,
) => {
  if (!slots[index]) return slots;

  const nextSlots = [...slots];
  nextSlots[index] = { ...nextSlots[index], isReversed: !nextSlots[index].isReversed };
  return nextSlots;
};

export const addReadingSlot = (slots: ReadingSlotData[]) => [
  ...slots,
  { name: '', isReversed: false, label: `第${slots.length + 1}张` },
];

export const removeReadingSlot = (
  slots: ReadingSlotData[],
  index: number,
) => (
  slots.length > 1 ? slots.filter((_, slotIndex) => slotIndex !== index) : slots
);

export const swapReadingSlots = (
  slots: ReadingSlotData[],
  oldIndex: number,
  newIndex: number,
) => {
  if (
    oldIndex < 0
    || oldIndex >= slots.length
    || newIndex < 0
    || newIndex >= slots.length
  ) {
    return slots;
  }

  const nextSlots = [...slots];
  const previousSlot = nextSlots[oldIndex];
  nextSlots[oldIndex] = nextSlots[newIndex];
  nextSlots[newIndex] = previousSlot;
  return nextSlots;
};

export const updateReadingSlotLabel = (
  slots: ReadingSlotData[],
  index: number,
  label: string,
) => {
  if (!slots[index]) return slots;

  const nextSlots = [...slots];
  nextSlots[index] = { ...nextSlots[index], label };
  return nextSlots;
};
