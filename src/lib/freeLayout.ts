import { ReadingSlotData } from '../types';

export const FREE_LAYOUT_CANVAS_WIDTH = 640;
export const FREE_LAYOUT_CANVAS_HEIGHT = 460;
export const FREE_LAYOUT_SLOT_WIDTH = 80;
export const FREE_LAYOUT_SLOT_HEIGHT = 140;
export const FREE_LAYOUT_GRID_SIZE = 10;
export const FREE_LAYOUT_ADAPTIVE_PADDING = 56;
export const FREE_LAYOUT_VIEWPORT_WIDTH = 640;
export const FREE_LAYOUT_VIEWPORT_HEIGHT = 460;

export const snapFreeLayoutValue = (value: number, enabled = true) => (
  enabled ? Math.round(value / FREE_LAYOUT_GRID_SIZE) * FREE_LAYOUT_GRID_SIZE : value
);

export const getBoundedFreeLayoutPosition = ({
  x,
  y,
  scale: _scale = 1,
  canvasWidth: _canvasWidth = FREE_LAYOUT_CANVAS_WIDTH,
  canvasHeight: _canvasHeight = FREE_LAYOUT_CANVAS_HEIGHT,
}: {
  x: number;
  y: number;
  scale?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}) => ({
  x,
  y,
});

export const createFreeLayoutSlotAt = ({
  index,
  x,
  y,
  canvasWidth = FREE_LAYOUT_CANVAS_WIDTH,
  canvasHeight = FREE_LAYOUT_CANVAS_HEIGHT,
  snap = true,
}: {
  index: number;
  x: number;
  y: number;
  canvasWidth?: number;
  canvasHeight?: number;
  snap?: boolean;
}): ReadingSlotData => {
  const snappedX = snapFreeLayoutValue(x - FREE_LAYOUT_SLOT_WIDTH / 2, snap);
  const snappedY = snapFreeLayoutValue(y - FREE_LAYOUT_SLOT_HEIGHT / 2, snap);
  const bounded = getBoundedFreeLayoutPosition({
    x: snappedX,
    y: snappedY,
    canvasWidth,
    canvasHeight,
  });

  return {
    name: '',
    isReversed: false,
    label: `位置${index + 1}`,
    x: bounded.x,
    y: bounded.y,
    rotation: 0,
    scale: 1,
  };
};

const getDefaultFreePosition = (index: number, total: number) => {
  const spacing = FREE_LAYOUT_SLOT_WIDTH + 28;
  const rowCapacity = Math.max(1, Math.floor((FREE_LAYOUT_CANVAS_WIDTH - 80) / spacing));
  const visibleTotal = Math.max(total, 1);
  const row = Math.floor(index / rowCapacity);
  const col = index % rowCapacity;
  const rowCount = Math.ceil(visibleTotal / rowCapacity);
  const itemsInRow = row === rowCount - 1
    ? visibleTotal - row * rowCapacity
    : rowCapacity;
  const rowWidth = (itemsInRow - 1) * spacing;
  const startX = (FREE_LAYOUT_CANVAS_WIDTH - rowWidth - FREE_LAYOUT_SLOT_WIDTH) / 2;
  const startY = Math.max(48, (FREE_LAYOUT_CANVAS_HEIGHT - rowCount * (FREE_LAYOUT_SLOT_HEIGHT + 32)) / 2);

  return {
    x: startX + col * spacing,
    y: startY + row * (FREE_LAYOUT_SLOT_HEIGHT + 32),
  };
};

export const getFreeLayoutBounds = (slots: ReadingSlotData[]) => {
  if (slots.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: FREE_LAYOUT_SLOT_WIDTH,
      maxY: FREE_LAYOUT_SLOT_HEIGHT,
      width: FREE_LAYOUT_SLOT_WIDTH,
      height: FREE_LAYOUT_SLOT_HEIGHT,
    };
  }

  const edges = slots.reduce((result, slot) => {
    const scale = slot.scale || 1;
    const x = slot.x || 0;
    const y = slot.y || 0;

    return {
      minX: Math.min(result.minX, x),
      minY: Math.min(result.minY, y),
      maxX: Math.max(result.maxX, x + FREE_LAYOUT_SLOT_WIDTH * scale),
      maxY: Math.max(result.maxY, y + FREE_LAYOUT_SLOT_HEIGHT * scale),
    };
  }, {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });

  return {
    ...edges,
    width: Math.max(1, edges.maxX - edges.minX),
    height: Math.max(1, edges.maxY - edges.minY),
  };
};

export const getFreeLayoutDisplayFrame = (
  slots: ReadingSlotData[],
  padding = FREE_LAYOUT_ADAPTIVE_PADDING,
) => {
  const bounds = getFreeLayoutBounds(slots);
  const offsetX = bounds.minX < 0 ? padding - bounds.minX : 0;
  const offsetY = bounds.minY < 0 ? padding - bounds.minY : 0;
  const width = Math.max(
    FREE_LAYOUT_VIEWPORT_WIDTH,
    bounds.maxX + offsetX + padding,
  );
  const height = Math.max(
    FREE_LAYOUT_VIEWPORT_HEIGHT,
    bounds.maxY + offsetY + padding,
  );

  return {
    width,
    height,
    offsetX,
    offsetY,
  };
};

export const ensureFreeLayoutSlots = (slots: ReadingSlotData[]) => (
  slots.map((slot, index) => {
    const fallback = getDefaultFreePosition(index, slots.length);

    return {
      ...slot,
      position: '',
      x: typeof slot.x === 'number' ? slot.x : fallback.x,
      y: typeof slot.y === 'number' ? slot.y : fallback.y,
      rotation: typeof slot.rotation === 'number' ? slot.rotation : 0,
      scale: typeof slot.scale === 'number' ? slot.scale : 1,
    };
  })
);

export const adaptFreeLayoutSlotsToCanvas = (
  slots: ReadingSlotData[],
  canvasWidth = FREE_LAYOUT_CANVAS_WIDTH,
  canvasHeight = FREE_LAYOUT_CANVAS_HEIGHT,
) => {
  if (slots.length === 0) return [];

  const bounds = getFreeLayoutBounds(slots);
  const width = bounds.width;
  const height = bounds.height;
  const availableWidth = Math.max(1, canvasWidth - FREE_LAYOUT_ADAPTIVE_PADDING * 2);
  const availableHeight = Math.max(1, canvasHeight - FREE_LAYOUT_ADAPTIVE_PADDING * 2);
  const adaptiveScale = Math.min(1, availableWidth / width, availableHeight / height);
  const fittedWidth = width * adaptiveScale;
  const fittedHeight = height * adaptiveScale;
  const offsetX = (canvasWidth - fittedWidth) / 2;
  const offsetY = (canvasHeight - fittedHeight) / 2;

  return slots.map(slot => {
    const scale = slot.scale || 1;

    return {
      ...slot,
      x: offsetX + ((slot.x || 0) - bounds.minX) * adaptiveScale,
      y: offsetY + ((slot.y || 0) - bounds.minY) * adaptiveScale,
      scale: scale * adaptiveScale,
    };
  });
};
