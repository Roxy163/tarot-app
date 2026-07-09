import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  Edit3,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { cardAnnotationService } from '../services/cardAnnotationService';

interface StudyPavilionModulesProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  setActiveTab: (tab: string) => void;
}

const getReadingDate = (reading: TarotReading) => new Date(reading.readingDate || reading.date);

const splitMeaning = (meaning?: string) => (
  (meaning || '')
    .split(/[。；;.!！？?]/)
    .map(part => part.trim())
    .filter(Boolean)
);

const formatMeaning = (meaning?: string, fallback?: string) => {
  const fragments = splitMeaning(meaning || fallback).slice(0, 2);
  return fragments.length > 0
    ? `${fragments.join('。')}。`
    : '这张牌需要结合画面、位置和问题语境来理解；先观察它带来的情绪，再判断它要求行动、等待、取舍还是修正。';
};

const getElementPrompt = (element?: string | null) => {
  switch (element) {
    case '火':
      return '把它放进问题里时，先问：这里的欲望、行动力或冲突正在把我推向哪里？';
    case '水':
      return '把它放进问题里时，先问：这里真正流动的是情绪、关系需求，还是未说出口的感受？';
    case '风':
      return '把它放进问题里时，先问：这里卡住的是想法、沟通、判断，还是我对真相的回避？';
    case '土':
      return '把它放进问题里时，先问：这里最现实的资源、身体感受、金钱或长期结果是什么？';
    default:
      return '把它放进问题里时，先问：它是在提醒我开始、调整、放下，还是整合一个阶段？';
  }
};

const getReadingCardContext = (readings: TarotReading[], cardName: string) => {
  const reading = [...readings]
    .sort((a, b) => getReadingDate(b).getTime() - getReadingDate(a).getTime())
    .find(item => item.cards?.some(card => card.name === cardName));

  if (!reading) return null;

  const cardIndex = reading.cards.findIndex(card => card.name === cardName);
  const card = reading.cards[cardIndex];
  const interpretation = reading.cardInterpretations?.[cardIndex] || '';

  return {
    reading,
    card,
    interpretation,
  };
};

export const StudyPavilionModules: React.FC<StudyPavilionModulesProps> = ({
  readings,
  cardMetadata,
  setActiveTab,
}) => {
  const [quizIndex, setQuizIndex] = useState(() => Math.floor(Math.random() * TAROT_CARDS.length));
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);

  const userReadings = useMemo(
    () => readings.filter(reading => !reading.isExample),
    [readings],
  );

  const summary = useMemo(() => {
    const cardCounts: Record<string, number> = {};

    userReadings.forEach(reading => {
      reading.cards?.forEach(card => {
        if (!card?.name) return;
        cardCounts[card.name] = (cardCounts[card.name] || 0) + 1;
      });
    });

    return {
      cardCounts,
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
  const quizReadingContext = useMemo(
    () => getReadingCardContext(userReadings, quizCard.name),
    [userReadings, quizCard.name],
  );
  const quizAnnotation = useMemo(
    () => cardAnnotationService.getMergedAnnotation(quizCard.id),
    [quizCard.id],
  );
  const astro = quizCardMeta.astrology;
  const quizHints = [
    quizAnnotation.numerology || (quizCardMeta.default_numerology !== null && quizCardMeta.default_numerology !== undefined
      ? `数字 ${quizCardMeta.default_numerology}`
      : null),
    quizAnnotation.element || (astro?.element ? `${astro.element}元素` : null),
    quizAnnotation.zodiac || quizAnnotation.planet || astro?.zodiac || astro?.planet || null,
    quizAnnotation.house || astro?.house || null,
  ].filter(Boolean);
  const quizKeywords = (quizAnnotation.keywords.length > 0 ? quizAnnotation.keywords : quizCardMeta.keywords || []).slice(0, 5);
  const uprightAnswer = formatMeaning(quizAnnotation.uprightMeaning, quizCardMeta.meaning);
  const reversedAnswer = formatMeaning(quizAnnotation.reversedMeaning, quizCardMeta.reversedMeaning);
  const practicePrompt = getElementPrompt(quizAnnotation.element || astro?.element);

  const handleNextQuiz = () => {
    setQuizIndex(current => current + 1 + Math.floor(Math.random() * Math.max(1, quizDeck.length - 1)));
    setShowQuizAnswer(false);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white/95 border border-forest-accent/10 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-forest-accent/10 flex items-center justify-between gap-3 bg-forest-accent/5">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-forest-accent" />
            <h3 className="text-sm font-bold text-forest-ink">牌意小考</h3>
          </div>
          <button
            type="button"
            onClick={handleNextQuiz}
            className="w-11 h-11 rounded-full border border-forest-accent/20 text-forest-accent flex items-center justify-center hover:bg-forest-accent/5 transition-colors"
            title="换一张"
            aria-label="换一张牌"
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
              <p className="mt-3 text-[10px] font-bold text-forest-accent">单牌记忆练习</p>
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
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-forest-ink">答案线索</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quizKeywords.length > 0 ? quizKeywords.map(keyword => (
                        <span key={keyword} className="px-2 py-0.5 rounded-full bg-white border border-forest-accent/10 text-[10px] font-bold text-forest-accent">
                          {keyword}
                        </span>
                      )) : (
                        <span className="text-[10px] text-forest-muted">暂无关键词，建议先从画面和问题语境切入。</span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="rounded-xl bg-white/75 border border-forest-accent/10 p-3">
                      <p className="text-[10px] font-bold text-forest-accent mb-1">正位主轴</p>
                      <p className="text-xs text-forest-text leading-relaxed">{uprightAnswer}</p>
                    </div>
                    <div className="rounded-xl bg-white/75 border border-forest-pink/10 p-3">
                      <p className="text-[10px] font-bold text-forest-pink mb-1">逆位提醒</p>
                      <p className="text-xs text-forest-text leading-relaxed">{reversedAnswer}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-forest-accent/5 border border-forest-accent/10 p-3">
                    <p className="text-[10px] font-bold text-forest-accent mb-1">读牌练习</p>
                    <p className="text-xs text-forest-text leading-relaxed">{practicePrompt}</p>
                    <p className="mt-2 text-[10px] text-forest-muted leading-relaxed">
                      {quizHints.length > 0 ? `体系线索：${quizHints.join(' · ')}` : '体系线索：这张牌更适合从牌面情境与问题语境进入。'}
                    </p>
                  </div>

                  {quizAnnotation.personalNotes && (
                    <div className="rounded-xl bg-white/70 border border-forest-border/70 p-3">
                      <p className="text-[10px] font-bold text-forest-ink mb-1">你的注解</p>
                      <p className="text-xs text-forest-text leading-relaxed">{formatMeaning(quizAnnotation.personalNotes)}</p>
                    </div>
                  )}

                  {quizReadingContext && (
                    <div className="rounded-xl bg-white/70 border border-forest-border/70 p-3">
                      <p className="text-[10px] font-bold text-forest-muted mb-1">
                        最近出现：{quizReadingContext.card?.isReversed ? '逆位' : '正位'}
                      </p>
                      <p className="text-xs text-forest-text leading-relaxed">
                        {quizReadingContext.reading.question}
                      </p>
                      {quizReadingContext.interpretation && (
                        <p className="mt-2 text-[10px] text-forest-muted leading-relaxed">
                          当时记录：{formatMeaning(quizReadingContext.interpretation)}
                        </p>
                      )}
                    </div>
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
              className="min-h-11 py-2.5 rounded-xl bg-forest-accent text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-forest-accent/90 transition-colors"
            >
              <Eye size={14} />
              {showQuizAnswer ? '收起答案' : '查看答案'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('metadata')}
              className="min-h-11 py-2.5 rounded-xl bg-white border border-forest-accent/20 text-forest-accent text-xs font-bold flex items-center justify-center gap-2 hover:bg-forest-accent/5 transition-colors"
            >
              <Edit3 size={14} />
              批量编辑牌义
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
