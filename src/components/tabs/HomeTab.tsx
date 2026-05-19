import React from 'react';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../../types';
import { StudyPavilionModules } from '../StudyPavilionModules';

interface HomeTabProps {
  session: { uid?: string; email?: string } | null;
  profile?: { display_name?: string; nickname?: string } | null;
  dailyProverb: string;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onNavigate: (tab: string) => void;
  onSearch: (query: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  session,
  profile,
  dailyProverb,
  readings,
  cardMetadata,
  onNavigate,
  onSearch
}) => {
  return (
    <motion.div 
      key="home" 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      className="space-y-8"
    >
      {/* Identity & Proverb Area */}
      <div className="flex flex-col items-center gap-6 py-2">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-serif text-forest-ink">
            {session ? `${profile?.display_name || profile?.nickname || session.email?.split('@')[0]}阁主` : '访客 · 观阁中'}
          </h2>
        </div>

        <div className="flex flex-col items-center gap-3 max-w-sm px-6">
          <p className="text-base text-forest-ink/60 font-serif italic tracking-wide text-center leading-relaxed">
            “ {dailyProverb} ”
          </p>
          <div className="flex items-center gap-2 text-forest-accent/20">
            <BookOpen size={12} />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button 
        onClick={() => onNavigate('add')}
        className="w-full group relative overflow-hidden rounded-[2.5rem] bg-forest-accent text-white p-8 text-center transition-all shadow-xl shadow-forest-accent/20 hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-2">
           <div className="text-2xl mb-1">🃏</div>
           <h3 className="text-xl font-bold tracking-wider">开启今日手记</h3>
           <p className="text-[10px] opacity-80 font-medium tracking-widest">随缘抽牌 · 记录此刻</p>
        </div>
      </button>

      {/* Study Pavilion Modules */}
      <StudyPavilionModules 
        readings={readings}
        cardMetadata={cardMetadata}
        setActiveTab={onNavigate}
        setSearchQuery={onSearch}
      />
    </motion.div>
  );
};
