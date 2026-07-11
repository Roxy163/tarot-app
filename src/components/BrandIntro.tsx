import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface BrandIntroProps {
  onDone: () => void;
}

export const BrandIntro: React.FC<BrandIntroProps> = ({ onDone }) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onDone, shouldReduceMotion ? 250 : 560);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      data-testid="brand-intro"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.24 }}
      className="fixed inset-0 z-[500] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-forest-bg px-8 text-forest-text"
      aria-label="塔罗研习阁启动页"
    >
      <div className="pointer-events-none absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-forest-accent/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 bottom-8 h-px bg-gradient-to-r from-transparent via-forest-pink/25 to-transparent" />
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: 'easeOut' }}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <div className="relative">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-forest-accent/16 via-white/0 to-forest-pink/18 blur-xl" />
          <img
            src="/app-icon.svg"
            alt="塔罗研习阁图标"
            className="relative h-[5.5rem] w-[5.5rem] rounded-[1.6rem] shadow-2xl shadow-forest-accent/15 sm:h-24 sm:w-24"
            draggable={false}
          />
        </div>
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduceMotion ? 0 : 0.06, duration: 0.22 }}
          className="mt-4 space-y-1.5"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-forest-accent">Tarot Pavilion</p>
          <h1 className="font-serif text-3xl font-bold text-forest-ink">塔罗研习阁</h1>
          <p className="font-serif text-base font-bold text-forest-muted">观牌，也观心</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
