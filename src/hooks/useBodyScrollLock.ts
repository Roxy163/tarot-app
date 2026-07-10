import { useEffect } from 'react';

type BodyScrollSnapshot = {
  overflow: string;
  position: string;
  top: string;
  width: string;
  paddingRight: string;
  scrollY: number;
};

let lockCount = 0;
let snapshot: BodyScrollSnapshot | null = null;
let lastTouchY: number | null = null;

const scrollGuardOptions = { capture: true, passive: false } as const;

const getScrollY = () => (
  window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
);

const getEventElement = (target: EventTarget | null): HTMLElement | null => {
  if (target instanceof HTMLElement) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const canElementScrollY = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const hasScrollableContent = element.scrollHeight > element.clientHeight + 1;

  return hasScrollableContent && (
    overflowY === 'auto'
    || overflowY === 'scroll'
    || overflowY === 'overlay'
  );
};

const findScrollableAncestor = (element: HTMLElement | null) => {
  let current: HTMLElement | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    if (canElementScrollY(current)) return current;
    current = current.parentElement;
  }

  return null;
};

const canScrollWithin = (element: HTMLElement, deltaY: number) => {
  if (deltaY < 0) return element.scrollTop > 0;
  if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  return true;
};

const shouldPreventBackgroundScroll = (target: EventTarget | null, deltaY: number) => {
  const scrollable = findScrollableAncestor(getEventElement(target));
  return !scrollable || !canScrollWithin(scrollable, deltaY);
};

const handleLockedWheel = (event: WheelEvent) => {
  if (shouldPreventBackgroundScroll(event.target, event.deltaY)) {
    event.preventDefault();
  }
};

const handleLockedTouchStart = (event: TouchEvent) => {
  lastTouchY = event.touches[0]?.clientY ?? null;
};

const handleLockedTouchMove = (event: TouchEvent) => {
  const currentY = event.touches[0]?.clientY ?? null;
  if (currentY === null || lastTouchY === null) return;

  const deltaY = lastTouchY - currentY;
  lastTouchY = currentY;

  if (shouldPreventBackgroundScroll(event.target, deltaY)) {
    event.preventDefault();
  }
};

const attachScrollGuards = () => {
  document.addEventListener('wheel', handleLockedWheel, scrollGuardOptions);
  document.addEventListener('touchstart', handleLockedTouchStart, scrollGuardOptions);
  document.addEventListener('touchmove', handleLockedTouchMove, scrollGuardOptions);
};

const detachScrollGuards = () => {
  document.removeEventListener('wheel', handleLockedWheel, scrollGuardOptions);
  document.removeEventListener('touchstart', handleLockedTouchStart, scrollGuardOptions);
  document.removeEventListener('touchmove', handleLockedTouchMove, scrollGuardOptions);
  lastTouchY = null;
};

const lockBodyScroll = () => {
  if (lockCount === 0) {
    const scrollY = getScrollY();
    const viewportWidth = document.documentElement.clientWidth;
    const scrollbarWidth = viewportWidth > 0 ? Math.max(0, window.innerWidth - viewportWidth) : 0;

    snapshot = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
      scrollY,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    attachScrollGuards();
  }

  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !snapshot) return;

    const { scrollY, overflow, position, top, width, paddingRight } = snapshot;
    document.body.style.overflow = overflow;
    document.body.style.position = position;
    document.body.style.top = top;
    document.body.style.width = width;
    document.body.style.paddingRight = paddingRight;
    snapshot = null;

    document.documentElement.scrollTop = scrollY;
    document.body.scrollTop = scrollY;
    detachScrollGuards();
  };
};

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked || typeof window === 'undefined' || typeof document === 'undefined') return;
    return lockBodyScroll();
  }, [locked]);
};
