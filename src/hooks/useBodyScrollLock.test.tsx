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
});
