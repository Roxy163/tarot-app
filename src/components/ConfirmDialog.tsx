import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  destructive = false,
  onConfirm,
  onClose,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-forest-text/25 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative w-full max-w-sm rounded-3xl bg-white border border-forest-border shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${destructive ? 'bg-red-50 text-red-500' : 'bg-forest-accent/10 text-forest-accent'}`}>
                  <AlertTriangle size={18} />
                </div>
                <h3 className="text-lg font-serif font-bold text-forest-ink">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl text-forest-muted hover:text-forest-accent hover:bg-forest-accent/5 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-forest-muted leading-relaxed">{message}</p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-11 rounded-xl bg-forest-bg text-forest-muted text-sm font-bold hover:text-forest-accent transition-colors"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`flex-1 min-h-11 rounded-xl text-white text-sm font-bold shadow-sm transition-colors ${destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-forest-accent hover:bg-forest-accent/90'}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
