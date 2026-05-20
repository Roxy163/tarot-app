import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  Eye,
  Flame,
  Library,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';

interface StudyPavilionModulesProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
}

const getReadingDate = (reading: TarotReading) => new Date(reading.readingDate || reading.date);

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getStudyStreak = (readings: TarotReading[]) => {
  const activeDays = new Set(readings.map(reading => getDateKey(getReadingDate(reading))));
  let streak = 0;
  const cursor = getStartOfDay(new Date());

  while (activeDays.has(getDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const StudyPavilionModules: React.FC<StudyPavilionModulesProps> = ({
  readings,
  cardMetadata,
  setActiveTab,
  setSearchQuery,
}) => {
  const [quizIndex, setQuizIndex] = useState(() => Math.floor(Math.random() * TAROT_CARDS.length));
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);

  const userReadings = useMemo(
    () => readings.filter(reading => !reading.isExample),
    [readings],
  );

  const summary = useMemo(() => {
    const now = new Date();
    const weekStart = getStartOfDay(now);
    weekStart.setDate(weekStart.getDate() - 6);

    const weekReadings = userReadings.filter(reading => getReadingDate(reading) >= weekStart);
    const publicCount = userReadings.filter(reading => reading.isPublic).length;
    const cardCounts: Record<string, number> = {};

    userReadings.forEach(reading => {
      reading.cards?.forEach(card => {
        if (!card?.name) return;
        cardCounts[card.name] = (cardCounts[card.name] || 0) + 1;
      });
    });

    const topCard = Object.entries(cardCounts).sort((a, b) => b[1] - a[1])[0] || null;
    const latestReading = [...userReadings].sort(
      (a, b) => getReadingDate(b).getTime() - getReadingDate(a).getTime(),
    )[0] || null;

    return {
      total: userReadings.length,
      weekCount: weekReadings.length,
      publicCount,
      cardCounts,
      topCard,
      latestReading,
      streak: getStudyStreak(userReadings),
    };
  }, [userReadings]);

  const quizDeck = useMemo(() => {
    const usedCards = Object.keys(summary.cardCounts)
      .map(name => TAROT_CARDS.find(card => card.name === name))
      .filter((card): card is TarotCardMetadata => Boolean(card));

    return usedCards.length > 0 ? usedCards : TAROT_CARDS;
  }, [summary.cardCounts]);

  const quizCard = quizDeck[quizIndex % quizDeck.length] || TAROT_CARDS[0];
  const quizCardMeta = cardMetadata.find(card => card.name === quizCard.name) || quizCard;
  const quizCardCount = summary.cardCounts[quizCard.name] || 0;
  const quizReading = userReadings.find(reading => reading.cards?.some(card => card.name === quizCard.name));
  const astro = quizCardMeta.astrology;
  const quizHints = [
    quizCardMeta.default_numerology !== null && quizCardMeta.default_numerology !== undefined
      ? `数字 ${quizCardMeta.default_numerology}`
      : null,
    astro?.element ? `${astro.element}元素` : null,
    astro?.zodiac || astro?.planet || null,
    astro?.house || null,
  ].filter(Boolean);

  const handleNextQuiz = () => {
    setQuizIndex(current => current + 1 + Math.floor(Math.random() * Math.max(1, quizDeck.length - 1)));
    setShowQuizAnswer(false);
  };

  const statItems = [
    { label: '本周手记', value: summary.weekCount, suffix: '条', icon: CalendarDays, tone: 'text-forest-accent' },
    { label: '连续记录', value: summary.streak, suffix: '天', icon: Flame, tone: 'text-forest-pink' },
    { label: '全部记录', value: summary.total, suffix: '条', icon: BarChart3, tone: 'text-forest-ink' },
    { label: '公开分享', value: summary.publicCount, suffix: '条', icon: BookOpen, tone: 'text-forest-accent' },
  ];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3">
        {statItems.map(item => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              type="button"
              onClick={() => setActiveTab(item.label === '公开分享' ? 'public' : 'private')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-h-[92px] rounded-2xl bg-white/95 border border-forest-accent/10 px-4 py-3 text-left shadow-sm hover:border-forest-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-forest-text/70">{item.label}</span>
                <Icon size={16} className={item.tone} />
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-serif font-bold text-forest-ink">{item.value}</span>
                <span className="text-xs text-forest-muted">{item.suffix}</span>
              </div>
            </motion.button>
          );
        })}
      </section>

      <section className="rounded-2xl bg-white/95 border border-forest-accent/10 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-forest-accent/10 flex items-center justify-between gap-3 bg-forest-accent/5">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-forest-accent" />
            <h3 className="text-sm font-bold text-forest-ink">牌意小考</h3>
          </div>
          <button
            type="button"
            onClick={handleNextQuiz}
            className="w-8 h-8 rounded-full border border-forest-accent/20 text-forest-accent flex items-center justify-center hover:bg-forest-accent/5 transition-colors"
            title="换一张"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-forest-bg border border-forest-border shadow-sm">
              <img
                src={getCardImageUrl(quizCard.id)}
                alt={quizCard.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-serif font-bold text-forest-ink">{quizCard.name}</p>
              <p className="text-xs text-forest-muted font-mono">{quizCard.english}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-full bg-forest-accent/5 text-forest-accent text-[10px] font-bold">
                  出现 {quizCardCount} 次
                </span>
                {summary.topCard?.[0] === quizCard.name && (
                  <span className="px-2.5 py-1 rounded-full bg-forest-pink/10 text-forest-pink text-[10px] font-bold">
                    高频牌
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-forest-bg/50 border border-forest-border/70 p-3 min-h-[92px]">
            <AnimatePresence mode="wait">
              {showQuizAnswer ? (
                <motion.div
                  key="answer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-2"
                >
                  <p className="text-xs font-bold text-forest-ink">体系线索</p>
                  <p className="text-xs text-forest-text leading-relaxed">
                    {quizHints.length > 0 ? quizHints.join(' · ') : '这张牌更适合从牌面情境与问题语境进入。'}
                  </p>
                  {quizReading && (
                    <p className="text-[10px] text-forest-muted leading-relaxed">
                      最近出现：{quizReading.question}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="question"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-2"
                >
                  <p className="text-xs font-bold text-forest-ink">先在心里说出三个关键词</p>
                  <p className="text-xs text-forest-muted leading-relaxed">
                    再回想它在正位、逆位、感情或事业问题里分别如何变化。
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowQuizAnswer(value => !value)}
              className="py-2.5 rounded-xl bg-forest-accent text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-forest-accent/90 transition-colors"
            >
              <Eye size={14} />
              {showQuizAnswer ? '收起答案' : '查看答案'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('metadata')}
              className="py-2.5 rounded-xl bg-white border border-forest-accent/20 text-forest-accent text-xs font-bold flex items-center justify-center gap-2 hover:bg-forest-accent/5 transition-colors"
            >
              <Library size={14} />
              去写牌义
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white/95 border border-forest-accent/10 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-forest-accent" />
            <h3 className="text-sm font-bold text-forest-ink">最近手记</h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('private')}
            className="text-[10px] font-bold text-forest-accent flex items-center gap-1"
          >
            全部 <ArrowRight size={12} />
          </button>
        </div>

        {summary.latestReading ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery(summary.latestReading?.id || '');
              setActiveTab('private');
            }}
            className="w-full text-left rounded-xl bg-forest-bg/50 border border-forest-border/70 p-3 hover:border-forest-accent/30 transition-colors"
          >
            <p className="text-xs font-bold text-forest-ink truncate">{summary.latestReading.question}</p>
            <p className="mt-1 text-[10px] text-forest-muted">
              {getReadingDate(summary.latestReading).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              {' · '}
              {summary.latestReading.cards?.map(card => card.name).join(' / ')}
            </p>
          </button>
        ) : (
          <div className="rounded-xl bg-forest-bg/50 border border-forest-border/70 p-4 text-center">
            <p className="text-xs text-forest-muted">还没有手记。今日第一张牌，留给一个真正的问题。</p>
          </div>
        )}
      </section>

      {summary.topCard && (
        <section className="rounded-2xl bg-forest-pink/5 border border-forest-pink/10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-forest-pink tracking-wide">近期高频牌</p>
            <p className="text-sm font-bold text-forest-ink truncate">
              {summary.topCard[0]} · 出现 {summary.topCard[1]} 次
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery(summary.topCard?.[0] || '');
              setActiveTab('private');
            }}
            className="px-3 py-2 rounded-xl bg-white text-forest-pink text-[10px] font-bold border border-forest-pink/10"
          >
            回看
          </button>
        </section>
      )}
    </div>
  );
};
