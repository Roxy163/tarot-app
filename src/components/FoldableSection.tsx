import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

interface FoldableSectionProps { 
  icon: any;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  subtitle?: string;
}

export const FoldableSection: React.FC<FoldableSectionProps> = ({ 
  icon: Icon, 
  title, 
  isOpen, 
  onToggle, 
  children,
  subtitle
}) => {
  return (
    <div className="overflow-hidden rounded-[1.05rem] border border-forest-accent/5 bg-forest-accent/[0.035] sm:rounded-2xl">
      <button 
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-forest-accent transition-colors hover:bg-forest-accent/5 sm:px-4"
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold sm:text-sm">
          <Icon size={15} />
          <span>{title}</span>
        </div>
        <ChevronDown size={15} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="px-3 pb-3 sm:px-4 sm:pb-4">
              {subtitle && <p className="text-[10px] text-forest-muted mb-2 px-1">{subtitle}</p>}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
