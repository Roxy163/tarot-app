import { ReadingSlotData } from '../types';

const GRID_POSITION_PATTERN = /col-start-(\d+) row-start-(\d+)/;

export interface GridPosition {
  col: number;
  row: number;
}

const clamp = (value: number, min: number, max: number) => (
  Math.max(min, Math.min(max, value))
);

export const parseGridPosition = (position?: string): GridPosition | null => {
  if (!position) return null;

  const match = position.match(GRID_POSITION_PATTERN);
  if (!match) return null;

  return {
    col: Number(match[1]),
    row: Number(match[2]),
  };
};

export const formatGridPosition = ({ col, row }: GridPosition) => (
  `col-start-${col} row-start-${row}`
);

export const shiftGridSlots = (
  slots: ReadingSlotData[],
  dx: number,
  dy: number,
  gridCols: number,
  gridRows: number,
) => (
  slots.map(slot => {
    const position = parseGridPosition(slot.position);
    if (!position) return slot;

    return {
      ...slot,
      position: formatGridPosition({
        col: clamp(position.col + dx, 1, gridCols),
        row: clamp(position.row + dy, 1, gridRows),
      }),
    };
  })
);

export const getGridBounds = (slots: ReadingSlotData[]) => {
  const positions = slots
    .map(slot => parseGridPosition(slot.position))
    .filter((position): position is GridPosition => Boolean(position));

  if (positions.length === 0) return null;

  return positions.reduce(
    (bounds, position) => ({
      minCol: Math.min(bounds.minCol, position.col),
      maxCol: Math.max(bounds.maxCol, position.col),
      minRow: Math.min(bounds.minRow, position.row),
      maxRow: Math.max(bounds.maxRow, position.row),
    }),
    {
      minCol: Infinity,
      maxCol: -Infinity,
      minRow: Infinity,
      maxRow: -Infinity,
    },
  );
};

export const getCenteringDelta = (
  slots: ReadingSlotData[],
  gridCols: number,
  gridRows: number,
) => {
  const bounds = getGridBounds(slots);
  if (!bounds) return null;

  const contentWidth = bounds.maxCol - bounds.minCol + 1;
  const contentHeight = bounds.maxRow - bounds.minRow + 1;
  const targetMinCol = Math.floor((gridCols - contentWidth) / 2) + 1;
  const targetMinRow = Math.floor((gridRows - contentHeight) / 2) + 1;
  const dx = targetMinCol - bounds.minCol;
  const dy = targetMinRow - bounds.minRow;

  return { dx, dy };
};

export const centerGridSlots = (
  slots: ReadingSlotData[],
  gridCols: number,
  gridRows: number,
) => {
  const delta = getCenteringDelta(slots, gridCols, gridRows);
  if (!delta || (delta.dx === 0 && delta.dy === 0)) return slots;

  return shiftGridSlots(slots, delta.dx, delta.dy, gridCols, gridRows);
};
