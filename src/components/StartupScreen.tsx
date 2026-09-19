import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LoaderCircle, Sparkles } from 'lucide-react';

export function StartupScreen() {
  const [showSlowHint, setShowSlowHint] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSlowHint(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-forest-bg px-6 text-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.15 }}
        className="flex max-w-xs flex-col items-center"
        role="status"
        aria-live="polite"
      >
        <Sparkles size={28} aria-hidden="true" className="mb-4 text-forest-accent" />
        <h1 className="font-serif text-xl font-bold text-forest-ink">塔罗研习阁</h1>
        <p className="mt-3 flex items-center gap-2 text-xs text-forest-muted">
          <LoaderCircle size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          正在加载…
        </p>
        <p className="mt-5 min-h-10 text-[11px] leading-relaxed text-forest-muted">
          {showSlowHint && '连接稍慢，将自动进入本机模式。'}
        </p>
      </motion.div>
    </div>
  );
}
