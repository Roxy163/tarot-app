import React from 'react';
import { motion } from 'motion/react';
import { Sun, Calendar, Moon, Star, Leaf } from 'lucide-react';
import { QUICK_SPREADS } from '../hooks/useDailyFortune';

interface QuickSpreadButtonsProps {
  onSelectSpread: (spread: string, category?: string) => void;
}

const iconMap: Record<string, React.ReactElement<{ size?: number }>> = {
  Sun: <Sun size={20} />,
  Calendar: <Calendar size={20} />,
  Moon: <Moon size={20} />,
  Star: <Star size={20} />,
  Leaf: <Leaf size={20} />
};

export const QuickSpreadButtons: React.FC<QuickSpreadButtonsProps> = ({ onSelectSpread }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-forest-accent/7 bg-white/24 px-2 py-2 sm:px-2.5"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-forest-accent">速记主题</h3>
        <span className="hidden text-[10px] text-forest-muted min-[390px]:inline">点一下预设标签和牌阵</span>
      </div>
      
      <div className="grid grid-cols-5 gap-1">
        {QUICK_SPREADS.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectSpread(item.spread, item.category)}
            className="group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-forest-accent/8 bg-white/42 px-1 text-[10px] font-medium text-forest-ink transition-all hover:border-forest-accent/24 hover:bg-white/62 sm:flex-row sm:gap-1.5 sm:text-xs"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-accent/8 text-forest-accent transition-all group-hover:bg-forest-accent/12 sm:h-6 sm:w-6">
              {React.cloneElement(iconMap[item.icon], { size: 13 })}
            </span>
            <span className="truncate">{item.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};
