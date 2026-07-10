import { useEffect } from 'react';

const FOCUS_SCROLL_DELAY_MS = 180;

const isEditableElement = (element: Element | null): element is HTMLElement => (
  element instanceof HTMLInputElement
  || element instanceof HTMLTextAreaElement
  || element instanceof HTMLSelectElement
  || (element instanceof HTMLElement && element.isContentEditable)
);

const shouldHandleMobileFocus = () => (
  typeof window !== 'undefined' && window.innerWidth < 768
);

export const scrollFocusedInputIntoView = (element: Element | null) => {
  if (!shouldHandleMobileFocus() || !isEditableElement(element)) return;

  window.setTimeout(() => {
    if (!document.body.contains(element)) return;

    element.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, FOCUS_SCROLL_DELAY_MS);
};

export const useMobileFocusScroll = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleFocusIn = (event: FocusEvent) => {
      scrollFocusedInputIntoView(event.target instanceof Element ? event.target : null);
    };
    const handleViewportResize = () => {
      scrollFocusedInputIntoView(document.activeElement);
    };

    document.addEventListener('focusin', handleFocusIn);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);
};
