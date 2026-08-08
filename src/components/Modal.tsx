import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { MysticWatermark } from './MysticWatermark';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, icon }) => {
  useBodyScrollLock(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 overscroll-contain sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-forest-text/10 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-hidden rounded-[1.45rem] border border-forest-accent/7 bg-white/76 shadow-[0_18px_56px_-46px_rgba(62,58,54,0.56)] backdrop-blur-md"
          >
            <MysticWatermark variant="star" className="-right-10 -top-12 h-40 w-40 opacity-[0.035]" />
            <div className="relative max-h-[calc(100dvh-1.5rem)] space-y-3.5 overflow-y-auto p-4 sm:p-5">
              <div className="flex items-center gap-3">
                {icon && <div className="rounded-xl bg-forest-accent/7 p-2 text-forest-accent/90 ring-1 ring-forest-accent/7">{icon}</div>}
                <h3 className="font-serif text-lg font-semibold text-forest-ink sm:text-xl">{title}</h3>
              </div>
              <div className="text-sm text-forest-muted leading-relaxed">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
