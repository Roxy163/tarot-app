import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBodyScrollLock } from './useBodyScrollLock';

describe('useBodyScrollLock', () => {
  afterEach(() => {
    document.body.style.cssText = '';
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });

  it('locks and restores body scroll styles', () => {
    const { rerender } = renderHook(({ locked }) => useBodyScrollLock(locked), {
      initialProps: { locked: true },
    });

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.width).toBe('100%');

    rerender({ locked: false });

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
    expect(document.body.style.width).toBe('');
  });

  it('keeps the body locked until every overlay releases it', () => {
    const first = renderHook(({ locked }) => useBodyScrollLock(locked), {
      initialProps: { locked: true },
    });
    const second = renderHook(({ locked }) => useBodyScrollLock(locked), {
      initialProps: { locked: true },
    });

    first.rerender({ locked: false });
    expect(document.body.style.overflow).toBe('hidden');

    second.rerender({ locked: false });
    expect(document.body.style.overflow).toBe('');
  });

  it('prevents wheel scrolling from leaking to the page while locked', () => {
    const { rerender } = renderHook(({ locked }) => useBodyScrollLock(locked), {
      initialProps: { locked: true },
    });

    const lockedWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    document.dispatchEvent(lockedWheel);

    expect(lockedWheel.defaultPrevented).toBe(true);

    rerender({ locked: false });

    const releasedWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    document.dispatchEvent(releasedWheel);

    expect(releasedWheel.defaultPrevented).toBe(false);
  });

  it('allows inner overlay scrolling but contains it at the edge', () => {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 300 });
    document.body.appendChild(scroller);

    const { rerender } = renderHook(({ locked }) => useBodyScrollLock(locked), {
      initialProps: { locked: true },
    });

    scroller.scrollTop = 80;
    const insideWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 40,
    });
    scroller.dispatchEvent(insideWheel);

    expect(insideWheel.defaultPrevented).toBe(false);

    scroller.scrollTop = 200;
    const edgeWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 40,
    });
    scroller.dispatchEvent(edgeWheel);

    expect(edgeWheel.defaultPrevented).toBe(true);

    rerender({ locked: false });
  });
});
