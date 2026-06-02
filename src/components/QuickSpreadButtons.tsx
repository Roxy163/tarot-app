import React from 'react';
import { motion } from 'motion/react';
import { Sun, Calendar, Moon, Star, Leaf } from 'lucide-react';
import { QUICK_SPREADS } from '../hooks/useDailyFortune';

interface QuickSpreadButtonsProps {
  onSelectSpread: (spread: string, category?: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
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
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-forest-ink">快速占卜</h3>
        <span className="text-[10px] text-forest-muted">运势剖析</span>
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {QUICK_SPREADS.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectSpread(item.spread, item.category)}
            className="flex flex-col items-center gap-2 p-3 bg-forest-bg rounded-xl border border-forest-accent/10 hover:border-forest-accent/30 hover:bg-forest-accent/5 transition-all group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-forest-accent/20 to-forest-pink/20 flex items-center justify-center text-forest-accent group-hover:from-forest-accent/30 group-hover:to-forest-pink/30 transition-all">
              {iconMap[item.icon]}
            </div>
            <span className="text-[10px] font-bold text-forest-ink">{item.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};