import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import type { ReadingReviewLayout, TarotReading } from '../types';
import { getOfficialTabletopLayout } from './tabletopLayout';
import { parseGridPosition } from './spreadGridLayout';

// A reading owns its geometry. Never replace saved coordinates with a newer
// spread definition, or write the display transform back into the reading.
export function getReadingReviewLayout(reading: TarotReading, availableWidth: number, viewportHeight: number): ReadingReviewLayout {
  const official = OFFICIAL_SPREADS.find(spread => spread.name === reading.spread);
  const hasFreeCoordinates = reading.cards.some(card => typeof card.x === 'number' || typeof card.y === 'number');
  const savedLayout = reading.layoutType === 'celtic-cross' ? 'celtic' : reading.layoutType;
  const layoutType = savedLayout || (hasFreeCoordinates ? 'free' : official?.layout) || 'horizontal';
  const template = LAYOUT_TEMPLATES[layoutType] || LAYOUT_TEMPLATES.horizontal;
  const slots = reading.cards.map((card, index) => ({
    ...card,
    label: reading.slotLabels?.[index] || card.label || official?.slots[index] || `第 ${index + 1} 张`,
    position: reading.slotPositions?.[index] || card.position || official?.slotPositions[index] || template.itemClasses[index] || '',
    isRotated: reading.rotatedSlots?.includes(index) || card.isRotated || (reading.rotatedSlots === undefined && card.isRotated === undefined && official?.rotatedSlots?.includes(index)) || false,
  }));
  const alteredRotation = official && slots.some((slot, index) => slot.isRotated !== Boolean(official.rotatedSlots?.includes(index)));
  const tabletop = !alteredRotation && getOfficialTabletopLayout(reading.spread, layoutType, slots, availableWidth, viewportHeight);
  if (tabletop) return {
    width: tabletop.width,
    height: tabletop.height,
    official: true,
    cards: slots.map((slot, index) => ({
      slot, x: tabletop.points[index].x, y: tabletop.points[index].y,
      width: tabletop.cardWidth, height: tabletop.cardHeight,
      rotation: slot.isRotated || (layoutType === 'celtic' && index === 1) ? 90 : 0,
    })),
  };

  const small = slots.length > 3;
  const cardWidth = small ? 64 : 80;
  const gap = small ? 8 : 12;
  const raw = slots.map((slot, index) => {
    const grid = parseGridPosition(slot.position);
    const free = layoutType === 'free';
    const width = free ? 80 * (slot.scale || 1) : cardWidth;
    const height = width * 1.75;
    // Free-layout x/y are the untransformed top-left of an 80 x 140 card;
    // its scale and rotation are applied around that card's center.
    const x = free ? (slot.x ?? 0) + 40 : (grid?.col ?? index + 1) * (cardWidth + gap);
    const y = free ? (slot.y ?? 0) + 70 : (grid?.row ?? 1) * (cardWidth * 1.75 + gap);
    const rotation = free ? slot.rotation ?? (slot.isRotated ? 90 : 0) : slot.isRotated ? 90 : 0;
    const radians = rotation * Math.PI / 180;
    const boundsWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
    const boundsHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
    return { slot, x, y, width, height, rotation, boundsWidth, boundsHeight };
  });
  // Crop empty outer rows/columns, including positive offsets in saved layouts.
  const left = raw.length ? Math.min(...raw.map(card => card.x - card.boundsWidth / 2)) : 0;
  const top = raw.length ? Math.min(...raw.map(card => card.y - card.boundsHeight / 2)) : 0;
  const right = Math.max(left + 1, ...raw.map(card => card.x + card.boundsWidth / 2));
  const bottom = Math.max(top + 1, ...raw.map(card => card.y + card.boundsHeight / 2));
  const maxHeight = Math.min(380, Math.max(120, viewportHeight * 0.52));
  // Leave space for 44px hit areas even when the visible cards become small.
  const scale = Math.min(1, Math.max(1, availableWidth - 48) / (right - left), (maxHeight - 48) / (bottom - top));
  return {
    width: (right - left) * scale + 48,
    height: (bottom - top) * scale + 48,
    official: false,
    cards: raw.map(card => ({
      slot: card.slot, x: (card.x - left) * scale + 24, y: (card.y - top) * scale + 24,
      width: card.width * scale, height: card.height * scale, rotation: card.rotation,
    })),
  };
}
