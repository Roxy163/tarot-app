import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { SmartTip } from '../../hooks/useSmartTips';

interface SmartTipBannerProps {
  tip: SmartTip;
  isVisible: boolean;
  onDismiss: () => void;
  onAction?: () => void;
}

export const SmartTipBanner: React.FC<SmartTipBannerProps> = ({
  tip,
  isVisible,
  onDismiss,
  onAction,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          data-smart-tip-banner
          initial={{ opacity: 0, y: 100, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 100, x: '-50%' }}
          className="fixed bottom-24 left-1/2 z-[250] bg-white/95 text-forest-text px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md border border-forest-border flex items-center gap-4 min-w-[320px] max-w-[90vw]"
        >
          <div className="w-10 h-10 rounded-full bg-forest-accent/10 flex items-center justify-center shrink-0">
            <Sparkles className="text-forest-accent" size={20} />
          </div>
          
          <span className="flex-1 text-sm font-medium">{tip.message}</span>
          
          <div className="flex items-center gap-2">
            {tip.actionLabel && (
              <button
                onClick={onAction}
                className="min-h-11 px-3 py-2 bg-forest-accent text-white rounded-lg font-bold text-xs hover:bg-forest-accent/90 transition-colors"
              >
                {tip.actionLabel}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="min-h-11 min-w-11 flex items-center justify-center text-forest-muted hover:text-forest-accent transition-colors rounded-lg hover:bg-forest-accent/5"
              aria-label="关闭提示"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
