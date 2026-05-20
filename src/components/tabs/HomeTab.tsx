import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, PenLine } from 'lucide-react';
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
  const displayName = session
    ? `${profile?.display_name || profile?.nickname || session.email?.split('@')[0]}阁主`
    : '访客 · 观阁中';

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <section className="flex flex-col items-center gap-4 pt-1">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-serif text-forest-ink">{displayName}</h2>
          <div className="flex flex-col items-center gap-3 max-w-sm px-5">
            <p className="text-base text-forest-ink/60 font-serif italic tracking-wide text-center leading-relaxed">
              “{dailyProverb}”
            </p>
            <div className="flex items-center gap-2 text-forest-accent/20">
              <BookOpen size={12} />
            </div>
          </div>
        </div>
      </section>

      <button
        onClick={() => onNavigate('add')}
        className="w-full group relative overflow-hidden rounded-[2rem] bg-forest-accent text-white px-6 py-6 text-left transition-all shadow-xl shadow-forest-accent/15 hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase opacity-75">Daily Reading</p>
            <h3 className="mt-1 text-2xl font-serif font-bold tracking-wide">开启今日手记</h3>
            <p className="mt-1 text-xs opacity-85">随缘抽牌 · 记录此刻</p>
          </div>
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
            <PenLine size={24} />
          </span>
        </div>
      </button>

      <StudyPavilionModules
        readings={readings}
        cardMetadata={cardMetadata}
        setActiveTab={onNavigate}
        setSearchQuery={onSearch}
      />
    </motion.div>
  );
};
