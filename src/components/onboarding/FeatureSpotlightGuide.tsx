import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, X } from 'lucide-react';

export interface FeatureSpotlightStep {
  target: string;
  title: string;
  description: string;
}

interface FeatureSpotlightGuideProps {
  isOpen: boolean;
  steps: FeatureSpotlightStep[];
  onFinish: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getViewportSize = () => ({
  width: typeof window === 'undefined' ? 390 : window.innerWidth,
  height: typeof window === 'undefined' ? 740 : window.innerHeight,
});

export const FeatureSpotlightGuide: React.FC<FeatureSpotlightGuideProps> = ({
  isOpen,
  steps,
  onFinish,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const step = steps[stepIndex];
  const viewport = viewportSize;
  const isMobile = viewport.width < 640;

  useEffect(() => {
    if (!isOpen || !step?.target) return;

    const target = document.querySelector<HTMLElement>(step.target);
    target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });

    const updateTimers = [120, 360, 720].map(delay => window.setTimeout(() => {
      const nextTarget = document.querySelector<HTMLElement>(step.target);
      const rect = nextTarget?.getBoundingClientRect();
      if (!rect) return;

      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }, delay));

    return () => {
      updateTimers.forEach(timer => window.clearTimeout(timer));
    };
  }, [isMobile, isOpen, step?.target]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      return;
    }

    const updateTargetRect = () => {
      setViewportSize(getViewportSize());
      const target = step?.target ? document.querySelector<HTMLElement>(step.target) : null;

      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isOpen, step?.target]);

  if (!step) return null;

  const targetCenterX = targetRect ? targetRect.left + targetRect.width / 2 : viewport.width / 2;
  const targetCenterY = targetRect ? targetRect.top + targetRect.height / 2 : viewport.height / 2;
  const targetBottom = targetRect ? targetRect.top + targetRect.height : targetCenterY;
  const noteWidth = Math.min(isMobile ? 420 : 720, viewport.width - (isMobile ? 36 : 96));
  const noteLeft = clamp(
    targetCenterX - noteWidth / 2,
    isMobile ? 18 : 32,
    Math.max(isMobile ? 18 : 32, viewport.width - noteWidth - (isMobile ? 18 : 32)),
  );
  const targetIsTall = targetRect
    ? targetRect.height > viewport.height * (isMobile ? 0.32 : 0.42)
    : false;
  const spaceAbove = targetRect ? targetRect.top : targetCenterY;
  const spaceBelow = targetRect ? viewport.height - targetBottom : viewport.height - targetCenterY;
  const noteAboveTarget = targetRect
    ? targetIsTall || spaceAbove + (isMobile ? 24 : 40) >= spaceBelow || targetBottom > viewport.height - (isMobile ? 230 : 280)
    : targetCenterY > viewport.height * 0.5;
  const estimatedNoteHeight = isMobile ? 210 : 230;
  const noteTop = targetRect
    ? noteAboveTarget
      ? clamp(
          targetRect.top - estimatedNoteHeight - (isMobile ? 12 : 18),
          isMobile ? 32 : 44,
          Math.max(isMobile ? 32 : 44, viewport.height - estimatedNoteHeight - (isMobile ? 20 : 36)),
        )
      : clamp(
          targetBottom + (isMobile ? 22 : 30),
          isMobile ? 52 : 60,
          Math.max(isMobile ? 52 : 60, viewport.height - estimatedNoteHeight - (isMobile ? 20 : 36)),
        )
    : viewport.height * 0.16;
  const arrowStartX = clamp(noteLeft + noteWidth * (noteAboveTarget ? 0.68 : 0.6), 48, viewport.width - 48);
  const arrowStartY = noteAboveTarget
    ? noteTop + (isMobile ? 82 : 102)
    : noteTop + (isMobile ? 18 : 22);
  const arrowEndX = targetCenterX;
  const arrowEndY = targetRect
    ? noteAboveTarget
      ? targetRect.top - 12
      : targetBottom + 12
    : viewport.height / 2;
  const arrowControlY = noteAboveTarget
    ? arrowStartY + Math.max(42, (arrowEndY - arrowStartY) * 0.42)
    : arrowStartY - Math.max(42, (arrowStartY - arrowEndY) * 0.42);
  const arrowControlX = clamp((arrowStartX + arrowEndX) / 2, 36, viewport.width - 36);
  const arrowPath = `M ${arrowStartX} ${arrowStartY} C ${arrowControlX} ${arrowControlY}, ${arrowControlX} ${arrowControlY}, ${arrowEndX} ${arrowEndY}`;

  const handleNext = () => {
    if (stepIndex >= steps.length - 1) {
      onFinish();
      return;
    }

    setStepIndex(current => current + 1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed inset-0 z-[1000] text-white ${isMobile ? 'bg-black/45' : 'bg-black/50'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="功能导览"
        >
          <svg
            className="pointer-events-none fixed inset-0 h-full w-full text-white"
            viewBox={`0 0 ${viewport.width} ${viewport.height}`}
            aria-hidden="true"
            data-testid="spotlight-arrow"
          >
            <defs>
              <marker
                id="spotlight-arrow-head"
                markerHeight="9"
                markerWidth="9"
                orient="auto"
                refX="7"
                refY="4.5"
              >
                <path d="M0,0 L9,4.5 L0,9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </marker>
            </defs>
            <motion.path
              d={arrowPath}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={isMobile ? 4 : 5}
              markerEnd="url(#spotlight-arrow-head)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              key={`${step.title}-arrow`}
            />
            <motion.circle
              cx={arrowEndX}
              cy={arrowEndY}
              r={isMobile ? 4 : 5}
              fill="currentColor"
              initial={{ scale: 0.65, opacity: 0.45 }}
              animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.45, 0.9, 0.45] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          </svg>

          <motion.div
            className="fixed px-2 sm:px-0"
            style={{
              left: noteLeft,
              top: noteTop,
              width: noteWidth,
              textShadow: '0 4px 24px rgba(0,0,0,0.62)',
            }}
            initial={{ opacity: 0, y: noteAboveTarget ? 16 : -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: noteAboveTarget ? 16 : -16 }}
            key={`${step.title}-floating-note`}
            data-testid={isMobile ? 'spotlight-mobile-note' : 'spotlight-floating-note'}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-white sm:text-base">
                {stepIndex + 1}/{steps.length}
              </span>
              <button
                type="button"
                onClick={onFinish}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                aria-label="关闭功能导览"
              >
                <X size={isMobile ? 18 : 20} />
              </button>
            </div>

            <h3 className="mt-2.5 break-words font-serif text-[1.55rem] font-bold leading-[1.12] text-white [overflow-wrap:anywhere] sm:mt-3 sm:text-[3rem]">
              {step.title}
            </h3>
            <p
              className="mt-2 max-w-[34rem] overflow-hidden break-words text-sm font-semibold leading-relaxed text-white/88 [overflow-wrap:anywhere] sm:text-base"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: isMobile ? 2 : 3,
              }}
            >
              {step.description}
            </p>

            <div className="mt-4 flex items-center gap-3 sm:mt-5">
              <button
                type="button"
                onClick={onFinish}
                className="min-h-10 rounded-xl px-2 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              >
                跳过
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/90 px-5 text-sm font-bold text-forest-ink shadow-lg transition-transform hover:bg-white active:scale-[0.98] sm:px-6 sm:text-base"
              >
                {stepIndex >= steps.length - 1 ? (
                  <>
                    完成
                    <Check size={isMobile ? 17 : 18} />
                  </>
                ) : (
                  <>
                    下一步
                    <ArrowRight size={isMobile ? 17 : 18} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
