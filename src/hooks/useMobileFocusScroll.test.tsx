import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMobileFocusScroll } from './useMobileFocusScroll';

const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
};

describe('useMobileFocusScroll', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    setWindowWidth(1024);
  });

  it('scrolls focused inputs into view on mobile after the keyboard opens', () => {
    vi.useFakeTimers();
    setWindowWidth(390);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const input = document.createElement('input');
    document.body.appendChild(input);

    renderHook(() => useMobileFocusScroll());
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(180);

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  });

  it('does not adjust focus position on desktop widths', () => {
    vi.useFakeTimers();
    setWindowWidth(1024);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    renderHook(() => useMobileFocusScroll());
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(180);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
