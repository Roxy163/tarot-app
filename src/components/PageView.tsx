import { createContext, useContext, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useModalFocus } from '../hooks/useModalFocus';

interface PageViewProps {
  isOpen: boolean;
  onBack: () => void;
  title: string;
  children: ReactNode;
  backDisabled?: boolean;
}

// A nested page must not reactivate the app while another page still covers it.
const inactiveSources = new Map<HTMLElement, { count: number; inert: boolean; ariaHidden: string | null }>();
const PageDepth = createContext(0);

function PageContent({ onBack, title, children, backDisabled }: Omit<PageViewProps, 'isOpen'>) {
  const pageRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const depth = useContext(PageDepth);
  const goBack = () => { if (!backDisabled) onBack(); };
  useBodyScrollLock(true);

  // Reuse the app's Back/Escape stack and original close guards, including nested pages.
  useModalFocus(true, pageRef, goBack);

  useLayoutEffect(() => {
    const sources = [...document.body.children].filter((element): element is HTMLElement =>
      element instanceof HTMLElement && element !== pageRef.current &&
      !element.matches('script, style, [data-page-announcement]'),
    );
    sources.forEach(element => {
      const state = inactiveSources.get(element) || { count: 0, inert: Boolean(element.inert), ariaHidden: element.getAttribute('aria-hidden') };
      state.count += 1;
      inactiveSources.set(element, state);
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    return () => sources.forEach(element => {
      const state = inactiveSources.get(element);
      if (!state || --state.count > 0) return;
      element.inert = state.inert;
      if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', state.ariaHidden);
      inactiveSources.delete(element);
    });
  }, []);

  // Announce the new page without opening the keyboard or highlighting a control.
  useLayoutEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);

  return createPortal(
    <PageDepth.Provider value={depth + 1}><motion.main
      ref={pageRef}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-full-page
      initial={{ opacity: 0, x: reducedMotion ? 0 : 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 12 }}
      transition={{ duration: 0.18 }}
      style={{ zIndex: 180 + depth }}
      className="fixed inset-0 flex h-dvh flex-col bg-forest-bg text-forest-ink outline-none"
    >
      <header className="shrink-0 border-b border-forest-accent/7 bg-forest-bg px-3 sm:px-5" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="relative mx-auto flex min-h-16 w-full max-w-xl items-center justify-center">
          <button type="button" onClick={goBack} disabled={backDisabled} aria-label={`返回（${title}）`} className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full text-forest-ink transition-colors hover:bg-forest-accent/8 focus-visible:outline-2 focus-visible:outline-forest-accent disabled:opacity-40">
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <h1 id={titleId} ref={headingRef} tabIndex={-1} className="px-12 text-center font-serif text-xl font-bold outline-none">{title}</h1>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-7" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto w-full max-w-xl text-sm leading-relaxed text-forest-muted">{children}</div>
      </div>
    </motion.main></PageDepth.Provider>,
    document.body,
  );
}

export function PageView({ isOpen, ...props }: PageViewProps) {
  return <AnimatePresence>{isOpen && <PageContent {...props} />}</AnimatePresence>;
}
