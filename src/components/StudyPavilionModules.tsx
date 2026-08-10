import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Edit3,
  Library,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react';
import { getCardImageUrl } from '../constants';
import type { QuizMemoryAttempt, QuizMemoryEntry, TarotCardMetadata, TarotReading } from '../types';
import { cardAnnotationService } from '../services/cardAnnotationService';
import {
  buildQuizTrainingCards,
  createQuizQuestion,
  DEFAULT_QUIZ_FILTERS,
  filterQuizTrainingCards,
  formatQuizDisplayValue,
  getAvailableCorrespondenceValues,
  getRecentWeakQuizCards,
  getRepeatedQuizMemoryCount,
  mergeKeywordInput,
  updateQuizMemory,
  type QuizCardGroup,
  type QuizQuestion,
  type QuizQuestionKind,
  type QuizQuestionOption,
  type QuizSuit,
  type QuizTrainingFilters,
} from '../lib/tarotQuizTraining';
import { trackEvent } from '../lib/analytics';
import { TarotCardImage } from './TarotCardImage';

interface StudyPavilionModulesProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  quizMemory: QuizMemoryEntry[];
  onUpdateQuizMemory: React.Dispatch<React.SetStateAction<QuizMemoryEntry[]>>;
  onOpenCardLibrary?: (cardId?: string) => void;
}

const createDefaultFilters = (): QuizTrainingFilters => ({
  ...DEFAULT_QUIZ_FILTERS,
  groups: [],
  suits: [],
  elements: [],
  planets: [],
  zodiacs: [],
  houses: [],
});

const GROUP_OPTIONS: Array<{ value: QuizCardGroup; label: string }> = [
  { value: 'major', label: '大阿卡纳' },
  { value: 'minor', label: '小阿卡纳' },
  { value: 'court', label: '宫廷牌' },
  { value: 'numbered', label: '数字牌' },
];

const SUIT_OPTIONS: Array<{ value: QuizSuit; label: string }> = [
  { value: 'wands', label: '权杖' },
  { value: 'cups', label: '圣杯' },
  { value: 'swords', label: '宝剑' },
  { value: 'pentacles', label: '星币' },
];

const ELEMENT_OPTIONS = ['火', '水', '风', '土'];

const QUIZ_MODE_OPTIONS: Array<{ value: QuizQuestionKind; label: string }> = [
  { value: 'correspondence', label: '看牌对应' },
  { value: 'meaning-card', label: '文字找牌' },
];

const DECK_PRESET_OPTIONS: Array<{ value: QuizCardGroup | 'all' | 'repeat'; label: string }> = [
  { value: 'all', label: '全部牌库' },
  { value: 'repeat', label: '只看待温习' },
  ...GROUP_OPTIONS,
];

const SUIT_PRESET_OPTIONS = [
  { value: '', label: '不限牌组' },
  ...SUIT_OPTIONS,
];

const ELEMENT_PRESET_OPTIONS = [
  { value: '', label: '不限元素' },
  ...ELEMENT_OPTIONS.map(element => ({ value: element, label: `${element}元素` })),
];

const getSelectValue = (items: string[]) => items[0] || '';

const getQuestionLabel = (question: QuizQuestion) => (
  question.kind === 'correspondence' ? '看牌对应' : '文字找牌'
);

interface RecentQuizAttempt extends QuizMemoryAttempt {
  cardId: string;
  cardName: string;
  repeated?: boolean;
}

const getMemoryTime = (entry: QuizMemoryEntry) => (
  entry.lastPracticedAt || entry.updatedAt || entry.createdAt || ''
);

const getQuizMistakeCount = (entry: QuizMemoryEntry) => (
  (entry.wrongCount || 0) + (entry.unfamiliarCount || 0)
);

const getQuizAccuracy = (entry: QuizMemoryEntry) => {
  const practiceCount = entry.practiceCount || 0;
  if (practiceCount <= 0) return null;
  return Math.max(0, Math.round(((practiceCount - (entry.wrongCount || 0)) / practiceCount) * 100));
};

const formatQuizTime = (value?: string) => {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';

  const today = new Date().toISOString().slice(0, 10);
  const day = date.toISOString().slice(0, 10);
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (day === today) return `今天 ${time}`;
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

export const StudyPavilionModules: React.FC<StudyPavilionModulesProps> = ({
  cardMetadata,
  quizMemory,
  onUpdateQuizMemory,
  onOpenCardLibrary,
}) => {
  const [filters, setFilters] = useState<QuizTrainingFilters>(() => createDefaultFilters());
  const [showArchive, setShowArchive] = useState(false);
  const [showArchiveSettings, setShowArchiveSettings] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizQuestionKind>('correspondence');
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showKeywordForm, setShowKeywordForm] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordStatus, setKeywordStatus] = useState<string | null>(null);
  const [annotationRefreshKey, setAnnotationRefreshKey] = useState(0);
  const [winKey, setWinKey] = useState(0);
  const [recentQuizAttempts, setRecentQuizAttempts] = useState<RecentQuizAttempt[]>([]);
  const lastCorrectOptionIndexRef = useRef<number | null>(null);
  const correctOptionSlotCountsRef = useRef([0, 0, 0, 0]);

  useEffect(() => {
    if (!showArchive) {
      setShowArchiveSettings(false);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowArchive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showArchive]);

  const quizCards = useMemo(
    () => buildQuizTrainingCards(cardMetadata, cardAnnotationService.getAllMergedAnnotations()),
    [annotationRefreshKey, cardMetadata],
  );

  const cardsById = useMemo(
    () => new Map(quizCards.map(card => [card.id, card])),
    [quizCards],
  );

  const activeDeck = useMemo(
    () => filterQuizTrainingCards(quizCards, filters, quizMemory),
    [filters, quizCards, quizMemory],
  );

  const repeatedCount = getRepeatedQuizMemoryCount(quizMemory);
  const weakCards = useMemo(
    () => getRecentWeakQuizCards(quizMemory, quizCards, 3),
    [quizMemory, quizCards],
  );
  const todayQuizCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return quizMemory.filter(entry => entry.lastPracticedAt?.startsWith(today)).length;
  }, [quizMemory]);
  const totalPracticeCount = useMemo(
    () => quizMemory.reduce((total, entry) => total + (entry.practiceCount || 0), 0),
    [quizMemory],
  );
  const totalWrongCount = useMemo(
    () => quizMemory.reduce((total, entry) => total + (entry.wrongCount || 0), 0),
    [quizMemory],
  );
  const accuracyRate = totalPracticeCount > 0
    ? Math.max(0, Math.round(((totalPracticeCount - totalWrongCount) / totalPracticeCount) * 100))
    : null;
  const repeatedRows = useMemo(() => (
    [...quizMemory]
      .filter(entry => entry.repeated)
      .sort((a, b) => getMemoryTime(b).localeCompare(getMemoryTime(a)))
      .slice(0, 3)
  ), [quizMemory]);
  const recentMemoryRows = useMemo(() => (
    [...quizMemory]
      .filter(entry => (entry.practiceCount || 0) > 0 || Boolean(entry.lastPracticedAt))
      .sort((a, b) => getMemoryTime(b).localeCompare(getMemoryTime(a)))
      .slice(0, 4)
  ), [quizMemory]);
  const persistentAttemptRows = useMemo<RecentQuizAttempt[]>(() => (
    quizMemory
      .flatMap(entry => (entry.attempts || []).map(attempt => ({
        ...attempt,
        cardId: entry.cardId,
        cardName: entry.cardName,
        repeated: entry.repeated,
      })))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
  ), [quizMemory]);
  const archiveAttemptRows = recentQuizAttempts.length > 0 ? recentQuizAttempts : persistentAttemptRows;
  const weakMemoryRows = useMemo(() => (
    [...quizMemory]
      .filter(entry => getQuizMistakeCount(entry) > 0 || entry.repeated)
      .sort((a, b) => (
        getQuizMistakeCount(b) - getQuizMistakeCount(a)
        || getMemoryTime(b).localeCompare(getMemoryTime(a))
      ))
      .slice(0, 4)
  ), [quizMemory]);

  const planetOptions = useMemo(() => getAvailableCorrespondenceValues(quizCards, 'planet'), [quizCards]);
  const zodiacOptions = useMemo(() => getAvailableCorrespondenceValues(quizCards, 'zodiac'), [quizCards]);
  const houseOptions = useMemo(() => getAvailableCorrespondenceValues(quizCards, 'house'), [quizCards]);

  const activeFilterLabels = useMemo(() => [
    ...GROUP_OPTIONS.filter(option => filters.groups.includes(option.value)).map(option => option.label),
    ...SUIT_OPTIONS.filter(option => filters.suits.includes(option.value)).map(option => option.label),
    ...filters.elements.map(element => `${element}元素`),
    ...filters.planets,
    ...filters.zodiacs,
    ...(filters.repeatOnly ? ['待温习'] : []),
  ], [filters]);
  const hasActiveFilters = activeFilterLabels.length > 0;
  const selectedDeckPreset: QuizCardGroup | 'all' | 'repeat' = filters.repeatOnly
    ? 'repeat'
    : filters.groups[0] || 'all';

  const resetLocalAnswerState = () => {
    setSelectedOptionId(null);
    setShowKeywordForm(false);
    setKeywordInput('');
    setKeywordStatus(null);
  };

  const drawQuestion = useCallback(() => {
    const previousCorrectIndex = lastCorrectOptionIndexRef.current;
    const slotCounts = correctOptionSlotCountsRef.current;
    const minSlotCount = Math.min(...slotCounts);
    const leastUsedSlots = slotCounts
      .map((count, slot) => ({ count, slot }))
      .filter(item => item.count === minSlotCount)
      .map(item => item.slot);
    const candidateSlots = leastUsedSlots.length > 1
      ? leastUsedSlots.filter(slot => slot !== previousCorrectIndex)
      : leastUsedSlots;
    const nextCorrectIndex = candidateSlots[Math.floor(Math.random() * candidateSlots.length)] ?? 0;
    const nextQuestion = createQuizQuestion(activeDeck, quizMemory, Math.random, {
      kinds: [quizMode],
      correctOptionIndex: nextCorrectIndex,
    });
    if (nextQuestion) {
      const actualCorrectIndex = nextQuestion.options.findIndex(option => option.id === nextQuestion.correctOptionId);
      if (actualCorrectIndex >= 0) {
        lastCorrectOptionIndexRef.current = actualCorrectIndex;
        correctOptionSlotCountsRef.current[actualCorrectIndex] += 1;
      }
      trackEvent('quiz_question_refreshed', {
        quiz_kind: nextQuestion.kind,
        active_filter_count: activeFilterLabels.length,
        option_count: nextQuestion.options.length,
      });
    }
    setQuestion(nextQuestion);
    resetLocalAnswerState();
  }, [activeDeck, activeFilterLabels.length, quizMemory, quizMode]);

  useEffect(() => {
    if (question || activeDeck.length === 0) return;
    drawQuestion();
  }, [activeDeck.length, drawQuestion, question]);

  const updateFilters = (updater: (current: QuizTrainingFilters) => QuizTrainingFilters) => {
    setFilters(current => updater(current));
    setQuestion(null);
    resetLocalAnswerState();
  };

  const updateQuizMode = (nextMode: QuizQuestionKind) => {
    setQuizMode(nextMode);
    setQuestion(null);
    resetLocalAnswerState();
  };

  const updateDeckPreset = (value: QuizCardGroup | 'all' | 'repeat') => {
    updateFilters(current => ({
      ...current,
      repeatOnly: value === 'repeat',
      groups: value === 'all' || value === 'repeat' ? [] : [value],
    }));
  };

  const updateSuitPreset = (value: string) => {
    updateFilters(current => ({
      ...current,
      suits: value ? [value as QuizSuit] : [],
    }));
  };

  const updateElementPreset = (value: string) => {
    updateFilters(current => ({
      ...current,
      elements: value ? [value] : [],
    }));
  };

  const updatePlanetPreset = (value: string) => {
    updateFilters(current => ({
      ...current,
      planets: value ? [value] : [],
    }));
  };

  const updateZodiacPreset = (value: string) => {
    updateFilters(current => ({
      ...current,
      zodiacs: value ? [value] : [],
    }));
  };

  const updateHousePreset = (value: string) => {
    updateFilters(current => ({
      ...current,
      houses: value ? [value] : [],
    }));
  };

  const questionCard = question?.cardId ? cardsById.get(question.cardId) || null : null;
  const isAnswered = Boolean(question && selectedOptionId);
  const isCorrect = Boolean(question && selectedOptionId === question.correctOptionId);
  const canRevealQuestionCard = Boolean(questionCard && isAnswered);
  const systemTags = questionCard ? [
    { label: '元素', value: questionCard.element ? formatQuizDisplayValue(questionCard.element) : null },
    { label: '行星', value: questionCard.planet ? formatQuizDisplayValue(questionCard.planet) : null },
    { label: '星座', value: questionCard.zodiac ? formatQuizDisplayValue(questionCard.zodiac) : null },
    { label: '宫位', value: questionCard.house ? formatQuizDisplayValue(questionCard.house) : null },
    { label: '数字', value: questionCard.numerology ? formatQuizDisplayValue(questionCard.numerology) : null },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value)) : [];
  const quizModeLabel = QUIZ_MODE_OPTIONS.find(option => option.value === quizMode)?.label || '看牌对应';
  const renderDrawQuestionButton = (label = '换一题', compact = false) => (
    <button
      type="button"
      onClick={drawQuestion}
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-forest-accent/90 font-medium text-white transition-all hover:bg-forest-accent active:scale-[0.98] ${
        compact
          ? 'shrink-0 px-2.5 text-[11px]'
          : 'w-full px-4 text-sm'
      }`}
    >
      <RefreshCw size={compact ? 13 : 16} />
      {label}
    </button>
  );

  const handleOptionSelect = (option: QuizQuestionOption) => {
    if (!question || selectedOptionId || !questionCard) return;

    setSelectedOptionId(option.id);

    const correct = option.id === question.correctOptionId;
    const now = new Date().toISOString();
    const selectedLabel = option.cardId ? cardsById.get(option.cardId)?.name || option.label : option.label;
    const attempt = {
      modeLabel: getQuestionLabel(question),
      prompt: question.prompt,
      answerLabel: question.answerLabel,
      selectedLabel,
      correct,
    };
    setRecentQuizAttempts(current => [
      {
        id: `${question.id}-${now}`,
        cardId: questionCard.id,
        cardName: questionCard.name,
        createdAt: now,
        ...attempt,
      },
      ...current,
    ].slice(0, 5));
    onUpdateQuizMemory(current => updateQuizMemory(current, questionCard, correct ? 'remembered' : 'wrong', now, attempt));
    trackEvent('quiz_answered', {
      quiz_kind: question.kind,
      is_correct: correct,
      option_count: question.options.length,
      active_filter_count: activeFilterLabels.length,
    });
    if (correct) setWinKey(current => current + 1);
  };

  const handleRemembered = () => {
    if (!questionCard) return;
    onUpdateQuizMemory(current => updateQuizMemory(current, questionCard, 'clear-repeat'));
    setKeywordStatus('这张牌已从待温习中移出。');
  };

  const handleSaveKeywords = () => {
    if (!questionCard || !keywordInput.trim()) return;

    const merged = cardAnnotationService.getMergedAnnotation(questionCard.id);
    const nextKeywords = mergeKeywordInput(merged.keywords, keywordInput);
    const addedCount = nextKeywords.length - merged.keywords.map(keyword => keyword.trim()).filter(Boolean).length;

    cardAnnotationService.saveUserAnnotation(questionCard.id, {
      keywords: nextKeywords,
    });
    setAnnotationRefreshKey(current => current + 1);
    setKeywordInput('');
    setKeywordStatus(addedCount > 0 ? '已存入牌义注疏。' : '这些关键词已经在注疏里了。');
    trackEvent('quiz_keywords_saved', { added_count: Math.max(addedCount, 0) });
  };

  const renderQuizHeaderActions = () => {
    if (!isAnswered) return renderDrawQuestionButton('换题', true);

    return (
      <div className="grid w-[8.25rem] shrink-0 grid-cols-2 gap-1.5 min-[520px]:w-auto min-[520px]:grid-flow-col min-[520px]:grid-cols-none">
        {isCorrect && (
          <motion.span
            key={winKey}
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="hidden min-h-11 items-center justify-center rounded-full bg-forest-accent/10 px-3 text-[11px] font-medium text-forest-accent min-[520px]:inline-flex"
          >
            答对了
          </motion.span>
        )}
        <button
          type="button"
          aria-label="下一题"
          onClick={drawQuestion}
          className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-forest-accent/90 px-2.5 text-[11px] font-medium text-white transition-all hover:bg-forest-accent active:scale-[0.98]"
        >
          <RefreshCw size={13} />
          下一题
        </button>
        {questionCard && (
          <button
            type="button"
            aria-label="我记住了"
            onClick={handleRemembered}
            className="flex min-h-11 items-center justify-center gap-1 rounded-full border border-forest-accent/8 bg-white/34 px-2 text-[11px] font-medium text-forest-accent transition-all hover:bg-white/62 active:scale-[0.98]"
          >
            <Sparkles size={13} />
            记住
          </button>
        )}
        {canRevealQuestionCard && (
          <button
            type="button"
            aria-label="给这张牌补关键词"
            onClick={() => setShowKeywordForm(value => !value)}
            className="flex min-h-11 items-center justify-center gap-1 rounded-full border border-forest-accent/8 bg-white/34 px-2 text-[11px] font-medium text-forest-accent transition-all hover:bg-white/62 active:scale-[0.98]"
          >
            <Edit3 size={13} />
            {showKeywordForm ? '收起' : '补词'}
          </button>
        )}
        {canRevealQuestionCard && onOpenCardLibrary && (
          <button
            type="button"
            aria-label="去牌义注疏"
            onClick={() => onOpenCardLibrary(questionCard.id)}
            className="flex min-h-11 items-center justify-center gap-1 rounded-full border border-forest-accent/8 bg-white/34 px-2 text-[11px] font-medium text-forest-muted transition-all hover:bg-white/62 hover:text-forest-accent active:scale-[0.98]"
          >
            <Library size={13} />
            注疏
          </button>
        )}
      </div>
    );
  };

  return (
    <section
      data-testid="card-quiz-card"
      className="relative flex flex-col overflow-hidden rounded-[1.45rem] border border-forest-accent/8 bg-[#FFFCF7]/80 p-2 shadow-[0_12px_38px_-34px_rgba(62,58,54,0.34)] backdrop-blur-sm sm:p-3"
    >
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-forest-accent/16 to-transparent" />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-forest-accent/9 bg-white/34 text-forest-accent sm:h-8 sm:w-8 sm:rounded-2xl">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-forest-accent sm:text-[10px]">牌义小考</p>
            <h3 className="font-serif text-[0.95rem] font-bold leading-tight text-forest-ink sm:text-[1.05rem]">
              {quizMode === 'meaning-card' ? '读含义，找牌面' : '看牌面，记对应'}
            </h3>
            <p className="sr-only">
              {quizMode === 'meaning-card'
                ? '读一句含义，再选最接近的牌面。'
                : '看牌面，选它的元素、行星、星座或宫位。'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            trackEvent('quiz_archive_opened', {
              repeated_count: repeatedCount,
              practice_count: totalPracticeCount,
              active_filter_count: activeFilterLabels.length,
            });
            setShowArchive(true);
          }}
          aria-haspopup="dialog"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-forest-accent/9 bg-white/32 px-2.5 text-xs font-medium text-forest-accent transition-all hover:border-forest-accent/22 hover:bg-white/58 active:scale-[0.97]"
        >
          <Archive size={14} />
          档案
        </button>
      </div>

      <div className="relative mt-1.5 flex items-center gap-2">
          <div
            role="group"
            aria-label="小考题型"
            className="inline-flex h-11 w-fit max-w-full shrink-0 rounded-full border border-forest-accent/8 bg-white/34 p-0.5"
          >
            {QUIZ_MODE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateQuizMode(option.value)}
                aria-pressed={quizMode === option.value}
                className={`flex h-full min-w-[4.8rem] items-center justify-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-all active:scale-[0.98] ${
                  quizMode === option.value
                    ? 'bg-forest-accent/90 text-white shadow-sm'
                    : 'text-forest-muted hover:bg-white/58 hover:text-forest-accent'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="hidden min-w-0 truncate text-[10px] text-forest-muted min-[430px]:block">
            {hasActiveFilters ? activeFilterLabels.join(' · ') : '默认全牌库'}
          </p>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence initial={false}>
        {showArchive && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-archive-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowArchive(false)}
            className="fixed inset-0 z-[80] bg-forest-bg/88 px-3 py-3 backdrop-blur-sm sm:px-6 sm:py-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={event => event.stopPropagation()}
              className="mx-auto flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.55rem] border border-forest-accent/10 bg-[#FFFCF7]/95 shadow-[0_24px_70px_-42px_rgba(62,58,54,0.52)]"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-forest-accent/8 px-4 py-3">
                <div className="min-w-0">
                  <p id="quiz-archive-title" className="font-serif text-base font-bold leading-tight text-forest-ink">
                    小考档案
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-forest-muted">记录作答、待温习和专项设置。</p>
                </div>
                <button
                  type="button"
                  aria-label="关闭小考档案"
                  onClick={() => setShowArchive(false)}
                  className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-full border border-forest-accent/8 bg-white/42 text-xl leading-none text-forest-muted transition-all hover:bg-white/70 hover:text-forest-ink active:scale-[0.97]"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">

            <div className="rounded-2xl border border-forest-accent/7 bg-white/30 px-2 py-1.5">
              <div className="grid grid-cols-4 divide-x divide-forest-accent/8 text-center">
                <div>
                  <p className="font-serif text-sm font-semibold leading-tight text-forest-ink">{todayQuizCount}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-forest-muted">今日</p>
                </div>
                <div>
                  <p className="font-serif text-sm font-semibold leading-tight text-forest-ink">{totalPracticeCount}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-forest-muted">累计</p>
                </div>
                <div>
                  <p className="font-serif text-sm font-semibold leading-tight text-forest-ink">
                    {accuracyRate === null ? '—' : `${accuracyRate}%`}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-forest-muted">正确率</p>
                </div>
                <div>
                  <p className="font-serif text-sm font-semibold leading-tight text-forest-ink">{repeatedCount}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-forest-muted">待温习</p>
                </div>
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-forest-accent/7 bg-white/24 px-2 py-1.5">
              <div className="flex min-h-11 items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium text-forest-accent">待温习</p>
                  <p className="truncate text-[10px] text-forest-muted">
                    {repeatedRows.length > 0
                      ? repeatedRows.map(entry => entry.cardName).join('、')
                      : weakCards[0]?.name ? `最近不熟：${weakCards[0].name}` : '错题会自动收在这里'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateFilters(current => ({ ...current, repeatOnly: true, groups: [] }));
                    setShowArchive(false);
                  }}
                  className="min-h-11 shrink-0 rounded-full border border-forest-accent/8 bg-white/35 px-3 text-xs font-medium text-forest-accent transition-all hover:bg-white/60 active:scale-[0.97]"
                >
                  去温习
                </button>
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-2xl border border-forest-accent/7 bg-white/26">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <p className="text-[10px] font-medium text-forest-accent">
                  {recentQuizAttempts.length > 0 ? '本次作答' : '作答履历'}
                </p>
                <p className="text-[10px] text-forest-muted">错题会进入待温习</p>
              </div>
              <div className="divide-y divide-forest-accent/6">
                {archiveAttemptRows.length > 0 ? (
                  archiveAttemptRows.slice(0, 4).map(attempt => (
                    <button
                      key={attempt.id}
                      type="button"
                      onClick={() => onOpenCardLibrary?.(attempt.cardId)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/35 active:bg-white/45"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-forest-ink">{attempt.cardName}</span>
                        <span className="block truncate text-[10px] text-forest-muted">
                          {attempt.modeLabel} · {formatQuizTime(attempt.createdAt)}
                        </span>
                        <span className="block truncate text-[10px] text-forest-muted/90">
                          选了 {attempt.selectedLabel} · 答案 {attempt.answerLabel}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                        attempt.correct
                          ? 'bg-forest-accent/10 text-forest-accent'
                          : 'bg-forest-pink/12 text-forest-pink'
                      }`}
                      >
                        {attempt.correct ? '正确' : `答案 ${attempt.answerLabel}`}
                      </span>
                    </button>
                  ))
                ) : recentMemoryRows.length > 0 ? (
                  recentMemoryRows.slice(0, 3).map(entry => (
                    <button
                      key={entry.cardId}
                      type="button"
                      onClick={() => onOpenCardLibrary?.(entry.cardId)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/35 active:bg-white/45"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-forest-ink">{entry.cardName}</span>
                        <span className="block truncate text-[10px] text-forest-muted">
                          练 {entry.practiceCount || 0} 次 · 错 {entry.wrongCount || 0} 次
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/45 px-2 py-1 text-[10px] font-medium text-forest-muted">
                        {entry.repeated ? '待温习' : formatQuizTime(getMemoryTime(entry))}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-[11px] leading-relaxed text-forest-muted">
                    答完题后，这里会留下最近练过的牌。
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-2xl border border-forest-accent/7 bg-white/22">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <p className="text-[10px] font-medium text-forest-accent">薄弱牌</p>
                <p className="text-[10px] text-forest-muted">按错题和待温习排序</p>
              </div>
              <div className="divide-y divide-forest-accent/6">
                {weakMemoryRows.length > 0 ? (
                  weakMemoryRows.map(entry => {
                    const accuracy = getQuizAccuracy(entry);
                    return (
                      <button
                        key={entry.cardId}
                        type="button"
                        onClick={() => onOpenCardLibrary?.(entry.cardId)}
                        className="flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/35 active:bg-white/45"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-forest-ink">{entry.cardName}</span>
                          <span className="block truncate text-[10px] text-forest-muted">
                            练 {entry.practiceCount || 0} 次 · 错 {getQuizMistakeCount(entry)} 次
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white/45 px-2 py-1 text-[10px] font-medium text-forest-muted">
                          {entry.repeated ? '待温习' : accuracy === null ? '未统计' : `${accuracy}%`}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-[11px] leading-relaxed text-forest-muted">
                    目前没有薄弱牌。答错或标记不熟后，会自动沉淀到这里。
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-2xl border border-forest-accent/7 bg-white/22">
              <button
                type="button"
                onClick={() => setShowArchiveSettings(value => !value)}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/35 active:bg-white/45"
              >
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium text-forest-accent">专项设置</p>
                  <p className="truncate text-[10px] text-forest-muted">
                    {quizModeLabel} · {hasActiveFilters ? activeFilterLabels.join(' · ') : '默认全牌库'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/42 px-2.5 py-1 text-[10px] font-medium text-forest-accent">
                  {showArchiveSettings ? '收起' : '设置'}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {showArchiveSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border-t border-forest-accent/6"
                  >
                    <div className="grid gap-1.5 p-2">
                      {hasActiveFilters && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => updateFilters(() => createDefaultFilters())}
                            className="min-h-11 rounded-xl px-2.5 text-xs font-medium text-forest-muted transition-colors hover:bg-white/45 hover:text-forest-accent"
                          >
                            清除专项
                          </button>
                        </div>
                      )}

                      <label className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2">
                        <span className="text-[10px] font-medium text-forest-muted">范围</span>
                        <select
                          value={selectedDeckPreset}
                          onChange={event => updateDeckPreset(event.target.value as QuizCardGroup | 'all' | 'repeat')}
                          className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white/38 px-2.5 text-xs font-medium text-forest-ink outline-none transition-colors focus:border-forest-accent"
                        >
                          {DECK_PRESET_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <label className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2">
                          <span className="text-[10px] font-medium text-forest-muted">牌组</span>
                          <select
                            value={getSelectValue(filters.suits)}
                            onChange={event => updateSuitPreset(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white/38 px-2.5 text-xs font-medium text-forest-ink outline-none transition-colors focus:border-forest-accent"
                          >
                            {SUIT_PRESET_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2">
                          <span className="text-[10px] font-medium text-forest-muted">元素</span>
                          <select
                            value={getSelectValue(filters.elements)}
                            onChange={event => updateElementPreset(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white/38 px-2.5 text-xs font-medium text-forest-ink outline-none transition-colors focus:border-forest-accent"
                          >
                            {ELEMENT_PRESET_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-1.5 sm:grid-cols-3">
                        <label className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[2.25rem_minmax(0,1fr)]">
                          <span className="text-[10px] font-medium text-forest-muted">行星</span>
                          <select
                            value={getSelectValue(filters.planets)}
                            onChange={event => updatePlanetPreset(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white/38 px-2.5 text-xs font-medium text-forest-ink outline-none transition-colors focus:border-forest-accent"
                          >
                            <option value="">不限行星</option>
                            {planetOptions.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[2.25rem_minmax(0,1fr)]">
                          <span className="text-[10px] font-medium text-forest-muted">星座</span>
                          <select
                            value={getSelectValue(filters.zodiacs)}
                            onChange={event => updateZodiacPreset(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white/38 px-2.5 text-xs font-medium text-forest-ink outline-none transition-colors focus:border-forest-accent"
                          >
                            <option value="">不限星座</option>
                            {zodiacOptions.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[2.25rem_minmax(0,1fr)]">
                          <span className="text-[10px] font-medium text-forest-muted">宫位</span>
                          <select
                            value={getSelectValue(filters.houses)}
                            onChange={event => updateHousePreset(event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white/38 px-2.5 text-xs font-medium text-forest-ink outline-none transition-colors focus:border-forest-accent"
                          >
                            <option value="">不限宫位</option>
                            {houseOptions.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}

      <div className="relative mt-2 rounded-[1.35rem] border border-forest-accent/8 bg-white/20 p-1.5 sm:p-2.5">
        {activeDeck.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-forest-accent/20 bg-white/35 p-4 text-center">
            <p className="font-serif text-base font-bold text-forest-ink">这个专项暂时没有牌</p>
            <button
              type="button"
              onClick={() => updateFilters(() => createDefaultFilters())}
              className="mt-3 min-h-11 rounded-full bg-forest-accent px-5 text-sm font-bold text-white transition-all active:scale-[0.98]"
            >
              回到全牌库
            </button>
          </div>
        ) : question ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] sm:items-stretch">
              {questionCard && question.kind !== 'meaning-card' && (
                <div className="flex items-center gap-2 rounded-[1.05rem] border border-forest-accent/7 bg-white/24 p-1.5 sm:min-h-full">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-forest-border/70 bg-white/70 shadow-[0_10px_24px_-20px_rgba(62,58,54,0.35)]">
                    <TarotCardImage
                      src={getCardImageUrl(questionCard.id)}
                      alt={questionCard.name}
                      name={questionCard.name}
                      loading="eager"
                      fetchPriority="high"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-forest-accent">
                      <Target size={13} />
                      <p className="text-[10px] font-bold">{getQuestionLabel(question)}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-forest-muted">
                      {questionCard.name} · {questionCard.english}
                    </p>
                    <h4 className="mt-0.5 font-serif text-[0.95rem] font-bold leading-snug text-forest-ink">
                      {question.prompt}
                    </h4>
                  </div>
                  {renderQuizHeaderActions()}
                </div>
              )}

              {question.kind === 'meaning-card' && (
                <div className="rounded-[1.05rem] border border-forest-accent/7 bg-white/22 px-2.5 py-2 sm:min-h-full">
                  <div className="flex min-h-11 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-forest-accent">
                        <Target size={13} />
                        <p className="truncate text-[10px] font-bold">{getQuestionLabel(question)}</p>
                      </div>
                      <h4 className="mt-0.5 truncate font-serif text-[0.98rem] font-bold leading-snug text-forest-ink">
                        {question.prompt}
                      </h4>
                      {question.promptHint && (
                        <p className="mt-0.5 truncate text-[11px] leading-snug text-forest-muted">{question.promptHint}</p>
                      )}
                    </div>
                    {renderQuizHeaderActions()}
                  </div>
                </div>
              )}

              <div className={`grid grid-cols-2 ${question.kind === 'meaning-card' ? 'gap-1 items-stretch' : 'gap-1.5'}`}>
              {question.options.map(option => {
                const isSelected = selectedOptionId === option.id;
                const isOptionCorrect = question.correctOptionId === option.id;
                const optionCard = option.cardId ? cardsById.get(option.cardId) : null;
                const resultClass = isAnswered && isOptionCorrect
                  ? 'border-forest-accent/50 bg-forest-accent/10 text-forest-accent'
                  : isAnswered && isSelected
                    ? 'border-forest-pink/50 bg-forest-pink/10 text-forest-pink'
                    : 'border-forest-accent/8 bg-white/34 text-forest-ink hover:border-forest-accent/22 hover:bg-white/58';

                if (question.kind === 'meaning-card' && optionCard) {
                  return (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={`quiz-option-${option.id}`}
                      onClick={() => handleOptionSelect(option)}
                      className={`relative flex min-h-16 items-center justify-start gap-2.5 rounded-[0.95rem] border px-2.5 py-2 text-left text-xs font-medium shadow-none transition-all active:scale-[0.98] sm:min-h-[4.5rem] ${resultClass}`}
                    >
                      <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md border border-forest-border/70 bg-white/70 sm:h-14 sm:w-9">
                        <TarotCardImage
                          src={getCardImageUrl(optionCard.id)}
                          alt={optionCard.name}
                          name={optionCard.name}
                          loading="eager"
                          fetchPriority="high"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="min-w-0 flex-1 truncate leading-tight">{optionCard.name}</span>
                      {isAnswered && isOptionCorrect && (
                        <span className="absolute right-2 top-2 rounded-full bg-forest-accent p-1 text-white">
                          <CheckCircle2 size={13} />
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`quiz-option-${option.id}`}
                    onClick={() => handleOptionSelect(option)}
                    className={`relative flex min-h-11 items-center justify-center rounded-[1.05rem] border px-3 py-2 text-center text-sm font-medium shadow-none transition-all active:scale-[0.98] ${resultClass}`}
                  >
                    <span className="min-w-0 leading-snug">{option.label}</span>
                    {isAnswered && isOptionCorrect && <CheckCircle2 size={15} className="absolute right-2.5 top-1/2 shrink-0 -translate-y-1/2" />}
                  </button>
                );
              })}
              </div>
            </div>

            <AnimatePresence>
              {isAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-[1.15rem] border border-forest-accent/8 bg-white/24 px-2.5 py-2"
                >
                  <p className={`text-sm font-bold ${isCorrect ? 'text-forest-accent' : 'text-forest-ink'}`}>
                    {isCorrect ? `答案：${question.answerLabel}` : `答案：${question.answerLabel} · 已放入待温习`}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-forest-muted">
                    {question.explanation}
                  </p>
                  {systemTags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {systemTags.map(item => (
                        <span
                          key={`${item.label}-${item.value}`}
                          className="rounded-full border border-forest-accent/8 bg-white/42 px-2.5 py-1 text-[10px] font-medium text-forest-muted"
                        >
                          <span className="text-forest-accent">{item.label}</span>
                          <span className="mx-1 text-forest-muted/50">·</span>
                          {item.value}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {canRevealQuestionCard && questionCard && (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {showKeywordForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={keywordInput}
                          onChange={event => {
                            setKeywordInput(event.target.value);
                            setKeywordStatus(null);
                          }}
                          placeholder="例：自由、起点、信任"
                          className="min-h-11 rounded-2xl border border-forest-accent/10 bg-white/60 px-3 text-sm text-forest-ink outline-none transition-colors placeholder:text-forest-muted/60 focus:border-forest-accent"
                        />
                        <button
                          type="button"
                          onClick={handleSaveKeywords}
                          disabled={!keywordInput.trim()}
                          className="min-h-11 rounded-full bg-forest-accent/90 px-5 text-sm font-medium text-white transition-all hover:bg-forest-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          保存
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {keywordStatus && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-forest-accent">
                    <BookOpen size={13} />
                    {keywordStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-forest-accent/20 bg-white/35 p-4 text-center">
            <p className="font-serif text-base font-bold text-forest-ink">准备抽题中</p>
            <button
              type="button"
              onClick={drawQuestion}
              className="mt-3 min-h-11 rounded-full bg-forest-accent/90 px-5 text-sm font-bold text-white transition-all hover:bg-forest-accent active:scale-[0.98]"
            >
              抽一题
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
