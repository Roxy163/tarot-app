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

type NotePlacement = 'above' | 'below' | 'left' | 'right';

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

    const updateTimers = [120, 360, 720, 1100, 1500].map(delay => window.setTimeout(() => {
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
  const targetRight = targetRect ? targetRect.left + targetRect.width : targetCenterX;
  const targetBottom = targetRect ? targetRect.top + targetRect.height : targetCenterY;
  const viewportMargin = isMobile ? 18 : 32;
  const noteGap = isMobile ? 42 : 104;
  const noteWidth = Math.min(isMobile ? 250 : 330, viewport.width - viewportMargin * 2);
  const estimatedNoteHeight = isMobile ? 132 : 132;
  const spaceAbove = targetRect ? targetRect.top : targetCenterY;
  const spaceBelow = targetRect ? viewport.height - targetBottom : viewport.height - targetCenterY;
  const spaceLeft = targetRect ? targetRect.left : targetCenterX;
  const spaceRight = targetRect ? viewport.width - targetRight : viewport.width - targetCenterX;
  const notePlacement: NotePlacement = !isMobile && spaceRight >= noteWidth + noteGap + viewportMargin
    ? 'right'
    : !isMobile && spaceLeft >= noteWidth + noteGap + viewportMargin
      ? 'left'
      : spaceAbove >= estimatedNoteHeight + noteGap + viewportMargin || spaceAbove >= spaceBelow
        ? 'above'
        : 'below';
  const noteLeft = targetRect
    ? notePlacement === 'right'
      ? clamp(targetRight + noteGap, viewportMargin, viewport.width - noteWidth - viewportMargin)
      : notePlacement === 'left'
        ? clamp(targetRect.left - noteWidth - noteGap, viewportMargin, viewport.width - noteWidth - viewportMargin)
        : clamp(targetCenterX - noteWidth / 2, viewportMargin, viewport.width - noteWidth - viewportMargin)
    : viewportMargin;
  const noteTop = targetRect
    ? notePlacement === 'above'
      ? clamp(
          targetRect.top - estimatedNoteHeight - noteGap,
          viewportMargin,
          Math.max(viewportMargin, viewport.height - estimatedNoteHeight - viewportMargin),
        )
      : notePlacement === 'below'
        ? clamp(
            targetBottom + noteGap,
            viewportMargin,
            Math.max(viewportMargin, viewport.height - estimatedNoteHeight - viewportMargin),
          )
      : clamp(
          targetCenterY - estimatedNoteHeight / 2,
          viewportMargin,
          Math.max(viewportMargin, viewport.height - estimatedNoteHeight - viewportMargin),
        )
    : viewport.height * 0.16;
  const noteRight = noteLeft + noteWidth;
  const noteBottom = noteTop + estimatedNoteHeight;
  const noteCenterX = noteLeft + noteWidth / 2;
  const noteCenterY = noteTop + estimatedNoteHeight / 2;
  const arrowComesFromRight = noteCenterX >= targetCenterX;
  const targetGap = isMobile ? 10 : 14;
  const noteArrowGap = isMobile ? 8 : 10;
  const arrowStartX = notePlacement === 'right'
    ? noteLeft - noteArrowGap
    : notePlacement === 'left'
      ? noteRight + noteArrowGap
      : clamp(
          targetCenterX < noteCenterX ? noteLeft + noteWidth * 0.74 : noteLeft + noteWidth * 0.26,
          noteLeft + 28,
          noteRight - 28,
        );
  const arrowStartY = notePlacement === 'above'
    ? noteBottom + noteArrowGap
    : notePlacement === 'below'
      ? noteTop - noteArrowGap
      : clamp(targetCenterY, noteTop + 24, noteBottom - 24);
  const arrowEndX = targetRect
    ? notePlacement === 'right' || (notePlacement === 'above' && targetCenterX < noteCenterX)
      ? targetRight + targetGap
      : notePlacement === 'left' || (notePlacement === 'above' && targetCenterX >= noteCenterX)
        ? targetRect.left - targetGap
        : clamp(targetCenterX, targetRect.left + 12, targetRight - 12)
    : targetCenterX;
  const arrowEndY = targetRect
    ? notePlacement === 'above'
      ? clamp(targetRect.top + targetRect.height * 0.42, targetRect.top + 10, targetBottom - 10)
      : notePlacement === 'below'
        ? clamp(targetRect.top + targetRect.height * 0.58, targetRect.top + 10, targetBottom - 10)
        : clamp(targetCenterY, targetRect.top + 10, targetBottom - 10)
    : targetCenterY;
  const arrowDirection = arrowComesFromRight ? -1 : 1;
  const targetLeftOfNote = targetCenterX < noteCenterX;
  const sideDistance = Math.abs(arrowStartX - arrowEndX);
  const sideBend = clamp(sideDistance * 0.58, isMobile ? 42 : 54, isMobile ? 92 : 128);
  const sideLift = isMobile ? 54 : 82;
  const arrowControl1X = notePlacement === 'right'
    ? clamp(arrowStartX - sideBend, 20, viewport.width - 20)
    : notePlacement === 'left'
      ? clamp(arrowStartX + sideBend, 20, viewport.width - 20)
      : notePlacement === 'above'
        ? clamp(arrowStartX + (targetLeftOfNote ? -8 : 8), 20, viewport.width - 20)
        : clamp(arrowStartX + arrowDirection * (isMobile ? 46 : 72), 20, viewport.width - 20);
  const arrowControl1Y = notePlacement === 'above'
    ? clamp(arrowStartY + (isMobile ? 56 : 74), 20, viewport.height - 20)
    : notePlacement === 'below'
      ? clamp(arrowStartY - (isMobile ? 56 : 74), 20, viewport.height - 20)
      : clamp(arrowStartY - sideLift, 20, viewport.height - 20);
  const arrowControl2X = notePlacement === 'right'
    ? clamp(arrowEndX + sideBend, 20, viewport.width - 20)
    : notePlacement === 'left'
      ? clamp(arrowEndX - sideBend, 20, viewport.width - 20)
      : notePlacement === 'above'
        ? clamp(arrowEndX + (targetLeftOfNote ? 82 : -82), 20, viewport.width - 20)
        : clamp(arrowEndX - arrowDirection * (isMobile ? 72 : 104), 20, viewport.width - 20);
  const arrowControl2Y = notePlacement === 'above'
    ? clamp(arrowEndY + (isMobile ? 44 : 62), 20, viewport.height - 20)
    : notePlacement === 'below'
      ? clamp(arrowEndY - (isMobile ? 44 : 62), 20, viewport.height - 20)
      : clamp(arrowEndY - sideLift, 20, viewport.height - 20);
  const arrowPath = `M ${arrowStartX} ${arrowStartY} C ${arrowControl1X} ${arrowControl1Y}, ${arrowControl2X} ${arrowControl2Y}, ${arrowEndX} ${arrowEndY}`;
  const spotlightPadding = isMobile ? 0 : 2;
  const spotlightTop = targetRect ? clamp(targetRect.top - spotlightPadding, 0, viewport.height) : viewport.height / 2;
  const spotlightLeft = targetRect ? clamp(targetRect.left - spotlightPadding, 0, viewport.width) : viewport.width / 2;
  const spotlightRight = targetRect ? clamp(targetRect.left + targetRect.width + spotlightPadding, 0, viewport.width) : viewport.width / 2;
  const spotlightBottom = targetRect ? clamp(targetRect.top + targetRect.height + spotlightPadding, 0, viewport.height) : viewport.height / 2;
  const spotlightHeight = Math.max(0, spotlightBottom - spotlightTop);
  const dimStyle = {
    backgroundColor: isMobile ? 'rgba(246, 240, 226, 0.72)' : 'rgba(246, 240, 226, 0.68)',
    backdropFilter: 'blur(1.5px)',
  };

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
          className="fixed inset-0 z-[1000] text-forest-ink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="功能导览"
        >
          {targetRect ? (
            <>
              <motion.div
                className="pointer-events-none fixed"
                style={dimStyle}
                animate={{ left: 0, top: 0, width: viewport.width, height: spotlightTop }}
                transition={{ duration: 0.18 }}
                data-testid="spotlight-dim-mask"
              />
              <motion.div
                className="pointer-events-none fixed"
                style={dimStyle}
                animate={{ left: 0, top: spotlightBottom, width: viewport.width, height: viewport.height - spotlightBottom }}
                transition={{ duration: 0.18 }}
                data-testid="spotlight-dim-mask"
              />
              <motion.div
                className="pointer-events-none fixed"
                style={dimStyle}
                animate={{ left: 0, top: spotlightTop, width: spotlightLeft, height: spotlightHeight }}
                transition={{ duration: 0.18 }}
                data-testid="spotlight-dim-mask"
              />
              <motion.div
                className="pointer-events-none fixed"
                style={dimStyle}
                animate={{ left: spotlightRight, top: spotlightTop, width: viewport.width - spotlightRight, height: spotlightHeight }}
                transition={{ duration: 0.18 }}
                data-testid="spotlight-dim-mask"
              />
            </>
          ) : (
            <div className="pointer-events-none fixed inset-0" style={dimStyle} />
          )}

          <svg
            className="pointer-events-none fixed inset-0 h-full w-full text-forest-ink/90"
            viewBox={`0 0 ${viewport.width} ${viewport.height}`}
            aria-hidden="true"
            data-testid="spotlight-arrow"
          >
            <defs>
              <marker
                id="spotlight-arrow-tip"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="6.8"
                refY="4"
              >
                <path
                  d="M0,0 L8,4 L0,8"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </marker>
            </defs>
            <motion.path
              d={arrowPath}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={isMobile ? 3 : 4}
              markerEnd="url(#spotlight-arrow-tip)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              key={`${step.title}-arrow`}
            />
          </svg>

          <motion.div
            className="fixed rounded-xl bg-white/45 px-2.5 py-2 shadow-lg shadow-forest-ink/5 backdrop-blur-[1px] sm:px-3 sm:py-2.5"
            style={{
              left: noteLeft,
              top: noteTop,
              width: noteWidth,
              textShadow: '0 1px 14px rgba(255,255,255,0.92)',
            }}
            initial={{ opacity: 0, y: notePlacement === 'above' ? 12 : -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: notePlacement === 'above' ? 12 : -12 }}
            key={`${step.title}-floating-note`}
            data-testid={isMobile ? 'spotlight-mobile-note' : 'spotlight-floating-note'}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-forest-ink/80 sm:text-xs">
                {stepIndex + 1}/{steps.length}
              </span>
              <button
                type="button"
                onClick={onFinish}
                className="flex h-7 w-7 items-center justify-center rounded-full text-forest-ink/65 transition-colors hover:bg-white/60 hover:text-forest-ink active:scale-95"
                aria-label="关闭功能导览"
              >
                <X size={isMobile ? 15 : 16} />
              </button>
            </div>

            <h3 className="mt-1.5 break-words font-serif text-[1rem] font-bold leading-[1.18] text-forest-ink [overflow-wrap:anywhere] sm:text-[1.28rem]">
              {step.title}
            </h3>
            <p
              className="mt-1 max-w-[30rem] overflow-hidden break-words text-[10px] font-semibold leading-relaxed text-forest-ink/75 [overflow-wrap:anywhere] sm:text-xs"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: isMobile ? 2 : 3,
              }}
            >
              {step.description}
            </p>

            <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
              <button
                type="button"
                onClick={onFinish}
                className="min-h-8 rounded-lg px-2 text-xs font-bold text-forest-ink/65 transition-colors hover:bg-white/60 hover:text-forest-ink active:scale-95"
              >
                跳过
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-forest-ink/85 px-3.5 text-xs font-bold text-white shadow-md shadow-forest-ink/10 transition-transform hover:bg-forest-ink active:scale-[0.98] sm:px-4"
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
