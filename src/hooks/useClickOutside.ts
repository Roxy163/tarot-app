import { RefObject, useEffect } from 'react';

export const useClickOutside = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClickOutside: () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const element = ref.current;
      const target = event.target;

      if (!element || !(target instanceof Node) || element.contains(target)) return;
      onClickOutside();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [enabled, onClickOutside, ref]);
};
