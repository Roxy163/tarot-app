import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProgressiveList } from './useProgressiveList';

describe('progressive archive browsing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the expanded list after record updates and resets when the actual query changes', () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    const items = Array.from({ length: 30 }, (_, index) => ({ id: index }));
    const { result, rerender } = renderHook(({ values, query }) => useProgressiveList(values, { resetKey: query }), { initialProps: { values: items, query: '工作' } });
    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(20);
    rerender({ values: items.map(item => ({ ...item })), query: '工作' });
    expect(result.current.visibleItems).toHaveLength(20);
    rerender({ values: items, query: '感情' });
    expect(result.current.visibleItems).toHaveLength(12);
  });

  it('keeps the original reset behavior for consumers that do not opt in', () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    const items = Array.from({ length: 30 }, (_, index) => index);
    const { result, rerender } = renderHook(({ values }) => useProgressiveList(values), { initialProps: { values: items } });
    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(20);
    rerender({ values: [...items] });
    expect(result.current.visibleItems).toHaveLength(12);
  });
});
