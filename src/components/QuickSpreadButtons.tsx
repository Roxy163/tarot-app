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
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-forest-ink">主题记录</h3>
        <span className="text-[10px] text-forest-muted">手动记录，不会自动抽牌</span>
      </div>
      
      <div className="grid grid-cols-5 gap-1.5">
        {QUICK_SPREADS.map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectSpread(item.spread, item.category)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-forest-accent/10 bg-forest-bg px-1.5 py-1.5 transition-all group hover:border-forest-accent/30 hover:bg-forest-accent/5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-forest-accent/20 to-forest-pink/20 text-forest-accent transition-all group-hover:from-forest-accent/30 group-hover:to-forest-pink/30">
              {React.cloneElement(iconMap[item.icon], { size: 16 })}
            </div>
            <span className="text-[9px] font-bold text-forest-ink">{item.name}</span>
          </motion.button>
        ))}
      </div>
      <p className="rounded-xl bg-white/55 px-2.5 py-1.5 text-[10px] leading-relaxed text-forest-muted">
        选择主题后进入记录页，牌阵会预设好；卡牌仍由你填写或抽取。
      </p>
    </motion.div>
  );
};
