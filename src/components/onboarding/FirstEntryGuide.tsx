import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { FIRST_ENTRY_STEPS } from './guideContent';

export const FirstEntryGuide: React.FC = () => {
  const { state, nextStep, completeFirstEntry, skipFirstEntry } = useOnboarding();
  const currentStep = FIRST_ENTRY_STEPS[state.currentStep];
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLastStep = state.currentStep === FIRST_ENTRY_STEPS.length - 1;

  useEffect(() => {
    if (!currentStep) completeFirstEntry();
  }, [completeFirstEntry, currentStep]);

  const handleAction = () => {
    if (isLastStep) {
      completeFirstEntry();
    } else {
      nextStep();
    }
  };

  useEffect(() => {
    if (!currentStep) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusFirstControl = () => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstControl?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skipFirstEntry();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => !element.hasAttribute('disabled'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const focusTimer = window.setTimeout(focusFirstControl, 0);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStep, skipFirstEntry]);

  if (!currentStep) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] overflow-y-auto bg-forest-bg text-forest-text"
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-entry-guide-title"
        aria-describedby="first-entry-guide-description"
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        exit={{ y: 16 }}
        className="relative min-h-[100dvh] w-full overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-accent/0 via-forest-accent/40 to-forest-pink/0" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-forest-pink/0 via-forest-pink/35 to-forest-accent/0" />

        {currentStep.showSkip && (
          <button
            onClick={skipFirstEntry}
            aria-label="跳过新手导览"
            className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-forest-muted hover:text-forest-accent transition-colors rounded-full hover:bg-white/70"
          >
            <X size={20} />
          </button>
        )}

        <div className="min-h-[100dvh] max-w-6xl mx-auto px-6 py-8 sm:px-10 flex flex-col">
          <div className="flex items-center gap-2 pr-14">
            {FIRST_ENTRY_STEPS.map((_, index) => (
              <motion.div
                key={index}
                initial={{ width: 10 }}
                animate={{ width: index === state.currentStep ? 44 : 10 }}
                transition={{ duration: 0.3 }}
                className={`h-1.5 rounded-full ${
                  index === state.currentStep ? 'bg-forest-accent' : 'bg-forest-border'
                }`}
              />
            ))}
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-10 py-10">
            <div className="space-y-7 text-left">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-forest-accent/10 text-[10px] font-bold tracking-[0.24em] uppercase text-forest-accent"
              >
                <currentStep.icon size={14} />
                First Entry
              </motion.div>

              <div className="space-y-4">
                <motion.h2
                  id="first-entry-guide-title"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-5xl sm:text-6xl lg:text-7xl font-serif font-bold text-forest-accent leading-tight"
                >
                  {currentStep.title}
                </motion.h2>
                <motion.p
                  id="first-entry-guide-description"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg sm:text-xl text-forest-ink font-serif font-bold"
                >
                  {currentStep.subtitle}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="max-w-2xl text-base sm:text-lg text-forest-text/80 leading-8 font-serif italic"
                >
                  {currentStep.content}
                </motion.p>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-forest-muted leading-relaxed"
              >
                此导览仅首次入阁自动出现；之后可在个人页的功能介绍中回看。
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, type: 'spring' }}
              className="relative min-h-[280px] sm:min-h-[360px] flex items-center justify-center"
            >
              <div className="absolute inset-6 rounded-[3rem] border border-forest-accent/10 bg-white/45 shadow-2xl shadow-forest-accent/10" />
              <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-white border border-forest-accent/10 shadow-2xl flex items-center justify-center">
                <div className="absolute inset-4 rounded-full border border-forest-pink/20" />
                <currentStep.icon className="text-forest-accent" size={88} />
              </div>
            </motion.div>
          </div>

          <div className="pb-3">
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={handleAction}
              className="w-full min-h-14 px-10 py-4 bg-forest-pink text-white rounded-2xl font-bold text-base sm:text-lg hover:bg-forest-pink/90 transition-all shadow-xl shadow-forest-pink/25 flex items-center justify-center gap-2"
            >
              <span>{currentStep.action}</span>
              {!isLastStep && <ChevronRight size={20} />}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
