import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface GuideStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface GuideOverlayProps {
  guideId: string;
  steps: GuideStep[];
  currentStepIndex: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export const GuideOverlay: React.FC<GuideOverlayProps> = ({
  guideId,
  steps,
  currentStepIndex,
  onNext,
  onSkip,
  onComplete,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex];
  useBodyScrollLock(Boolean(currentStep && targetRect));

  useEffect(() => {
    const target = document.querySelector(currentStep?.target);
    if (target) {
      setTargetRect(target.getBoundingClientRect());
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [currentStepIndex, currentStep?.target]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onSkip();
    }
  };

  if (!currentStep || !targetRect) return null;

  const isLastStep = currentStepIndex === steps.length - 1;

  const getPositionStyles = () => {
    const padding = 20;
    const tooltipWidth = 280;
    const tooltipHeight = 120;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let top = targetRect.bottom + padding;
    let left = Math.min(
      Math.max(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, 16),
      windowWidth - tooltipWidth - 16
    );

    if (top + tooltipHeight > windowHeight) {
      top = targetRect.top - tooltipHeight - padding;
    }

    return { top, left };
  };

  const positionStyles = getPositionStyles();

  const handleNext = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (isLastStep) {
        onComplete();
      } else {
        onNext();
      }
    }, 200);
  };

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-forest-text/40 backdrop-blur-sm overscroll-contain"
      onClick={handleOverlayClick}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <filter id="blur">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <rect
          x={targetRect.left}
          y={targetRect.top}
          width={targetRect.width}
          height={targetRect.height}
          fill="white"
          filter="url(#blur)"
          rx="12"
        />
      </svg>

      <div
        className="absolute border-2 border-forest-accent rounded-xl animate-pulse"
        style={{
          left: targetRect.left - 4,
          top: targetRect.top - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          boxShadow: '0 0 0 2000px rgba(0, 0, 0, 0.3)',
        }}
      />

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            className="absolute bg-white rounded-2xl p-5 shadow-2xl max-w-[280px]"
            style={positionStyles}
          >
            <button
              onClick={onSkip}
              className="absolute top-3 right-3 p-1 text-forest-muted hover:text-forest-accent transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-forest-accent/10 flex items-center justify-center">
                <span className="text-forest-accent font-bold text-sm">
                  {currentStepIndex + 1}
                </span>
              </div>
              <h3 className="text-lg font-serif text-forest-accent">{currentStep.title}</h3>
            </div>

            <p className="text-sm text-forest-muted mb-4 leading-relaxed">
              {currentStep.content}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      index === currentStepIndex
                        ? 'bg-forest-accent'
                        : index < currentStepIndex
                        ? 'bg-forest-accent/50'
                        : 'bg-forest-border'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="px-4 py-2 bg-forest-accent text-white rounded-xl font-bold text-sm flex items-center gap-1 hover:bg-forest-accent/90 transition-colors"
              >
                <span>{isLastStep ? '完成' : '下一步'}</span>
                {!isLastStep && <ChevronRight size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
