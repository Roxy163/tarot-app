import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { GUIDE_SECTIONS, SPREAD_GUIDE_FEATURES } from './onboarding/guideContent';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface FeatureGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureGuide: React.FC<FeatureGuideProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<keyof typeof GUIDE_SECTIONS>('intro');
  const dialogRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusFirstControl = () => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstControl?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[520] flex items-center justify-center p-4 overscroll-contain"
        >
          <motion.div
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feature-guide-title"
            aria-describedby="feature-guide-subtitle"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden bg-white rounded-[2rem] shadow-2xl"
          >
            <button
              onClick={onClose}
              aria-label="关闭功能介绍"
              className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-lg transition-all"
            >
              <X size={20} className="text-forest-ink" />
            </button>

            <div className="flex flex-col h-full">
              <div className="bg-gradient-to-r from-forest-accent to-forest-pink p-6 text-white">
                <h2 id="feature-guide-title" className="text-2xl font-serif font-bold">{GUIDE_SECTIONS[activeSection].title}</h2>
                <p id="feature-guide-subtitle" className="text-white/80 text-sm mt-1">{GUIDE_SECTIONS[activeSection].subtitle}</p>
              </div>

              <div className="flex border-b border-forest-border">
                {(['intro', 'spreads', 'tips'] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    aria-pressed={activeSection === section}
                    className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                      activeSection === section
                        ? 'text-forest-accent border-b-2 border-forest-accent bg-forest-accent/5'
                        : 'text-forest-muted hover:text-forest-ink'
                    }`}
                  >
                    {section === 'intro' ? '介绍' : section === 'spreads' ? '牌阵' : '贴士'}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-6">
                {activeSection === 'intro' && (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-forest-ink/80 leading-relaxed mb-6">
                      {GUIDE_SECTIONS.intro.content}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {GUIDE_SECTIONS.intro.features.map((feature, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-forest-bg/50 rounded-xl"
                        >
                          <feature.icon size={20} className="text-forest-accent" />
                          <span className="text-xs text-forest-ink">{feature.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeSection === 'spreads' && (
                  <motion.div
                    key="spreads"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {SPREAD_GUIDE_FEATURES.map((feature, idx) => (
                      <motion.div
                        key={feature.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex gap-4 p-4 bg-gradient-to-r bg-forest-bg/30 rounded-xl hover:shadow-md transition-shadow"
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shrink-0`}>
                          <feature.icon size={24} className="text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-forest-ink">{feature.title}</h3>
                          <p className="text-sm text-forest-muted mt-1">{feature.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {activeSection === 'tips' && (
                  <motion.div
                    key="tips"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="space-y-3">
                      {GUIDE_SECTIONS.tips.tips.map((tip, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-start gap-3 p-3 bg-forest-accent/5 rounded-xl"
                        >
                          <span className="w-6 h-6 rounded-full bg-forest-accent text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-forest-ink">{tip}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="p-4 border-t border-forest-border">
                <button
                  onClick={onClose}
                  className="w-full min-h-11 py-3 bg-forest-accent text-white rounded-xl font-bold hover:bg-forest-accent/90 transition-all"
                >
                  开始探索
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
