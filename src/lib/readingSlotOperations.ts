import { ReadingSlotData } from '../types';

export const HISTORY_LIMIT = 20;

export interface GridSlotPositionResult {
  slots: ReadingSlotData[];
  activeSlotIndex: number;
  shouldConvertHorizontalLayout: boolean;
  changed: boolean;
}

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
  slots.length > 1 && index >= 0 && index < slots.length
    ? slots.filter((_, slotIndex) => slotIndex !== index)
    : slots
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
    || oldIndex === newIndex
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

export const applyGridSlotPositionClick = (
  slots: ReadingSlotData[],
  activeSlotIndex: number,
  col: number,
  row: number,
  layoutType: string,
): GridSlotPositionResult => {
  const position = `col-start-${col} row-start-${row}`;
  const slotsAtPosition = slots
    .map((slot, index) => (slot.position === position ? index : -1))
    .filter(index => index !== -1);

  if (slotsAtPosition.length > 0) {
    if (!slotsAtPosition.includes(activeSlotIndex)) {
      return {
        slots,
        activeSlotIndex: slotsAtPosition[0],
        shouldConvertHorizontalLayout: false,
        changed: false,
      };
    }

    if (slotsAtPosition.length > 1) {
      const currentLocalIndex = slotsAtPosition.indexOf(activeSlotIndex);
      const nextLocalIndex = (currentLocalIndex + 1) % slotsAtPosition.length;
      return {
        slots,
        activeSlotIndex: slotsAtPosition[nextLocalIndex],
        shouldConvertHorizontalLayout: false,
        changed: false,
      };
    }

    const nextSlots = [
      ...slots,
      {
        name: '',
        isReversed: false,
        position,
        label: `叠放牌 ${slots.length + 1}`,
      },
    ];

    return {
      slots: nextSlots,
      activeSlotIndex: nextSlots.length - 1,
      shouldConvertHorizontalLayout: false,
      changed: true,
    };
  }

  const nextSlots = [...slots];
  if (nextSlots.length === 0) {
    nextSlots.push({ name: '', isReversed: false, position, label: '牌 1' });
  } else if (nextSlots.length === 1 && !nextSlots[0].position) {
    nextSlots[0] = { ...nextSlots[0], position, label: '牌 1' };
  } else {
    nextSlots.push({
      name: '',
      isReversed: false,
      position,
      label: `牌 ${nextSlots.length + 1}`,
    });
  }

  return {
    slots: nextSlots,
    activeSlotIndex: nextSlots.length - 1,
    shouldConvertHorizontalLayout: layoutType === 'horizontal',
    changed: true,
  };
};
