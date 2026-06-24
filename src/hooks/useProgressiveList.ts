import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ProgressiveListOptions {
  initialCount?: number;
  step?: number;
  rootMargin?: string;
}

export const useProgressiveList = <T,>(
  items: T[],
  {
    initialCount = 12,
    step = 8,
    rootMargin = '600px',
  }: ProgressiveListOptions = {},
) => {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount, items]);

  const hasMore = visibleCount < items.length;
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  const loadMore = useCallback(() => {
    setVisibleCount(current => Math.min(items.length, current + step));
  }, [items.length, step]);

  useEffect(() => {
    if (!hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, rootMargin]);

  return {
    hasMore,
    loadMore,
    sentinelRef,
    visibleCount,
    visibleItems,
  };
};
