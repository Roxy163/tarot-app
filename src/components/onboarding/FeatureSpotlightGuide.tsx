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
  const step = steps[stepIndex];
  const viewport = getViewportSize();

  useEffect(() => {
    if (!isOpen || !step?.target) return;

    const target = document.querySelector<HTMLElement>(step.target);
    target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, [isOpen, step?.target]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      return;
    }

    const updateTargetRect = () => {
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
  const panelWidth = Math.min(420, viewport.width - 32);
  const panelLeft = clamp(targetCenterX - panelWidth / 2, 16, viewport.width - panelWidth - 16);
  const panelShouldSitAbove = targetCenterY > viewport.height * 0.56;
  const estimatedPanelHeight = viewport.width < 640 ? 320 : 250;
  const rawPanelTop = targetRect
    ? panelShouldSitAbove
      ? targetRect.top - estimatedPanelHeight - 28
      : Math.min(viewport.height - 210, targetRect.top + targetRect.height + 28)
    : viewport.height / 2 - 110;
  const panelTop = clamp(
    rawPanelTop,
    56,
    Math.max(56, viewport.height - estimatedPanelHeight - 24),
  );
  const arrowTop = panelShouldSitAbove ? panelTop + 92 : panelTop - 34;
  const arrowStartX = clamp(panelLeft + panelWidth * 0.68, 36, viewport.width - 36);

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
          className="fixed inset-0 z-[1000] bg-black/75 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="功能导览"
        >
          {targetRect && (
            <motion.div
              className="pointer-events-none fixed rounded-[1.6rem] border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.18),0_0_38px_rgba(255,255,255,0.45)]"
              initial={false}
              animate={{
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            />
          )}

          <svg
            className="pointer-events-none fixed h-28 w-36 text-white"
            style={{
              left: clamp(arrowStartX - 36, 10, viewport.width - 150),
              top: clamp(arrowTop, 56, viewport.height - 150),
              transform: panelShouldSitAbove ? 'none' : 'rotate(180deg)',
            }}
            viewBox="0 0 144 112"
            aria-hidden="true"
          >
            <path
              d="M12 22c48-16 79-8 92 17 9 17-10 28-24 18-15-11 6-35 52-45"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>

          <motion.div
            className="fixed overflow-y-auto rounded-[1.5rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
            style={{
              left: panelLeft,
              top: panelTop,
              width: panelWidth,
              maxHeight: viewport.height - 80,
            }}
            initial={{ opacity: 0, y: panelShouldSitAbove ? 16 : -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: panelShouldSitAbove ? 16 : -16 }}
            key={step.title}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-white/80">
                {stepIndex + 1}/{steps.length}
              </span>
              <button
                type="button"
                onClick={onFinish}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                aria-label="关闭功能导览"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="break-words font-serif text-2xl font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-3xl">
              {step.title}
            </h3>
            <p className="mt-3 break-words text-sm leading-relaxed text-white/75 [overflow-wrap:anywhere]">
              {step.description}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onFinish}
                className="min-h-11 rounded-xl px-4 text-xs font-bold text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                跳过
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-forest-ink transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {stepIndex >= steps.length - 1 ? (
                  <>
                    <Check size={16} />
                    完成
                  </>
                ) : (
                  <>
                    下一步
                    <ArrowRight size={16} />
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
