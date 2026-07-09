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

const getScrollY = () => (
  window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
);

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
  };
};

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked || typeof window === 'undefined' || typeof document === 'undefined') return;
    return lockBodyScroll();
  }, [locked]);
};
