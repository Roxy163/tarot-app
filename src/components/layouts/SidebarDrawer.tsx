import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useModalFocus } from '../../hooks/useModalFocus';

interface SidebarDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  allowEdgeSwipe: boolean;
}

type Gesture = {
  id: number;
  x: number;
  y: number;
  started: number;
  dragging: boolean;
  target: Element;
};

const interactive = 'button, a, input, textarea, select, [role="button"], [role="slider"], [contenteditable="true"]';
const editable = 'input, textarea, select, [role="slider"], [contenteditable="true"]';
const drawerWidth = () => Math.min(320, window.innerWidth * 0.85);

export function SidebarDrawer({ isOpen, onOpenChange, children, allowEdgeSwipe }: SidebarDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const suppressClickUntil = useRef(0);
  const changeRef = useRef(onOpenChange);
  changeRef.current = onOpenChange;
  const [width, setWidth] = useState(drawerWidth);
  const [offset, setOffset] = useState<number | null>(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const reducedMotion = useReducedMotion();
  const isVisible = isOpen || offset !== null;
  const hasOtherDialog = () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
    .some(dialog => dialog !== panelRef.current);
  useBodyScrollLock(isVisible);
  useModalFocus(isOpen, panelRef, () => onOpenChange(false));

  useEffect(() => {
    const resize = () => { setWidth(drawerWidth()); setOffset(null); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let gesture: Gesture | null = null;
    const release = () => {
      if (gesture?.target.hasPointerCapture?.(gesture.id)) gesture.target.releasePointerCapture(gesture.id);
      gesture = null;
    };
    const down = (event: PointerEvent) => {
      if (event.isPrimary === false || event.button !== 0 || hasOtherDialog()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const fromHandle = Boolean(handleRef.current?.contains(target));
      if (!fromHandle && target.closest(isOpen ? editable : interactive)) return;
      if (isOpen) {
        if (!panelRef.current?.contains(target)) return;
      } else if (!fromHandle && (!allowEdgeSwipe || event.pointerType === 'mouse' || event.clientX > 24 || event.clientY < 96 || event.clientY > window.innerHeight - 88)) {
        return;
      }
      suppressClickUntil.current = 0;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, started: Date.now(), dragging: false, target };
    };
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { release(); return; }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        if ((isOpen && dx > 0) || (!isOpen && dx < 0)) { release(); return; }
        gesture.dragging = true;
        // A tap stays a tap; capture only after horizontal intent is clear.
        gesture.target.setPointerCapture?.(event.pointerId);
      }
      event.preventDefault();
      setOffset(Math.max(-width, Math.min(0, (isOpen ? 0 : -width) + dx)));
    };
    const finish = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      const elapsed = Math.max(1, Date.now() - gesture.started);
      const dragged = gesture.dragging;
      release();
      setOffset(null);
      if (!dragged) return;
      suppressClickUntil.current = Date.now() + 350;
      if (event.type === 'pointercancel') return;
      const distance = isOpen ? -dx : dx;
      if (distance > width * 0.24 || (distance > 30 && distance / elapsed > 0.5)) {
        if (!isOpen) handleRef.current?.focus({ preventScroll: true });
        changeRef.current(!isOpen);
      }
    };
    const click = (event: MouseEvent) => {
      if (event.detail > 0 && Date.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const cancel = () => { release(); setOffset(null); };
    const visibility = () => { if (document.hidden) cancel(); };
    const lostCapture = (event: PointerEvent) => {
      if (gesture?.id === event.pointerId) cancel();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
    document.addEventListener('click', click, true);
    document.addEventListener('lostpointercapture', lostCapture, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', cancel);
    return () => {
      release();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', finish, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('lostpointercapture', lostCapture, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', cancel);
    };
  }, [isOpen, width, allowEdgeSwipe]);

  const settleTransition = reducedMotion ? { duration: 0.12 } : { type: 'spring' as const, stiffness: 400, damping: 38, mass: 0.85 };
  const transition = offset !== null ? { duration: 0 } : settleTransition;
  return <>
    {/* Reserve only the page margin for touch gestures, leaving content and canvases alone. */}
    <div
      data-sidebar-edge
      aria-hidden="true"
      className="fixed bottom-[88px] left-0 top-24 z-[103] w-5"
      style={{ touchAction: 'pan-y pinch-zoom', pointerEvents: allowEdgeSwipe && !isVisible ? 'auto' : 'none' }}
    />
    <motion.button
      ref={handleRef}
      data-sidebar-handle
      type="button"
      aria-label="侧边菜单：点击或向右滑动打开"
      aria-expanded={isOpen}
      aria-controls="sidebar-menu"
      onPointerEnter={event => { if (event.pointerType === 'mouse') setIsPeeking(true); }}
      onPointerLeave={() => setIsPeeking(false)}
      onFocus={event => setIsPeeking(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setIsPeeking(false)}
      onClick={() => { if (!hasOtherDialog()) { setIsPeeking(false); onOpenChange(true); } }}
      className="group fixed left-0 top-[44%] z-[104] flex h-24 w-11 touch-pan-y items-center outline-none"
      style={{ touchAction: 'pan-y pinch-zoom', pointerEvents: isVisible ? 'none' : 'auto' }}
      tabIndex={isVisible ? -1 : 0}
      aria-hidden={isVisible}
      animate={{ opacity: isVisible ? 0 : 1 }}
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ x: isPeeking ? -4 : -18, opacity: isPeeking ? 1 : 0.7 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 34 }}
        className="relative flex h-16 w-8 items-center justify-end rounded-r-2xl border border-l-0 border-forest-accent/12 bg-white/70 pr-2 shadow-sm shadow-forest-accent/10 backdrop-blur-md group-focus-visible:ring-2 group-focus-visible:ring-forest-accent/40"
      >
        <motion.span initial={false} animate={{ opacity: isPeeking ? 1 : 0, x: isPeeking ? 0 : -3 }} transition={{ duration: reducedMotion ? 0 : 0.16 }} className="absolute left-1 text-forest-accent/75"><ChevronRight size={11} /></motion.span>
        <motion.span initial={false} animate={{ scaleY: isPeeking ? 1.15 : 1 }} transition={settleTransition} className="h-5 w-[3px] shrink-0 rounded-full bg-forest-accent/50" />
      </motion.span>
    </motion.button>
    <AnimatePresence>
      {isVisible && <>
        <motion.div
          data-sidebar-backdrop
          initial={{ opacity: 0 }}
          animate={{ opacity: offset === null ? 1 : (width + offset) / width }}
          exit={{ opacity: 0, transition: { duration: reducedMotion ? 0.12 : 0.2 } }}
          transition={transition}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-[105] bg-forest-ink/40 backdrop-blur-[2px] overscroll-contain"
          aria-hidden="true"
        />
        <motion.aside
          id="sidebar-menu"
          ref={panelRef}
          role="dialog"
          aria-label="侧边菜单"
          aria-modal={isOpen || undefined}
          aria-hidden={!isOpen}
          inert={!isOpen}
          tabIndex={-1}
          initial={{ x: -width }}
          animate={{ x: offset ?? 0 }}
          // Exit must settle even when the last pointer move used an immediate transition.
          exit={{ x: -width, transition: settleTransition }}
          transition={transition}
          style={{ width, touchAction: 'pan-y pinch-zoom' }}
          className="fixed bottom-0 left-0 top-0 z-[110] flex touch-pan-y flex-col overflow-hidden rounded-r-[1.75rem] border-r border-forest-accent/10 bg-white/95 shadow-[12px_0_50px_-25px_rgba(62,58,54,0.3)] backdrop-blur-xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
            <p className="font-serif text-base font-bold text-forest-ink">菜单</p>
            <button type="button" onClick={() => onOpenChange(false)} className="sr-only min-h-11 min-w-11 items-center justify-center rounded-full text-forest-ink/80 outline-none transition-colors hover:text-forest-ink focus-visible:ring-1 focus-visible:ring-forest-accent/40 md:not-sr-only md:flex" aria-label="关闭菜单"><X size={22} strokeWidth={2} aria-hidden="true" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          <p className="shrink-0 border-t border-forest-accent/6 py-2 text-center text-[10px] text-forest-muted" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>点击右侧暗区或向左滑动收起</p>
        </motion.aside>
      </>}
    </AnimatePresence>
  </>;
}
