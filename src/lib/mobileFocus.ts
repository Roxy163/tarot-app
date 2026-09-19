import type { FocusEvent } from 'react';

export const scrollFocusedFieldIntoView = (event: FocusEvent<HTMLElement>) => {
  if (typeof window === 'undefined' || window.innerWidth >= 768) return;
  const target = event.currentTarget;

  window.setTimeout(() => {
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, 120);
};
