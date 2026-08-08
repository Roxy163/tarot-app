import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle2, Edit3, Library, Sparkles, Sun } from 'lucide-react';
import { QuizMemoryEntry, TarotReading, TarotCardMetadata } from '../../types';
import { StudyPavilionModules } from '../StudyPavilionModules';
import { DailyFortuneCard } from '../DailyFortuneCard';
import { MysticWatermark } from '../MysticWatermark';
import { useDailyFortune } from '../../hooks/useDailyFortune';
import { cardAnnotationService } from '../../services/cardAnnotationService';

interface HomeTabProps {
  session: { uid?: string; email?: string } | null;
  profile?: { display_name?: string; nickname?: string } | null;
  dailyProverb: string;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  quizMemory: QuizMemoryEntry[];
  onUpdateQuizMemory: React.Dispatch<React.SetStateAction<QuizMemoryEntry[]>>;
  isAuthLoading?: boolean;
  onNavigate: (tab: string) => void;
  onOpenCardLibrary?: (cardId?: string) => void;
  onSearch: (query: string) => void;
  onSelectSpread: (spread: string, category?: string) => void;
  dailyFortune: ReturnType<typeof useDailyFortune>;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  profile,
  readings,
  cardMetadata,
  quizMemory,
  onUpdateQuizMemory,
  onNavigate,
  onOpenCardLibrary,
  onSearch,
  dailyFortune,
}) => {
  const {
    fortunes,
    getToday,
    generateDailyFortuneWithNumber,
    createDailyFortuneFromCard,
    updateDailyFortuneCard,
    archiveDailyFortune,
    updateDailyFortuneReflection,
    saveDailyFortuneToCardAnnotation,
  } = dailyFortune;
  
  const todayFortune = getToday();
  const realReadings = useMemo(() => readings.filter(reading => !reading.isExample), [readings]);
  const reviewedReadings = useMemo(
    () => realReadings.filter(reading => Boolean(reading.userFeedback?.trim())),
    [realReadings],
  );
  const loggedCardCount = useMemo(
    () => realReadings.reduce((total, reading) => total + reading.cards.length, 0),
    [realReadings],
  );
  const archivedDailyFortuneCount = useMemo(
    () => fortunes.filter(fortune => Boolean(fortune.archivedAt)).length,
    [fortunes],
  );
  const dailyFortuneOwnerName = (
    profile?.display_name?.trim()
    || profile?.nickname?.trim()
    || '见习阁主'
  );
  const modifiedAnnotationCount = useMemo(() => cardAnnotationService.getModifiedCardIds().length, []);
  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-2.5 sm:space-y-4"
    >
      <section className="relative overflow-hidden rounded-[1.45rem] border border-forest-accent/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.66),rgba(253,248,240,0.44)_55%,rgba(232,165,152,0.08))] p-2 shadow-[0_14px_42px_-36px_rgba(62,58,54,0.38)] backdrop-blur-sm sm:rounded-[1.65rem] sm:p-3.5">
        <MysticWatermark variant="sun" className="-right-10 -top-12 h-32 w-32 text-forest-accent opacity-[0.04] sm:h-40 sm:w-40" />
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-forest-accent/16 to-transparent" />

        <div className="relative min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-forest-accent/8 bg-white/34 px-2.5 py-1">
            <Sun size={12} className="text-forest-accent" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest-accent">今日研习</p>
          </div>
          <h3 className="mt-1.5 font-serif text-[1.05rem] font-bold text-forest-ink sm:mt-2 sm:text-xl">先抽日运，再把记录变成复盘</h3>
          <p className="mt-0.5 text-[10px] leading-relaxed text-forest-muted sm:mt-1 sm:text-[11px]">
            日常入口集中在这里：抽一张日运，记第一直觉，晚上回来回看。
          </p>
        </div>

        <div id="daily-draw-section" className="relative mt-2 scroll-mt-4 sm:mt-2.5">
          <DailyFortuneCard
            fortune={todayFortune}
            fortunes={fortunes}
            ownerName={dailyFortuneOwnerName}
            embedded
            onGenerateWithNumber={generateDailyFortuneWithNumber}
            onCreateFromCard={createDailyFortuneFromCard}
            onUpdateCard={updateDailyFortuneCard}
            onArchive={archiveDailyFortune}
            onUpdateReflection={updateDailyFortuneReflection}
            onSaveToCardAnnotation={saveDailyFortuneToCardAnnotation}
          />
        </div>

        <div className="relative mt-1.5 grid grid-cols-4 gap-1 sm:mt-2.5 sm:gap-2">
          {[
            { label: '日运', value: archivedDailyFortuneCount, icon: Sun },
            { label: '手记', value: realReadings.length, icon: BookOpen },
            { label: '已复盘', value: reviewedReadings.length, icon: CheckCircle2 },
            { label: '牌面', value: loggedCardCount, icon: Sparkles },
          ].map(item => {
            const Icon = item.icon;
            const hasValue = item.value > 0;
            return (
              <div key={item.label} className="rounded-lg border border-forest-accent/8 bg-[#FFFCF7]/86 px-1.5 py-1 sm:rounded-xl sm:px-2 sm:py-1.5">
                <Icon size={12} className="text-forest-accent" />
                <p className={`mt-0.5 font-serif text-sm font-semibold ${hasValue ? 'text-forest-ink' : 'text-forest-muted/70'}`}>
                  {item.value}
                </p>
                <p className="text-[10px] font-medium text-forest-muted">{item.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            onSearch('');
            onNavigate('private');
          }}
          className="group relative flex min-h-[50px] items-center justify-between gap-2 overflow-hidden rounded-[1.05rem] border border-forest-accent/8 bg-[#FFFCF7]/86 px-2.5 py-2 text-left shadow-[0_10px_30px_-28px_rgba(62,58,54,0.34)] backdrop-blur-sm transition-colors hover:border-forest-accent/20 hover:bg-white/90 sm:min-h-[58px] sm:rounded-[1.2rem] sm:px-3 sm:py-2.5"
        >
          <span className="absolute left-0 top-3 h-7 w-1 rounded-r-full bg-forest-accent/20" />
          <div className="relative flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest-accent/8 text-forest-accent sm:h-8 sm:w-8 sm:rounded-xl">
              <Library size={15} />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-medium text-forest-ink sm:text-sm sm:font-semibold">典籍复盘</span>
              <span className="mt-0.5 hidden text-[11px] leading-relaxed text-forest-muted min-[390px]:block">
                全部 {realReadings.length} 条 · 已复盘 {reviewedReadings.length} 条
              </span>
            </div>
          </div>
          <span
            data-tour="library-review"
            className="relative hidden shrink-0 rounded-full border border-forest-accent/8 bg-white/36 px-2.5 py-0.5 text-[9px] font-medium text-forest-accent transition-colors group-hover:bg-forest-accent group-hover:text-white min-[390px]:inline"
          >
            进入
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onOpenCardLibrary) onOpenCardLibrary();
            else onNavigate('metadata');
          }}
          className="group relative flex min-h-[50px] items-center justify-between gap-2 overflow-hidden rounded-[1.05rem] border border-forest-accent/8 bg-[#FFFCF7]/86 px-2.5 py-2 text-left shadow-[0_10px_30px_-28px_rgba(62,58,54,0.34)] backdrop-blur-sm transition-colors hover:border-forest-accent/20 hover:bg-white/90 sm:min-h-[58px] sm:rounded-[1.2rem] sm:px-3 sm:py-2.5"
        >
          <span className="absolute left-0 top-3 h-7 w-1 rounded-r-full bg-forest-accent/20" />
          <div className="relative flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest-accent/8 text-forest-accent sm:h-8 sm:w-8 sm:rounded-xl">
              <Edit3 size={15} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-forest-ink sm:text-sm sm:font-semibold">牌义注疏</span>
              <span className="mt-0.5 hidden text-[11px] leading-relaxed text-forest-muted min-[390px]:block">
                批量修改单牌释义 · 已自定义 {modifiedAnnotationCount} 张
              </span>
            </span>
          </div>
          <span
            data-tour="card-annotations"
            className="relative hidden shrink-0 rounded-full border border-forest-accent/8 bg-white/36 px-2.5 py-0.5 text-[9px] font-medium text-forest-accent transition-colors group-hover:bg-forest-accent group-hover:text-white min-[390px]:inline"
          >
            编辑
          </span>
        </button>
      </section>

      <StudyPavilionModules
        readings={readings}
        cardMetadata={cardMetadata}
        quizMemory={quizMemory}
        onUpdateQuizMemory={onUpdateQuizMemory}
        onOpenCardLibrary={onOpenCardLibrary}
      />

    </motion.div>
  );
};
