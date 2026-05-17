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
    <div className="bg-forest-accent/5 rounded-2xl border border-forest-accent/5 overflow-hidden">
      <button 
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-forest-accent hover:bg-forest-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <Icon size={16} />
          <span>{title}</span>
        </div>
        <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="px-4 pb-4">
              {subtitle && <p className="text-[10px] text-forest-muted mb-2 px-1">{subtitle}</p>}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
