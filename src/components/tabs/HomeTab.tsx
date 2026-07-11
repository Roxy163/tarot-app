import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Edit3, Library, Sparkles } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../../types';
import { StudyPavilionModules } from '../StudyPavilionModules';
import { DailyFortuneCard } from '../DailyFortuneCard';
import { QuickSpreadButtons } from '../QuickSpreadButtons';
import { useDailyFortune } from '../../hooks/useDailyFortune';
import { cardAnnotationService } from '../../services/cardAnnotationService';

interface HomeTabProps {
  session: { uid?: string; email?: string } | null;
  profile?: { display_name?: string; nickname?: string } | null;
  dailyProverb: string;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onNavigate: (tab: string) => void;
  onSearch: (query: string) => void;
  onSelectSpread: (spread: string, category?: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  session,
  profile,
  dailyProverb,
  readings,
  cardMetadata,
  onNavigate,
  onSearch,
  onSelectSpread
}) => {
  const {
    fortunes,
    getToday,
    generateDailyFortuneWithNumber,
    createDailyFortuneFromCard,
    archiveDailyFortune,
    updateDailyFortuneReflection,
  } = useDailyFortune();
  
  const name = profile?.display_name || profile?.nickname || session?.email?.split('@')[0] || '阁主';
  const displayName = session
    ? `${name}阁主`
    : '访客 · 观阁中';

  const todayFortune = getToday();
  const realReadings = useMemo(() => readings.filter(reading => !reading.isExample), [readings]);
  const reviewedReadings = useMemo(
    () => realReadings.filter(reading => Boolean(reading.userFeedback?.trim())),
    [realReadings],
  );
  const modifiedAnnotationCount = useMemo(() => cardAnnotationService.getModifiedCardIds().length, []);

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 sm:space-y-5"
    >
      <section className="relative overflow-hidden rounded-[1.75rem] border border-forest-accent/15 bg-gradient-to-br from-white via-forest-bg/90 to-forest-accent/10 p-4 shadow-sm shadow-forest-accent/5">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

        <div className="relative space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-forest-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-forest-accent">
            <Sparkles size={12} />
            观牌，也观心
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-serif text-forest-ink">{displayName}</h2>
            <p className="text-sm leading-relaxed text-forest-muted">
              把今天真正想问的事放进心里。抽到的牌，会成为今日手记的开端。
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-forest-accent/10 bg-white/55 px-3 py-2">
            <BookOpen size={14} className="mt-0.5 shrink-0 text-forest-accent/60" />
            <p className="min-w-0 text-xs font-serif italic leading-relaxed text-forest-ink/65 sm:text-sm">
              “{dailyProverb}”
            </p>
          </div>
        </div>
      </section>

      <div>
        <DailyFortuneCard
          fortune={todayFortune}
          fortunes={fortunes}
          onGenerateWithNumber={generateDailyFortuneWithNumber}
          onCreateFromCard={createDailyFortuneFromCard}
          onArchive={archiveDailyFortune}
          onUpdateReflection={updateDailyFortuneReflection}
        />
      </div>

      <section className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            onSearch('');
            onNavigate('private');
          }}
          className="group flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-forest-accent/10 bg-white/85 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-forest-accent/30"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent">
              <Library size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-forest-ink">典籍复盘</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-forest-muted">
                全部 {realReadings.length} 条 · 已复盘 {reviewedReadings.length} 条
              </span>
            </span>
          </div>
          <span
            data-tour="library-review"
            className="shrink-0 rounded-full bg-forest-accent/10 px-2.5 py-0.5 text-[9px] font-bold text-forest-accent transition-colors group-hover:bg-forest-accent group-hover:text-white"
          >
            进入
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('metadata')}
          className="group flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-forest-accent/10 bg-white/85 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-forest-accent/30"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent">
              <Edit3 size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-forest-ink">牌义注疏</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-forest-muted">
                批量修改单牌释义 · 已自定义 {modifiedAnnotationCount} 张
              </span>
            </span>
          </div>
          <span
            data-tour="card-annotations"
            className="shrink-0 rounded-full bg-forest-accent/10 px-2.5 py-0.5 text-[9px] font-bold text-forest-accent transition-colors group-hover:bg-forest-accent group-hover:text-white"
          >
            编辑
          </span>
        </button>
      </section>

      <QuickSpreadButtons onSelectSpread={onSelectSpread} />

      <StudyPavilionModules
        readings={readings}
        cardMetadata={cardMetadata}
        setActiveTab={onNavigate}
      />

    </motion.div>
  );
};
