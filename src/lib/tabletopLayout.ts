import { OFFICIAL_SPREADS } from '../constants';
import type { ReadingSlotData } from '../types';
import { parseGridPosition } from './spreadGridLayout';

// Preserve the original silhouettes with a single scale and translation.
// Do not redistribute individual rows to make room for larger cards.
const positions = {
  yearly: [
    [7, 50], [19, 70], [34, 82], [50, 86], [66, 81], [81, 70],
    [93, 50], [81, 30], [66, 19], [50, 14], [34, 19], [19, 30], [50, 49],
  ],
  celtic: [
    [38, 50], [38, 50], [38, 78], [20, 50], [38, 22],
    [56, 50], [78, 88], [78, 63], [78, 38], [78, 13],
  ],
};

const fitTabletop = (
  original: { x: number; y: number }[],
  referenceCardWidth: number,
  availableWidth: number,
  viewportHeight = 800,
) => {
  const minX = Math.min(...original.map(p => p.x));
  const minY = Math.min(...original.map(p => p.y));
  const spanX = Math.max(...original.map(p => p.x)) - minX;
  const spanY = Math.max(...original.map(p => p.y)) - minY;
  const maxHeight = Math.min(380, Math.max(120, viewportHeight * 0.52));
  const width = Math.max(120, availableWidth || 320);
  const padding = 8;
  const controlSpace = 20;
  const scale = Math.min(
    1,
    spanX ? (width - 2 * padding - 44) / spanX : 1,
    (width - 2 * padding) / (spanX + referenceCardWidth),
    spanY ? (maxHeight - 2 * padding - controlSpace - 56) / spanY : 1,
    (maxHeight - 2 * padding - controlSpace) / (spanY + referenceCardWidth * 1.75),
  );
  const cardWidth = referenceCardWidth * scale;
  const cardHeight = cardWidth * 1.75;
  // Keep a 44px hit area around a smaller visible card on narrow screens.
  const targetWidth = Math.max(44, cardWidth);
  const targetHeight = Math.max(56, cardHeight);
  return {
    width: spanX * scale + targetWidth + 2 * padding,
    height: spanY * scale + targetHeight + 2 * padding + controlSpace,
    cardWidth,
    cardHeight,
    points: original.map(p => ({
      x: (p.x - minX) * scale + targetWidth / 2 + padding,
      y: (p.y - minY) * scale + targetHeight / 2 + padding,
    })),
  };
};

export const getTabletopLayout = (
  layout: 'celtic' | 'yearly',
  availableWidth: number,
  viewportHeight = 800,
) => {
  const referenceHeight = layout === 'yearly' ? 360 : 400;
  const original = positions[layout].map(([x, y]) => ({ x: x * 4.8, y: y * referenceHeight / 100 }));
  return fitTabletop(original, 50, availableWidth, viewportHeight);
};

export const getOfficialTabletopLayout = (
  spreadName: string,
  layoutType: string,
  slots: ReadingSlotData[],
  availableWidth: number,
  viewportHeight: number,
) => {
  const official = OFFICIAL_SPREADS.find(spread => spread.name === spreadName);
  // A renamed, edited, or free-layout spread must retain its own saved geometry.
  if (!official || layoutType !== official.layout || slots.length !== official.slots.length
    || slots.some((slot, i) => slot.position && slot.position !== official.slotPositions[i])) return null;
  if (layoutType === 'yearly' || layoutType === 'celtic') {
    return getTabletopLayout(layoutType, availableWidth, viewportHeight);
  }
  const cardWidth = slots.length === 1 ? 80 : slots.length <= 3 ? 72 : 60;
  const points = official.slotPositions.map(position => {
    const grid = parseGridPosition(position)!;
    return { x: grid.col * (cardWidth + 16), y: grid.row * (cardWidth * 1.75 + 24) };
  });
  return fitTabletop(points, cardWidth, availableWidth, viewportHeight);
};
