import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Eye,
  PenLine,
  RefreshCw,
  Save,
  Shuffle,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { DailyFortune } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { CardPicker } from './CardPicker';
import { DailyFortuneArchiveModal } from './DailyFortuneArchiveModal';
import { TarotCardImage } from './TarotCardImage';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface FortuneChoice {
  cardNumber: number;
  cardIndex: number;
  isRevealed: boolean;
}

interface DailyFortuneCardProps {
  fortune: DailyFortune | null;
  fortunes: DailyFortune[];
  onGenerateWithNumber: (cardNumber: number, cardIndex?: number, replaceExisting?: boolean) => DailyFortune | null | void;
  onCreateFromCard: (
    cardId: string,
    isReversed: boolean,
    source: NonNullable<DailyFortune['source']>
  ) => DailyFortune | null | void;
  onArchive: (id: string, reflection?: string) => void;
  onUpdateReflection: (id: string, reflection: string) => void;
}

const FortuneCardBack = ({
  className = '',
  label = '未揭晓的日运塔罗牌'
}: {
  className?: string;
  label?: string;
}) => (
  <div
    data-testid="daily-fortune-card-back"
    role="img"
    aria-label={label}
    className={`relative aspect-[2/3] rounded-[1.1rem] border border-forest-accent/25 bg-gradient-to-br from-white via-forest-bg/90 to-forest-pink/20 shadow-xl shadow-forest-accent/10 ${className}`}
  >
    <div className="absolute -inset-2 rounded-[1.4rem] bg-gradient-to-br from-forest-accent/18 via-white/0 to-amber-200/25 blur-md" />
    <div className="absolute inset-0 rounded-[1.1rem] border border-white/85" />
    <div className="absolute inset-1.5 rounded-[0.85rem] border border-forest-accent/20" />
    <div className="absolute inset-3 rounded-[0.55rem] border border-dashed border-forest-accent/18" />

    <div className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
    <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
    <div className="absolute bottom-3 left-3 h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
    <div className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-forest-accent/40" />

    <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-forest-accent/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
      <span className="h-2.5 w-2.5 rounded-full border border-forest-accent/45 bg-white/60" />
      <span className="h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
      <span className="h-1 w-1 rounded-full bg-forest-accent/25" />
    </div>

    <svg
      className="absolute inset-x-0 top-1/2 mx-auto h-16 w-16 -translate-y-1/2 text-forest-accent/55"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <path d="M20 48c-4.5-6.5-4.5-18 0-24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 48c4.5-6.5 4.5-18 0-24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 14l3 8.5 8.5 3-8.5 3L32 37l-3-8.5-8.5-3 8.5-3L32 14z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M41 13a8.5 8.5 0 1 1-7.6 12.3 9.6 9.6 0 0 0 11.2-11.2A8.3 8.3 0 0 1 41 13z" fill="currentColor" opacity="0.18" />
      <path d="M17 43c4.7-3.8 9.4-5.6 15-5.6S42.3 39.2 47 43" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.55" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="48" cy="45" r="1.5" fill="currentColor" opacity="0.45" />
    </svg>

    <div className="absolute bottom-5 left-1/2 h-px w-12 -translate-x-1/2 bg-gradient-to-r from-transparent via-forest-accent/35 to-transparent" />
  </div>
);

const getCardData = (cardName: string) => TAROT_CARDS.find(card => card.name === cardName);

const getSourceLabel = (source?: DailyFortune['source']) => (
  source === 'physical-draw' ? '现实抽牌' : '系统抽牌'
);

export const DailyFortuneCard: React.FC<DailyFortuneCardProps> = ({
  fortune,
  fortunes,
  onGenerateWithNumber,
  onCreateFromCard,
  onArchive,
  onUpdateReflection,
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [showNumberInput, setShowNumberInput] = useState(false);
  const [shufflePhase, setShufflePhase] = useState<'idle' | 'shuffling' | 'selected' | 'revealed'>('idle');
  const [shuffleCount, setShuffleCount] = useState(0);
  const [fortuneChoice, setFortuneChoice] = useState<FortuneChoice | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showArchiveZone, setShowArchiveZone] = useState(false);
  const [archiveText, setArchiveText] = useState('');
  const [editingFortuneId, setEditingFortuneId] = useState<string | null>(null);
  const [isRedrawing, setIsRedrawing] = useState(false);
  const shuffleIntervalRef = useRef<number | null>(null);
  const shuffleEndTimerRef = useRef<number | null>(null);

  useBodyScrollLock(showArchiveDialog);

  const archivedFortunes = useMemo(
    () => fortunes
      .filter(item => Boolean(item.archivedAt))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [fortunes]
  );
  const reviewedFortuneCount = useMemo(
    () => archivedFortunes.filter(item => item.reflection?.trim()).length,
    [archivedFortunes]
  );
  const cardData = fortune ? getCardData(fortune.cardName) : null;
  const editingFortune = (
    editingFortuneId
      ? [fortune, ...archivedFortunes].filter(Boolean).find(item => item?.id === editingFortuneId)
      : fortune
  ) || null;

  const clearShuffleTimers = () => {
    if (shuffleIntervalRef.current !== null) {
      window.clearInterval(shuffleIntervalRef.current);
      shuffleIntervalRef.current = null;
    }
    if (shuffleEndTimerRef.current !== null) {
      window.clearTimeout(shuffleEndTimerRef.current);
      shuffleEndTimerRef.current = null;
    }
  };

  useEffect(() => clearShuffleTimers, []);

  const getShuffledCardIndex = (cardNumber: number) => {
    const deck = [...Array(TAROT_CARDS.length).keys()];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck[cardNumber - 1];
  };

  const selectFortuneCard = (cardNumber: number) => {
    setFortuneChoice({
      cardNumber,
      cardIndex: getShuffledCardIndex(cardNumber),
      isRevealed: false
    });
  };

  const handleShuffle = async () => {
    clearShuffleTimers();
    setShufflePhase('shuffling');
    setShuffleCount(0);
    setFortuneChoice(null);
    setShowNumberInput(false);

    shuffleIntervalRef.current = window.setInterval(() => {
      setShuffleCount(prev => {
        if (prev >= 15) {
          clearShuffleTimers();
          shuffleEndTimerRef.current = window.setTimeout(() => {
            setShufflePhase('selected');
            setShowNumberInput(true);
          }, 300);
          return prev;
        }
        return prev + 1;
      });
    }, 80);
  };

  const handleNumberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(cardNumber);
    if (num >= 1 && num <= 78) {
      selectFortuneCard(num);
      setShowNumberInput(false);
      setCardNumber('');
    }
  };

  const handleReveal = () => {
    if (fortuneChoice) {
      setFortuneChoice({ ...fortuneChoice, isRevealed: true });
      setShufflePhase('revealed');
      onGenerateWithNumber(fortuneChoice.cardNumber, fortuneChoice.cardIndex, isRedrawing);
      setIsRedrawing(false);
    }
  };

  const handleRandomDraw = () => {
    clearShuffleTimers();
    const randomNum = Math.floor(Math.random() * 78) + 1;
    selectFortuneCard(randomNum);
    setShufflePhase('selected');
    setShowNumberInput(false);
  };

  const handleStartRedraw = () => {
    clearShuffleTimers();
    setIsRedrawing(true);
    setFortuneChoice(null);
    setCardNumber('');
    setShufflePhase('idle');
    setShowNumberInput(false);
  };

  const handlePhysicalCardSelect = (card: typeof TAROT_CARDS[0], isReversed: boolean) => {
    clearShuffleTimers();
    setIsRedrawing(false);
    onCreateFromCard(card.id, isReversed, 'physical-draw');
    setShowCardPicker(false);
    setShufflePhase('revealed');
    setFortuneChoice(null);
  };

  const openArchiveDialog = (target: DailyFortune) => {
    setEditingFortuneId(target.id);
    setArchiveText(target.reflection || '');
    setShowArchiveDialog(true);
  };

  const closeArchiveDialog = () => {
    setShowArchiveDialog(false);
    setEditingFortuneId(null);
    setArchiveText('');
  };

  const handleSaveArchive = () => {
    if (!editingFortune) return;

    if (editingFortune.archivedAt) {
      onUpdateReflection(editingFortune.id, archiveText.trim());
    } else {
      onArchive(editingFortune.id, archiveText.trim());
    }

    closeArchiveDialog();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full overflow-hidden rounded-[1.25rem] border border-forest-accent/15 bg-gradient-to-br from-white via-forest-bg/75 to-forest-accent/10 shadow-sm shadow-forest-accent/5"
      >
        {fortune && !isRedrawing ? (
          <div className="p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sun className="text-forest-accent" size={16} />
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-forest-accent">日运抽牌</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveZone(true)}
                  className="flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-forest-accent/10 bg-white/70 px-3 text-[10px] font-bold text-forest-accent hover:border-forest-accent/30 hover:bg-white"
                  aria-label="打开日运复盘"
                >
                  <BookOpen size={13} />
                  日运复盘
                </button>
                <span className="hidden text-[10px] text-forest-muted sm:inline">{fortune.date}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <motion.div
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.8, type: 'spring' }}
                className={`relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-forest-accent/20 shadow-md sm:h-28 sm:w-[4.7rem] ${fortune.isReversed ? 'rotate-180' : ''}`}
              >
                <TarotCardImage
                  src={getCardImageUrl(cardData?.id || 'ar00')}
                  alt={fortune.cardName}
                  name={fortune.cardName}
                  className="h-full w-full bg-forest-bg object-contain"
                />
                <div className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[7px] font-bold ${
                  fortune.isReversed ? 'bg-red-500/80 text-white' : 'bg-green-500/80 text-white'
                }`}>
                  {fortune.isReversed ? '逆位' : '正位'}
                </div>
              </motion.div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-lg font-bold text-forest-ink">{fortune.cardName}</h3>
                  <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-bold text-forest-accent">
                    {getSourceLabel(fortune.source)}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-forest-text/80 sm:text-sm">{fortune.interpretation}</p>
                <div className="flex flex-wrap gap-1.5">
                  {fortune.keywords.map((kw, idx) => (
                    <span key={idx} className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-medium text-forest-accent">
                      {kw}
                    </span>
                  ))}
                </div>
                <p className="line-clamp-1 text-[10px] leading-relaxed text-forest-muted sm:text-[11px]">
                  今日记忆：先记关键词，晚上再和真实发生的事对应。
                </p>
              </div>
            </div>

            <div className="mt-2.5 rounded-2xl border border-forest-accent/10 bg-white/65 p-2.5 sm:mt-3 sm:p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent">
                  {fortune.archivedAt ? <CheckCircle2 size={16} /> : <PenLine size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-base font-bold text-forest-ink">这张牌和今天的什么事对应？</p>
                    {fortune.archivedAt && (
                      <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-bold text-forest-accent">
                        已归档
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-forest-muted">
                    刚抽完可以写第一直觉，晚上回来可以写今天真实发生的事。
                  </p>
                  {fortune.reflection && (
                    <p className="mt-2 rounded-2xl bg-forest-bg/70 p-2.5 text-sm leading-relaxed text-forest-ink">
                      {fortune.reflection}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => openArchiveDialog(fortune)}
                  className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-bold transition-all ${
                    fortune.archivedAt
                      ? 'bg-forest-accent/10 text-forest-accent hover:bg-forest-accent/15'
                      : 'bg-forest-accent text-white shadow-lg shadow-forest-accent/15 hover:bg-forest-accent/90'
                  }`}
                >
                  {fortune.archivedAt ? <PenLine size={16} /> : <Archive size={16} />}
                  {fortune.archivedAt ? '补写今日对应' : '写下今天并归档'}
                </button>
              </div>
            </div>

            {!fortune.archivedAt && (
              <button
                onClick={handleStartRedraw}
                  className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/50 px-3 text-xs text-forest-ink transition-all hover:bg-white"
              >
                <RefreshCw size={14} />
                <span>重新洗牌抽日运</span>
              </button>
            )}
          </div>
        ) : fortuneChoice && shufflePhase === 'selected' && !fortuneChoice.isRevealed ? (
          <div className="p-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <FortuneCardBack
                className="mx-auto w-28"
                label={`第 ${fortuneChoice.cardNumber} 张未揭晓的日运塔罗牌`}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-forest-ink">你抽到了今天的第 {fortuneChoice.cardNumber} 张牌</p>
                <p className="text-xs text-forest-muted">先记住心里的问题，再翻开看今天的提醒。</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleReveal}
                  className="w-full rounded-full bg-forest-accent px-6 py-4 text-sm font-bold text-white shadow-xl shadow-forest-accent/20 transition-all hover:scale-[1.02] hover:bg-forest-accent/90 active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Eye size={18} />
                    揭晓答案
                  </span>
                </button>

                <button
                  onClick={() => {
                    if (isRedrawing) {
                      setShufflePhase('selected');
                      setShowNumberInput(true);
                      setFortuneChoice(null);
                    } else {
                      setShufflePhase('idle');
                      setFortuneChoice(null);
                    }
                  }}
                  className="min-h-12 w-full rounded-xl bg-white/50 px-6 text-sm text-forest-ink transition-all hover:bg-white"
                >
                  重新选择
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="p-2.5 text-center sm:p-3">
            <AnimatePresence mode="wait">
              {shufflePhase === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.72fr)] items-stretch gap-2.5 text-left"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="min-w-0 space-y-1">
                      <div className="inline-flex items-center gap-1 rounded-full bg-forest-accent/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-forest-accent">
                        <Sparkles size={10} />
                        日运抽牌
                      </div>
                      <h3 className="font-serif text-[15px] font-bold text-forest-ink sm:text-base">今日单牌练习</h3>
                      <p className="line-clamp-3 text-[10px] leading-relaxed text-forest-muted sm:text-xs">
                        洗牌抽一张，或录入现实牌；晚上再回看它和今天的对应。
                      </p>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5" aria-label="日运操作">
                      <button
                        data-tour="daily-draw"
                        onClick={handleShuffle}
                        aria-label={isRedrawing ? '重新洗牌' : '洗牌'}
                        className="min-h-10 min-w-0 flex-1 rounded-xl bg-forest-accent px-2 text-[11px] font-bold text-white shadow-sm shadow-forest-accent/15 transition-all hover:scale-[1.02] hover:bg-forest-accent/90 active:scale-[0.98] sm:min-h-9 sm:flex-none sm:w-24 sm:px-3 sm:text-xs"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <Shuffle size={14} />
                          {isRedrawing ? '重新洗牌' : '洗牌'}
                        </span>
                      </button>
                      <button
                        onClick={() => setShowCardPicker(true)}
                        className="min-h-10 min-w-0 flex-1 rounded-xl border border-forest-accent/10 bg-white/70 px-2 text-[11px] font-bold text-forest-ink transition-all hover:bg-white sm:min-h-9 sm:flex-none sm:w-28 sm:px-3 sm:text-xs"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <PenLine size={14} />
                          <span className="hidden sm:inline" aria-hidden="true">录入现实牌</span>
                          <span className="sm:hidden" aria-hidden="true">现实牌</span>
                          <span className="sr-only">录入现实牌</span>
                        </span>
                      </button>
                    </div>

                    <p className="rounded-xl bg-white/50 px-2 py-1.5 text-[9px] leading-relaxed text-forest-muted sm:text-[10px]">
                      洗牌后可输入数字或随机一张，也能用来抽查牌义。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowArchiveZone(true)}
                    className="group flex min-h-full flex-col justify-between rounded-2xl border border-forest-accent/10 bg-white/70 p-2.5 text-left shadow-sm transition-colors hover:border-forest-accent/30 hover:bg-white/85 sm:p-3"
                    aria-label="打开日运复盘"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent">
                        <BookOpen size={13} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-forest-ink sm:text-sm">日运复盘</span>
                        <span className="mt-0.5 block text-[9px] leading-relaxed text-forest-muted">
                          已归档 {archivedFortunes.length} 天 · 已复盘 {reviewedFortuneCount} 条
                        </span>
                      </span>
                    </span>
                    <span
                      data-tour="daily-review"
                      className="mt-2 inline-flex min-h-7 w-fit items-center justify-center rounded-full bg-forest-accent/10 px-2 text-[9px] font-bold text-forest-accent transition-colors group-hover:bg-forest-accent group-hover:text-white"
                    >
                      查看
                    </span>
                  </button>
                </motion.div>
              )}

              {shufflePhase === 'shuffling' && (
                <motion.div
                  key="shuffling"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <motion.div
                    className="mx-auto w-28"
                    animate={{ rotate: [-4, 4, -4], y: [0, -4, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <FortuneCardBack label="正在洗牌的日运塔罗牌" />
                  </motion.div>

                  <motion.p
                    className="font-serif text-lg font-bold text-forest-ink"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    日运洗牌中 {shuffleCount}/15
                  </motion.p>

                  <div className="mx-auto w-full max-w-xs">
                    <div className="h-2 overflow-hidden rounded-full bg-forest-accent/10">
                      <motion.div
                        className="h-full rounded-full bg-forest-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${(shuffleCount / 15) * 100}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {shufflePhase === 'selected' && showNumberInput && (
                <motion.div
                  key="number-input"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <FortuneCardBack className="mx-auto w-24" label="等待选择的日运塔罗牌" />
                  <h3 className="font-serif text-xl font-bold text-forest-ink">
                    {isRedrawing ? '重新选择今日日运牌' : '选择今日日运牌'}
                  </h3>

                  <div className="space-y-4 rounded-2xl bg-forest-bg/50 p-4">
                    <div className="space-y-2">
                      <p className="text-xs leading-relaxed text-forest-muted">
                        洗牌完成。你可以默念一个数字（1-78），也可以让系统从洗好的牌组里随机选一张。
                      </p>
                      <div className="flex items-center justify-center gap-2 py-2">
                        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="h-2 w-2 rounded-full bg-forest-accent" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} className="h-2 w-2 rounded-full bg-forest-accent" />
                        <motion.div animate={{ opacity: [0.3, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }} className="h-2 w-2 rounded-full bg-forest-accent" />
                      </div>
                    </div>

                    <form onSubmit={handleNumberSubmit} className="space-y-3">
                      <input
                        type="number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="输入你心中的数字..."
                        min="1"
                        max="78"
                        className="w-full rounded-xl border-2 border-forest-accent/20 px-4 py-3 text-center text-lg transition-colors focus:border-forest-accent/50 focus:outline-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShufflePhase('idle');
                            setIsRedrawing(false);
                            setCardNumber('');
                          }}
                          className="min-h-11 flex-1 rounded-xl px-4 text-xs text-forest-muted transition-colors hover:text-forest-ink"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={!cardNumber || parseInt(cardNumber) < 1 || parseInt(cardNumber) > 78}
                          className="min-h-11 flex-1 rounded-xl bg-forest-accent px-4 text-xs font-bold text-white transition-all hover:bg-forest-accent/90 disabled:opacity-50"
                        >
                          确认选择
                        </button>
                      </div>
                    </form>
                    <button
                      type="button"
                      onClick={handleRandomDraw}
                      className="min-h-11 w-full rounded-xl border border-forest-accent/15 bg-white/80 px-4 text-xs font-bold text-forest-accent transition-all hover:bg-white"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles size={14} />
                        从洗好的牌组随机一张
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showCardPicker && (
          <CardPicker
            title="选择现实中抽到的牌"
            description="选中后会作为今日日运记录，也可以用来练习这张单牌的含义。"
            onSelect={handlePhysicalCardSelect}
            onClose={() => setShowCardPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showArchiveDialog && editingFortune && (
          <div className="fixed inset-0 z-[950] flex items-center justify-center bg-forest-ink/30 p-4 backdrop-blur-sm overscroll-contain">
            <motion.div
              role="dialog"
              aria-label="记录日运对应"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-md rounded-[2rem] border border-forest-accent/15 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-accent">
                    {editingFortune.archivedAt ? '补写日运' : '归档日运'}
                  </p>
                  <h3 className="mt-1 font-serif text-xl font-bold text-forest-ink">
                    {editingFortune.cardName} · {editingFortune.isReversed ? '逆位' : '正位'}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                    刚抽完可以写第一直觉；晚上回来，可以写今天发生了什么和这张牌哪里对应。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeArchiveDialog}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-muted hover:bg-forest-accent/10 hover:text-forest-accent"
                  aria-label="关闭记录日运对应"
                >
                  <X size={18} />
                </button>
              </div>

              <textarea
                value={archiveText}
                onChange={(event) => setArchiveText(event.target.value)}
                aria-label="日运记录内容"
                placeholder="可以写刚翻开时的第一直觉，也可以晚上回来写：今天发生了什么？它和这张牌的关键词、画面或正逆位有什么对应？"
                className="mt-4 min-h-32 w-full resize-none rounded-2xl border border-forest-accent/15 bg-forest-bg/60 p-4 text-sm leading-relaxed text-forest-ink outline-none transition-all placeholder:text-forest-muted/70 focus:border-forest-accent/40 focus:ring-2 focus:ring-forest-accent/15"
              />

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closeArchiveDialog}
                  className="min-h-11 flex-1 rounded-xl px-4 text-xs font-bold text-forest-muted hover:bg-forest-accent/5 hover:text-forest-ink"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveArchive}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-forest-accent px-4 text-xs font-bold text-white hover:bg-forest-accent/90"
                >
                  <Save size={14} />
                  {editingFortune.archivedAt ? '保存补写' : '保存到日运复盘'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DailyFortuneArchiveModal
        fortunes={archivedFortunes}
        isOpen={showArchiveZone}
        onClose={() => setShowArchiveZone(false)}
        onUpdateReflection={onUpdateReflection}
      />
    </>
  );
};
