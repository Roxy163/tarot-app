// Reveal only after a deliberate selection, not while typing or restoring a draft.
export const revealReadingSpread = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const navigation = document.querySelector('[data-app-navigation]')?.getBoundingClientRect();
  const top = 12;
  const bottom = (navigation && navigation.top > 0 ? navigation.top : window.innerHeight - 64) - 12;
  if (rect.top >= top && rect.bottom <= bottom) return;
  const delta = rect.bottom > bottom
    ? Math.min(rect.bottom - bottom, rect.top - top)
    : rect.top - top;
  const scrollTop = Math.max(0, window.scrollY + delta);
  if (Math.abs(scrollTop - window.scrollY) < 1) return;
  window.scrollTo({
    top: scrollTop,
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
};
