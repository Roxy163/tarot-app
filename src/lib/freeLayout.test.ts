import { describe, expect, it } from 'vitest';
import { ReadingSlotData } from '../types';
import {
  FREE_LAYOUT_CANVAS_HEIGHT,
  FREE_LAYOUT_CANVAS_WIDTH,
  FREE_LAYOUT_SLOT_HEIGHT,
  FREE_LAYOUT_SLOT_WIDTH,
  adaptFreeLayoutSlotsToCanvas,
  convertGridSlotsToFreeLayout,
  createFreeLayoutSlotAt,
  ensureFreeLayoutSlots,
  getBoundedFreeLayoutPosition,
  getFreeLayoutBounds,
  getFreeLayoutDisplayFrame,
  snapFreeLayoutValue,
} from './freeLayout';

describe('freeLayout', () => {
  it('adds default free coordinates without overwriting existing transforms', () => {
    const slots: ReadingSlotData[] = [
      { name: '', isReversed: false, label: '核心', position: 'col-start-1 row-start-1' },
      { name: '', isReversed: false, label: '建议', x: 120, y: 90, rotation: 15, scale: 1.2 },
    ];

    const result = ensureFreeLayoutSlots(slots);

    expect(result[0].position).toBe('');
    expect(result[0].x).toEqual(expect.any(Number));
    expect(result[0].y).toEqual(expect.any(Number));
    expect(result[0].rotation).toBe(0);
    expect(result[0].scale).toBe(1);
    expect(result[1]).toEqual({
      ...slots[1],
      position: '',
    });
  });

  it('creates a new free slot centered on the requested point', () => {
    expect(createFreeLayoutSlotAt({ index: 2, x: 200, y: 200, snap: false })).toMatchObject({
      name: '',
      isReversed: false,
      label: '位置3',
      x: 160,
      y: 130,
      rotation: 0,
      scale: 1,
    });
  });

  it('snaps and preserves unlimited free layout coordinates', () => {
    expect(snapFreeLayoutValue(46, true)).toBe(50);
    expect(snapFreeLayoutValue(46, false)).toBe(46);
    expect(getBoundedFreeLayoutPosition({ x: -50, y: 9999 })).toEqual({
      x: -50,
      y: 9999,
    });
  });

  it('expands the display frame around far or negative free slots', () => {
    const frame = getFreeLayoutDisplayFrame([
      { name: '', isReversed: false, label: '左上', x: -180, y: -90, scale: 1 },
      { name: '', isReversed: false, label: '远方', x: 980, y: 540, scale: 1.2 },
    ]);

    expect(frame.width).toBeGreaterThan(FREE_LAYOUT_CANVAS_WIDTH);
    expect(frame.height).toBeGreaterThan(FREE_LAYOUT_CANVAS_HEIGHT);
    expect(-180 + frame.offsetX).toBeGreaterThanOrEqual(0);
    expect(-90 + frame.offsetY).toBeGreaterThanOrEqual(0);
    expect(980 + frame.offsetX + FREE_LAYOUT_SLOT_WIDTH * 1.2).toBeLessThanOrEqual(frame.width);
    expect(540 + frame.offsetY + FREE_LAYOUT_SLOT_HEIGHT * 1.2).toBeLessThanOrEqual(frame.height);
  });

  it('keeps a positive-only far free spread visible in its display frame', () => {
    const frame = getFreeLayoutDisplayFrame([
      { name: '', isReversed: false, label: '远处', x: 980, y: 540, scale: 1 },
    ]);

    expect(frame.offsetX).toBe(0);
    expect(frame.offsetY).toBe(0);
    expect(980 + frame.offsetX).toBeGreaterThanOrEqual(0);
    expect(540 + frame.offsetY).toBeGreaterThanOrEqual(0);
    expect(980 + frame.offsetX + FREE_LAYOUT_SLOT_WIDTH).toBeLessThanOrEqual(frame.width);
    expect(540 + frame.offsetY + FREE_LAYOUT_SLOT_HEIGHT).toBeLessThanOrEqual(frame.height);
  });

  it('preserves in-canvas free positions without adding display offsets', () => {
    const frame = getFreeLayoutDisplayFrame([
      { name: '', isReversed: false, label: '核心', x: 120, y: 160, scale: 1 },
    ]);

    expect(frame.offsetX).toBe(0);
    expect(frame.offsetY).toBe(0);
    expect(frame.width).toBe(FREE_LAYOUT_CANVAS_WIDTH);
    expect(frame.height).toBe(FREE_LAYOUT_CANVAS_HEIGHT);
  });

  it('can adapt an oversized free spread into the default canvas', () => {
    const result = adaptFreeLayoutSlotsToCanvas([
      { name: '', isReversed: false, label: '左上', x: -200, y: 0, scale: 1.4 },
      { name: '', isReversed: false, label: '右下', x: 900, y: 500, scale: 1.4 },
    ]);

    expect(Math.min(...result.map(slot => slot.x || 0))).toBeGreaterThanOrEqual(0);
    expect(Math.min(...result.map(slot => slot.y || 0))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...result.map(slot => (slot.x || 0) + FREE_LAYOUT_SLOT_WIDTH * (slot.scale || 1)))).toBeLessThanOrEqual(FREE_LAYOUT_CANVAS_WIDTH);
    expect(Math.max(...result.map(slot => (slot.y || 0) + FREE_LAYOUT_SLOT_HEIGHT * (slot.scale || 1)))).toBeLessThanOrEqual(FREE_LAYOUT_CANVAS_HEIGHT);
    expect(result[0].scale).toBeLessThan(1.4);
  });

  it('converts official grid positions into centered free layout coordinates', () => {
    const result = convertGridSlotsToFreeLayout([
      { name: '', isReversed: false, label: '目标', position: 'col-start-2 row-start-1' },
      { name: '', isReversed: false, label: '现状', position: 'col-start-1 row-start-2' },
      { name: '', isReversed: false, label: '挑战', position: 'col-start-1 row-start-2', isRotated: true },
      { name: '', isReversed: false, label: '未来', position: 'col-start-3 row-start-2' },
    ], 'celtic');

    expect(result.every(slot => slot.position === '')).toBe(true);
    expect(result[0].x).toBeGreaterThan(result[1].x || 0);
    expect(result[3].x).toBeGreaterThan(result[0].x || 0);
    expect(result[2]).toMatchObject({
      x: result[1].x,
      y: result[1].y,
      rotation: 90,
    });
  });

  it('keeps yearly grid templates visible when converted to free layout', () => {
    const result = convertGridSlotsToFreeLayout([
      { name: '', isReversed: false, label: '一月', position: 'col-start-1 row-start-4' },
      { name: '', isReversed: false, label: '四月', position: 'col-start-7 row-start-7' },
      { name: '', isReversed: false, label: '七月', position: 'col-start-13 row-start-4' },
      { name: '', isReversed: false, label: '十月', position: 'col-start-7 row-start-1' },
      { name: '', isReversed: false, label: '底牌', position: 'col-start-7 row-start-4' },
    ], 'yearly');
    const bounds = getFreeLayoutBounds(result);

    expect(bounds.minX).toBeGreaterThanOrEqual(0);
    expect(bounds.minY).toBeGreaterThanOrEqual(0);
    expect(bounds.maxX).toBeLessThanOrEqual(FREE_LAYOUT_CANVAS_WIDTH);
    expect(bounds.maxY).toBeLessThanOrEqual(FREE_LAYOUT_CANVAS_HEIGHT);
    expect(result.find(slot => slot.label === '底牌')?.x).toBeCloseTo(result.find(slot => slot.label === '十月')?.x || 0);
  });
});
