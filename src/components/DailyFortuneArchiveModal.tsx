import { downloadBlobFile, downloadTextFile } from '../lib/downloadFile';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Library,
  PenLine,
  Save,
  Table2,
  Trash2,
  Search,
  ChevronRight,
  Ellipsis,
  X,
} from 'lucide-react';
import { DailyFortune, DailyFortuneReflectionParts, TarotReading } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { TarotCardImage } from './TarotCardImage';
import {
  appendNoObviousDailyMatch,
  getDailyReflectionParts,
  hasDailyReflectionContent,
  NO_OBVIOUS_DAILY_MATCH_TEXT,
  NO_OBVIOUS_PAST_DAILY_MATCH_TEXT,
} from '../lib/dailyFortuneReflection';
import {
  buildDailyFortunePdfLines,
  exportDailyFortunesToCsv,
  exportDailyFortunesToMarkdown,
  getCurrentMonthKey,
  getDailyFortuneMonthlyCardStats,
  getDailyFortunesByCard,
  getFortunesForMonth,
  dailyFortuneMatchesSearch,
} from '../lib/dailyFortuneReview';
import { createExportPdfBlobFromLines } from '../lib/pdfExport';
import { QuietEmptyState } from './ui/SoftUI';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { trackEvent } from '../lib/analytics';
import { ConfirmDialog } from './ConfirmDialog';
import { readLocalDraft, useLocalDraft } from '../hooks/useLocalDraft';
import { PageView } from './PageView';
import { Modal } from './Modal';
import { scrollFocusedFieldIntoView } from '../lib/mobileFocus';
import { DailyReflectionCard } from './DailyReflectionCard';
import { getRecordCalendarDate, isDailyReading, readingMatchesSearch } from '../lib/readingSearch';
import { ReadingDetailModal } from './ReadingDetailModal';
import { toLocalReadingDate } from '../lib/readingDate';

interface DailyFortuneArchiveModalProps {
  fortunes: DailyFortune[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateReflection: (id: string, reflection: string | DailyFortuneReflectionParts) => void;
  onSaveToCardAnnotation: (id: string, note?: string) => void;
  onDeleteFortunes: (ids: string[]) => void;
  ownerName?: string;
  ownerScope?: string;
  readings?: TarotReading[];
  onEditReading?: (reading: TarotReading) => void;
  onUpdateReadingFeedback?: (id: string, text: string) => boolean | Promise<boolean>;
}

type ReviewView = 'timeline' | 'cards' | 'month';
type ReviewFilter = 'all' | 'pending' | 'reviewed' | 'saved';

const viewOptions = [
  ['timeline', '时间线', Archive],
  ['cards', '按牌', Library],
  ['month', '按月', BarChart3],
] as const;

const readingFilterOptions = [
  ['all', '全部'], ['pending', '待复盘'], ['reviewed', '已复盘'],
] as const;

const filterButtonClass = (selected: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
  selected ? 'bg-forest-accent text-white' : 'bg-forest-accent/7 text-forest-accent hover:bg-forest-accent/12'
}`;
type SwipeDragState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  startOffset: number;
  isTracking: boolean;
  isDragging: boolean;
};

const SWIPE_ACTION_WIDTH = 84;
const SWIPE_MAX_OFFSET = 92;
const SWIPE_OPEN_THRESHOLD = 42;

const getCardData = (cardName: string) => TAROT_CARDS.find(card => card.name === cardName);

const getSourceLabel = (source?: DailyFortune['source']) => (
  source === 'physical-draw' ? '现实抽牌' : '系统抽牌'
);

const getDirectionLabel = (fortune: DailyFortune) => (fortune.isReversed ? '逆位' : '正位');

const hasDailyReview = (fortune: DailyFortune) => Boolean(getDailyReflectionParts(fortune).dailyReview.trim());

const isDailyReviewPending = (fortune: DailyFortune) => !hasDailyReview(fortune);

const matchesReviewFilter = (fortune: DailyFortune, filter: ReviewFilter) => {
  if (filter === 'pending') return isDailyReviewPending(fortune);
  if (filter === 'reviewed') return hasDailyReview(fortune);
  if (filter === 'saved') return Boolean(fortune.savedToCardAnnotationAt);
  return true;
};

function ArchiveSearchControls({ sourceLabel, query, date, month, onQueryChange, onDateChange, onMonthChange }: {
  sourceLabel: string; query: string; date: string; month: string;
  onQueryChange: (value: string) => void; onDateChange: (value: string) => void; onMonthChange: (value: string) => void;
}) {
  return <div className="space-y-3">
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-forest-accent" />
      <input aria-label={`搜索${sourceLabel}`} placeholder="搜索牌名、日期或记录内容" value={query} onChange={event => onQueryChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-forest-accent/15 bg-white/60 py-2 pl-10 pr-12 text-base text-forest-ink" />
      {query && <button type="button" aria-label={`清空${sourceLabel}搜索`} onClick={() => onQueryChange('')} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-forest-muted"><X size={17} /></button>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="min-w-0 text-xs text-forest-muted">日期<input type="date" aria-label={`${sourceLabel}日期`} value={date} onChange={event => onDateChange(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-forest-accent/15 bg-white/60 px-2 text-base text-forest-ink" /></label>
      <label className="min-w-0 text-xs text-forest-muted">月份<input type="month" aria-label={`${sourceLabel}月份`} value={month} onChange={event => onMonthChange(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-forest-accent/15 bg-white/60 px-2 text-base text-forest-ink" /></label>
    </div>
  </div>;
}

const getFortunePreviewText = (fortune: DailyFortune) => {
  const parts = getDailyReflectionParts(fortune);
  return parts.dailyReview || parts.initialImpression || fortune.reflection?.trim();
};

const clampSwipeOffset = (value: number) => Math.min(0, Math.max(-SWIPE_MAX_OFFSET, value));

const getSafeFileNamePart = (value: string) => (
  value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 24) || '见习阁主'
);

const getDailyReviewFileBaseName = (ownerName: string) => (
  `${getSafeFileNamePart(ownerName)}-日运复盘-${new Date().toISOString().split('T')[0]}`
);

const DailyReflectionBlocks = ({ fortune }: { fortune: DailyFortune }) => {
  const parts = getDailyReflectionParts(fortune);
  const blocks = [
    {
      label: '第一直觉',
      value: parts.initialImpression,
      placeholder: '还没有写第一眼感受。',
    },
    {
      label: '今日回看',
      value: parts.dailyReview,
      placeholder: '还没有记录今天的回看。',
    },
  ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {blocks.map(block => (
        <div
          key={block.label}
          className={`rounded-2xl border p-3 ${
            block.value
              ? 'border-forest-accent/8 bg-white/34'
              : 'border-dashed border-forest-accent/12 bg-white/28'
          }`}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-forest-accent">{block.label}</p>
          <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
            block.value ? 'text-forest-ink' : 'text-forest-muted'
          }`}>
            {block.value || block.placeholder}
          </p>
        </div>
      ))}
    </div>
  );
};

interface FortuneArchiveItemProps {
  fortune: DailyFortune;
  calendarDate: string;
  yearCount?: number;
  monthCount?: number;
  expanded: boolean;
  isOrganizing: boolean;
  isSelected: boolean;
  resetSwipeToken: number;
  saveError?: string;
  onToggle: () => void;
  onToggleSelected: () => void;
  onEdit: (fortune: DailyFortune) => void;
  onSaveToCardAnnotation: (fortune: DailyFortune) => void;
  onRequestDelete: (fortune: DailyFortune) => void;
}

const FortuneArchiveItem = ({
  fortune,
  calendarDate,
  yearCount,
  monthCount,
  expanded,
  isOrganizing,
  isSelected,
  resetSwipeToken,
  saveError,
  onToggle,
  onToggleSelected,
  onEdit,
  onSaveToCardAnnotation,
  onRequestDelete,
}: FortuneArchiveItemProps) => {
  const card = getCardData(fortune.cardName);
  const canSaveToAnnotation = hasDailyReflectionContent(fortune);
  const isSavedToAnnotation = Boolean(fortune.savedToCardAnnotationAt);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const showSwipeAction = !isOrganizing && (isSwipeOpen || swipeOffset < -8);
  const swipeStateRef = useRef<SwipeDragState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffset: 0,
    isTracking: false,
    isDragging: false,
  });
  const didSwipeRef = useRef(false);

  const closeSwipe = useCallback(() => {
    setSwipeOffset(0);
    setIsSwipeOpen(false);
  }, []);

  const openSwipe = useCallback(() => {
    setSwipeOffset(-SWIPE_ACTION_WIDTH);
    setIsSwipeOpen(true);
  }, []);

  useEffect(() => {
    if (isOrganizing) closeSwipe();
  }, [closeSwipe, isOrganizing]);

  useEffect(() => {
    closeSwipe();
  }, [closeSwipe, resetSwipeToken]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isOrganizing || event.button !== 0) return;

    swipeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: isSwipeOpen ? -SWIPE_ACTION_WIDTH : 0,
      isTracking: true,
      isDragging: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeStateRef.current;
    if (!state.isTracking || state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.isDragging && (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY))) return;

    if (!state.isDragging) event.currentTarget.setPointerCapture?.(event.pointerId);
    state.isDragging = true;
    didSwipeRef.current = true;
    event.preventDefault();
    setSwipeOffset(clampSwipeOffset(state.startOffset + deltaX));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeStateRef.current;
    if (!state.isTracking || state.pointerId !== event.pointerId) return;

    const finalOffset = clampSwipeOffset(state.startOffset + event.clientX - state.startX);
    swipeStateRef.current = { ...state, isTracking: false, isDragging: false };
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!state.isDragging) return;
    if (finalOffset <= -SWIPE_OPEN_THRESHOLD) openSwipe();
    else closeSwipe();
  };

  const handleSummaryClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (isSwipeOpen) {
      closeSwipe();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (isOrganizing) onToggleSelected();
    else onToggle();
  };

  const handleDeleteFromSwipe = () => {
    closeSwipe();
    onRequestDelete(fortune);
  };

  return (
    <div className={`relative overflow-hidden rounded-[1.45rem] border shadow-none transition-colors ${
      isSelected
        ? 'border-red-200 bg-red-50/38'
        : 'border-forest-accent/8 bg-white/44'
    }`}>
      {!isOrganizing && (
        <div className={`absolute inset-y-0 right-0 flex w-[5.25rem] items-stretch justify-end bg-red-50 transition-opacity ${
          showSwipeAction ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`} aria-hidden={!showSwipeAction}>
          <button
            type="button"
            onClick={handleDeleteFromSwipe}
            tabIndex={isSwipeOpen ? 0 : -1}
            aria-label={`删除 ${fortune.date} 日运记录`}
            className={`flex w-full flex-col items-center justify-center gap-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-100 ${
              showSwipeAction ? 'visible' : 'invisible'
            }`}
          >
            <Trash2 size={17} />
            删除
          </button>
        </div>
      )}

      <motion.div
        animate={{ x: isOrganizing ? 0 : swipeOffset }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`relative touch-pan-y rounded-[1.35rem] ${
          isSelected ? 'bg-red-50/80' : 'bg-white/44'
        }`}
      >
        <button
          type="button"
          onClick={handleSummaryClick}
          aria-expanded={isOrganizing ? undefined : expanded}
          aria-label={isOrganizing
            ? `${isSelected ? '取消选择' : '选择'} ${fortune.date} 日运记录`
            : undefined}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
          {isOrganizing && (
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
              isSelected
                ? 'border-red-400 bg-red-500 text-white'
                : 'border-forest-accent/18 bg-white/70 text-transparent'
            }`}>
              <CheckCircle2 size={14} />
            </span>
          )}
          <div className={`h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-forest-accent/10 bg-forest-bg shadow-sm ${fortune.isReversed ? 'rotate-180' : ''}`}>
            <TarotCardImage
              src={getCardImageUrl(card?.id || 'ar00')}
              alt={fortune.cardName}
              name={fortune.cardName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`relative flex flex-wrap items-center gap-2 ${isOrganizing ? '' : 'pr-6'}`}>
              <p className="font-serif text-lg font-semibold text-forest-ink">{fortune.cardName}</p>
              <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-medium text-forest-accent">
                {getDirectionLabel(fortune)}
              </span>
              {isSavedToAnnotation && (
                <span className="rounded-full bg-forest-pink/10 px-2 py-0.5 text-[10px] font-medium text-forest-pink">
                  已归入注疏
                </span>
              )}
              {!isOrganizing && (
                <ChevronDown size={16} aria-hidden="true" className={`absolute right-0 top-1/2 -translate-y-1/2 text-forest-accent transition-transform ${expanded ? 'rotate-180' : ''}`} />
              )}
            </div>
            <p className="mt-1 text-xs text-forest-muted">
              {calendarDate || fortune.date} · {getSourceLabel(fortune.source)}
              {!isOrganizing && yearCount !== undefined && <span className="whitespace-nowrap tabular-nums text-forest-accent"> · 年内 {yearCount} 次</span>}
            </p>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-forest-text/70">
              {getFortunePreviewText(fortune) || '还没有写第一直觉或今日回看。'}
            </p>
          </div>
        </button>

        <AnimatePresence>
          {expanded && !isOrganizing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-forest-accent/8 px-4 pb-4 pt-3"
            >
              {monthCount !== undefined && (
                <p className="mb-1.5 text-xs tabular-nums text-forest-accent">{calendarDate.slice(0, 4)} 年出现 {yearCount} 次 · {Number(calendarDate.slice(5, 7))} 月出现 {monthCount} 次</p>
              )}
              <p className="text-xs leading-relaxed text-forest-text/80">{fortune.interpretation}</p>
              <DailyReflectionBlocks fortune={fortune} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onEdit(fortune)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-accent/10 px-4 text-xs font-medium text-forest-accent hover:bg-forest-accent/15"
                >
                  <PenLine size={14} />
                  补写日运手札
                </button>
                <button
                  type="button"
                  onClick={() => onSaveToCardAnnotation(fortune)}
                  disabled={!canSaveToAnnotation || isSavedToAnnotation}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-medium transition-colors ${
                    isSavedToAnnotation
                      ? 'bg-forest-accent/10 text-forest-accent'
                      : canSaveToAnnotation
                        ? 'bg-forest-pink/12 text-forest-pink hover:bg-forest-pink/18'
                        : 'bg-forest-bg text-forest-muted'
                  }`}
                >
                  {isSavedToAnnotation ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
                  {isSavedToAnnotation ? '已归入牌义注疏' : canSaveToAnnotation ? '归入牌义注疏' : '先补写再归入'}
                </button>
              </div>
              {saveError && <p role="alert" className="mt-2 text-xs leading-relaxed text-forest-muted">{saveError}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export const DailyFortuneArchiveModal: React.FC<DailyFortuneArchiveModalProps> = ({
  fortunes,
  isOpen,
  onClose,
  onUpdateReflection,
  onSaveToCardAnnotation,
  onDeleteFortunes,
  ownerName = '见习阁主',
  ownerScope = 'guest',
  readings = [],
  onEditReading,
  onUpdateReadingFeedback,
}) => {
  const dailyReadings = useMemo(() => readings.filter(isDailyReading).sort((a, b) =>
    getRecordCalendarDate(b.readingDate || b.date).localeCompare(getRecordCalendarDate(a.readingDate || a.date))
    || b.date.localeCompare(a.date)), [readings]);
  const [source, setSource] = useState<'draws' | 'readings'>('draws');
  const openedOnce = useRef(false);
  const [readingQuery, setReadingQuery] = useState('');
  const [readingDate, setReadingDate] = useState('');
  const [readingMonth, setReadingMonth] = useState('');
  const [drawQuery, setDrawQuery] = useState('');
  const [drawDate, setDrawDate] = useState('');
  const [drawMonth, setDrawMonth] = useState('');
  const [readingFilter, setReadingFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);
  const archiveAnchor = useRef<HTMLDivElement>(null);
  const sourceScroll = useRef({ draws: 0, readings: 0 });
  useEffect(() => {
    if (!isOpen) return;
    let scroll: HTMLElement | null = null;
    const remember = () => { if (scroll) sourceScroll.current[source] = scroll.scrollTop; };
    const frame = requestAnimationFrame(() => {
      scroll = archiveAnchor.current?.closest<HTMLElement>('[data-page-scroll]') || null;
      if (scroll) { scroll.scrollTop = sourceScroll.current[source]; scroll.addEventListener('scroll', remember, { passive: true }); }
    });
    return () => { cancelAnimationFrame(frame); remember(); scroll?.removeEventListener('scroll', remember); };
  }, [isOpen, source]);
  useEffect(() => {
    if (!isOpen || openedOnce.current) return;
    openedOnce.current = true;
    if (!fortunes.length && dailyReadings.length) setSource('readings');
  }, [isOpen, fortunes.length, dailyReadings.length]);
  const visibleReadings = dailyReadings.filter(reading => readingMatchesSearch(reading, readingQuery)
    && (!readingDate || getRecordCalendarDate(reading.readingDate || reading.date) === readingDate)
    && (!readingMonth || getRecordCalendarDate(reading.readingDate || reading.date).startsWith(readingMonth))
    && (readingFilter === 'all' || Boolean(reading.userFeedback?.trim()) === (readingFilter === 'reviewed')));

  const [activeView, setActiveView] = useState<ReviewView>('timeline');
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingFortune, setEditingFortune] = useState<DailyFortune | null>(null);
  const isEditingPast = Boolean(editingFortune && getRecordCalendarDate(editingFortune.date) < toLocalReadingDate());
  const reviewLabel = isEditingPast ? '回看' : '今日回看';
  const noMatchText = isEditingPast ? NO_OBVIOUS_PAST_DAILY_MATCH_TEXT : NO_OBVIOUS_DAILY_MATCH_TEXT;
  const [editInitialImpression, setEditInitialImpression] = useState('');
  const [editDailyReview, setEditDailyReview] = useState('');
  const [editSaveError, setEditSaveError] = useState('');
  const editDraft = useLocalDraft(`tarot_daily_reflection_draft_${ownerScope}_${editingFortune?.id || 'none'}`, {
    initialImpression: editInitialImpression,
    dailyReview: editDailyReview,
  }, isOpen && Boolean(editingFortune));
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [toolsPanel, setToolsPanel] = useState<'search' | 'more' | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [annotationError, setAnnotationError] = useState<{ id: string; message: string } | null>(null);
  const [swipeResetToken, setSwipeResetToken] = useState(0);
  const currentMonthKey = getCurrentMonthKey();
  const selectedMonthKey = drawMonth || currentMonthKey;
  const cardCountsByPeriod = useMemo(() => {
    const counts = new Map<string, number>();
    for (const fortune of fortunes) {
      const date = getRecordCalendarDate(fortune.date);
      if (!date) continue;
      for (const period of [date.slice(0, 4), date.slice(0, 7)]) {
        const key = `${period}:${fortune.cardName}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [fortunes]);
  const searchedFortunes = useMemo(() => fortunes.filter(fortune => dailyFortuneMatchesSearch(fortune, drawQuery)
    && (!drawDate || getRecordCalendarDate(fortune.date) === drawDate)
    && (!(drawMonth || activeView === 'month') || getRecordCalendarDate(fortune.date).startsWith(selectedMonthKey))),
  [fortunes, drawQuery, drawDate, drawMonth, activeView, selectedMonthKey]);
  const visibleFortunes = useMemo(
    () => searchedFortunes.filter(fortune => matchesReviewFilter(fortune, reviewFilter)),
    [searchedFortunes, reviewFilter],
  );
  const monthFortunes = useMemo(
    () => getFortunesForMonth(visibleFortunes, selectedMonthKey),
    [selectedMonthKey, visibleFortunes],
  );
  const cardGroups = useMemo(
    () => getDailyFortunesByCard(visibleFortunes, selectedMonthKey),
    [selectedMonthKey, visibleFortunes],
  );
  const monthlyStats = useMemo(
    () => getDailyFortuneMonthlyCardStats(visibleFortunes, selectedMonthKey),
    [selectedMonthKey, visibleFortunes],
  );

  const selectedCardGroup = cardGroups.find(group => group.cardName === selectedCardName) || null;
  const cardViewFortunes = selectedCardName ? selectedCardGroup?.fortunes || [] : visibleFortunes;
  const exportFortunes = activeView === 'month'
    ? monthFortunes
    : activeView === 'cards'
      ? cardViewFortunes
      : visibleFortunes;
  const currentListFortunes = activeView === 'timeline'
    ? visibleFortunes
    : activeView === 'cards'
      ? selectedCardName ? cardViewFortunes : []
      : monthFortunes;

  const savedCount = searchedFortunes.filter(fortune => Boolean(fortune.savedToCardAnnotationAt)).length;
  const reviewedCount = searchedFortunes.filter(hasDailyReview).length;
  const pendingReviewCount = searchedFortunes.filter(isDailyReviewPending).length;
  const monthReversedCount = monthFortunes.filter(fortune => fortune.isReversed).length;
  const monthReversedRatio = monthFortunes.length > 0
    ? Math.round((monthReversedCount / monthFortunes.length) * 100)
    : 0;
  const monthPendingReviewCount = monthFortunes.filter(isDailyReviewPending).length;
  const monthTopCards = monthlyStats.slice(0, 3);

  const stats = useMemo(() => ([
    ['当前结果', exportFortunes.length, '天'],
    ['已回看', exportFortunes.filter(hasDailyReview).length, '天'],
    ['待回看', exportFortunes.filter(isDailyReviewPending).length, '天'],
    ['入注疏', exportFortunes.filter(fortune => Boolean(fortune.savedToCardAnnotationAt)).length, '条'],
  ]), [exportFortunes]);

  const reviewFilterOptions = useMemo(() => ([
    { id: 'all' as const, label: '全部', count: searchedFortunes.length },
    { id: 'pending' as const, label: '待回看', count: pendingReviewCount },
    { id: 'reviewed' as const, label: '已回看', count: reviewedCount },
    { id: 'saved' as const, label: '入注疏', count: savedCount },
  ]), [searchedFortunes.length, pendingReviewCount, reviewedCount, savedCount]);

  useEffect(() => {
    const availableIds = new Set(fortunes.map(fortune => fortune.id));
    setSelectedDeleteIds(current => current.filter(id => availableIds.has(id)));
  }, [fortunes]);

  useEffect(() => {
    if (selectedCardName && !cardGroups.some(group => group.cardName === selectedCardName)) {
      setSelectedCardName(null);
    }
  }, [cardGroups, selectedCardName]);

  const openEdit = (fortune: DailyFortune) => {
    resetSwipeActions();
    const reflectionParts = getDailyReflectionParts(fortune);
    const savedDraft = readLocalDraft<DailyFortuneReflectionParts>(`tarot_daily_reflection_draft_${ownerScope}_${fortune.id}`);
    setEditingFortune(fortune);
    setEditSaveError('');
    setEditInitialImpression(typeof savedDraft?.initialImpression === 'string' ? savedDraft.initialImpression : reflectionParts.initialImpression);
    setEditDailyReview(typeof savedDraft?.dailyReview === 'string' ? savedDraft.dailyReview : reflectionParts.dailyReview);
  };

  const closeEdit = () => {
    setEditSaveError('');
    setEditingFortune(null);
    setEditInitialImpression('');
    setEditDailyReview('');
  };

  const requestCloseEdit = () => {
    if (!editDraft.durable) {
      setEditSaveError('暂存失败，请先复制文字或释放存储空间后保存。');
      return;
    }
    closeEdit();
  };

  const resetSwipeActions = useCallback(() => {
    setSwipeResetToken(current => current + 1);
  }, []);

  const saveEdit = () => {
    if (!editingFortune) return;
    try {
      onUpdateReflection(editingFortune.id, {
        initialImpression: editInitialImpression,
        dailyReview: editDailyReview,
      });
    } catch (error) {
      setEditSaveError(error instanceof Error ? error.message : '保存暂未完成，请保留文字后重试。');
      return;
    }
    editDraft.clear();
    closeEdit();
  };

  const handleSaveToCardAnnotation = (fortune: DailyFortune) => {
    if (!hasDailyReflectionContent(fortune) || fortune.savedToCardAnnotationAt) return;
    resetSwipeActions();
    setAnnotationError(null);
    try {
      onSaveToCardAnnotation(fortune.id);
    } catch (error) {
      setAnnotationError({ id: fortune.id, message: error instanceof Error && error.message ? error.message : '归入暂未完成，请稍后重试。' });
    }
  };

  const closeOrganizing = () => {
    resetSwipeActions();
    setIsOrganizing(false);
    setSelectedDeleteIds([]);
    setShowDeleteConfirm(false);
    setDeleteError('');
  };

  const closeTools = () => {
    setToolsPanel(null);
    setIsExportMenuOpen(false);
  };

  const openTools = (panel: 'search' | 'more') => {
    resetSwipeActions();
    setToolsPanel(panel);
    setIsExportMenuOpen(false);
  };

  const closeArchive = () => {
    closeEdit();
    closeOrganizing();
    setAnnotationError(null);
    closeTools();
    onClose();
  };

  const handleViewChange = (view: ReviewView) => {
    resetSwipeActions();
    setActiveView(view);
    setExpandedId(null);
    closeTools();
  };

  const handleReviewFilterChange = (filter: ReviewFilter) => {
    resetSwipeActions();
    setReviewFilter(filter);
    setSelectedDeleteIds([]);
    setShowDeleteConfirm(false);
    setExpandedId(null);
  };

  const toggleExportMenu = () => {
    resetSwipeActions();
    setIsExportMenuOpen(prev => !prev);
  };

  const toggleOrganizing = () => {
    resetSwipeActions();
    setExpandedId(null);
    closeTools();
    setIsOrganizing(prev => {
      if (prev) {
        setSelectedDeleteIds([]);
        setShowDeleteConfirm(false);
      }

      return !prev;
    });
  };

  const toggleDeleteSelection = (fortuneId: string) => {
    setSelectedDeleteIds(current => (
      current.includes(fortuneId)
        ? current.filter(id => id !== fortuneId)
        : [...current, fortuneId]
    ));
  };

  const selectCurrentList = () => {
    const currentIds = currentListFortunes.map(fortune => fortune.id);
    if (currentIds.length === 0) return;

    setSelectedDeleteIds(current => Array.from(new Set([...current, ...currentIds])));
  };

  const requestDeleteFortune = (fortune: DailyFortune) => {
    setDeleteError('');
    setSelectedDeleteIds([fortune.id]);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteFortunes = () => {
    if (selectedDeleteIds.length === 0) return false;

    setDeleteError('');
    try {
      onDeleteFortunes(selectedDeleteIds);
    } catch (error) {
      setDeleteError(error instanceof Error && error.message ? error.message : '删除暂未完成，记录已保留，请稍后重试。');
      return false;
    }
    if (editingFortune && selectedDeleteIds.includes(editingFortune.id)) {
      closeEdit();
    }
    closeOrganizing();
  };

  const handleExportMarkdown = () => {
    const fileBaseName = getDailyReviewFileBaseName(ownerName);

    downloadTextFile(
      `${fileBaseName}.md`,
      exportDailyFortunesToMarkdown(exportFortunes, '塔罗研习阁｜日运复盘记录'),
      'text/markdown;charset=utf-8',
    );
    trackEvent('daily_review_exported', {
      format: 'markdown',
      record_count: exportFortunes.length,
      view: activeView,
    });
    closeTools();
  };

  const handleExportPdf = () => {
    if (exportFortunes.length === 0) return;

    const blob = createExportPdfBlobFromLines(
      buildDailyFortunePdfLines(exportFortunes, '塔罗研习阁｜日运复盘', ownerName)
    );
    const fileBaseName = getDailyReviewFileBaseName(ownerName);
    downloadBlobFile(`${fileBaseName}.pdf`, blob);
    trackEvent('daily_review_exported', {
      format: 'pdf',
      record_count: exportFortunes.length,
      view: activeView,
    });
    closeTools();
  };

  const handleExportCsv = () => {
    const fileBaseName = getDailyReviewFileBaseName(ownerName);

    downloadTextFile(
      `${fileBaseName}.csv`,
      exportDailyFortunesToCsv(exportFortunes),
      'text/csv;charset=utf-8',
    );
    trackEvent('daily_review_exported', {
      format: 'csv',
      record_count: exportFortunes.length,
      view: activeView,
    });
    closeTools();
  };

  const renderFortuneList = (items: DailyFortune[]) => (
    items.length === 0 ? (
      <QuietEmptyState
        icon={reviewFilter === 'pending' ? <Clock3 size={23} /> : <Archive size={23} />}
        title={fortunes.length === 0 ? '这里还没有日运记录' : '没有符合条件的日运'}
        description={fortunes.length === 0
          ? '抽牌或录入现实牌后，就能在这里形成你的日运手札。'
          : '换一个筛选条件，或回到全部记录继续查看。'}
        className="py-8"
      />
    ) : items.map(fortune => {
      const calendarDate = getRecordCalendarDate(fortune.date);
      return (
        <FortuneArchiveItem
          key={fortune.id}
          fortune={fortune}
          calendarDate={calendarDate}
          yearCount={cardCountsByPeriod.get(`${calendarDate.slice(0, 4)}:${fortune.cardName}`)}
          monthCount={cardCountsByPeriod.get(`${calendarDate.slice(0, 7)}:${fortune.cardName}`)}
          expanded={!isOrganizing && expandedId === fortune.id}
          isOrganizing={isOrganizing}
          isSelected={selectedDeleteIds.includes(fortune.id)}
          resetSwipeToken={swipeResetToken}
          saveError={annotationError?.id === fortune.id ? annotationError.message : undefined}
          onToggle={() => setExpandedId(expandedId === fortune.id ? null : fortune.id)}
          onToggleSelected={() => toggleDeleteSelection(fortune.id)}
          onEdit={openEdit}
          onSaveToCardAnnotation={handleSaveToCardAnnotation}
          onRequestDelete={requestDeleteFortune}
        />
      );
    })
  );

  const isReadingSource = source === 'readings';
  const sourceLabel = isReadingSource ? '日运手记' : '日运抽牌';
  const query = isReadingSource ? readingQuery : drawQuery;
  const date = isReadingSource ? readingDate : drawDate;
  const month = isReadingSource ? readingMonth : drawMonth;
  const activeStatus = isReadingSource
    ? readingFilterOptions.find(([value]) => value === readingFilter && value !== 'all')?.[1]
    : reviewFilterOptions.find(option => option.id === reviewFilter && option.id !== 'all')?.label;
  const filterSummary = [query.trim(), date || month, activeStatus].filter(Boolean).join(' · ');
  const viewSummary = activeView === 'month' ? `${selectedMonthKey} 月度回看` : '按牌';
  const showViewSummary = !isReadingSource && activeView !== 'timeline';
  const toolButtonClass = 'flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-forest-accent transition-colors hover:bg-forest-accent/8 min-[360px]:px-2 sm:px-3';

  const clearFilters = () => {
    if (isReadingSource) {
      setReadingQuery('');
      setReadingDate('');
      setReadingMonth('');
      setReadingFilter('all');
    } else {
      setDrawQuery('');
      setDrawDate('');
      setDrawMonth('');
      handleReviewFilterChange('all');
    }
  };

  return (
    <PageView isOpen={isOpen} onBack={closeArchive} title="日运复盘" width="wide">
      <div ref={archiveAnchor} className="-mt-3 mb-2 border-b border-forest-accent/10 sm:-mt-5">
        <div className="flex items-center justify-between gap-1">
          <div role="tablist" aria-label="日运来源" className="flex min-w-0 items-stretch gap-1 sm:gap-2">
            {([['draws', '日运抽牌', fortunes.length], ['readings', '日运手记', dailyReadings.length]] as const).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={source === value}
                onClick={() => setSource(value)}
                className={`flex min-h-11 min-w-0 items-center gap-1 border-b-2 px-1.5 text-xs whitespace-nowrap sm:px-3 sm:text-sm ${
                  source === value ? 'border-forest-accent font-medium text-forest-accent' : 'border-transparent text-forest-muted'
                }`}
              >
                {label} <span className="min-w-0 truncate text-[11px] tabular-nums">{count}</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="查找与筛选" title="查找与筛选" aria-haspopup="dialog" onClick={() => openTools('search')} className={`${toolButtonClass} ${filterSummary ? 'bg-forest-accent/10' : ''}`}>
              <Search size={19} aria-hidden="true" /><span className="hidden min-[360px]:inline">查找</span>
            </button>
            {!isReadingSource && (
              <button type="button" aria-label="更多日运操作" title="更多日运操作" aria-haspopup="dialog" onClick={() => openTools('more')} className={toolButtonClass}>
                <Ellipsis size={21} aria-hidden="true" /><span className="hidden min-[360px]:inline">更多</span>
              </button>
            )}
          </div>
        </div>
        {(filterSummary || showViewSummary) && (
          <div className="flex items-center gap-1 border-t border-forest-accent/7">
            {showViewSummary && (
              <button type="button" aria-haspopup="dialog" onClick={() => openTools('more')} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-xs font-medium text-forest-accent hover:bg-forest-accent/8">
                {viewSummary}<ChevronDown size={13} aria-hidden="true" />
              </button>
            )}
            {filterSummary && <>
              <button type="button" aria-haspopup="dialog" onClick={() => openTools('search')} className="min-h-11 min-w-0 flex-1 truncate px-2 text-left text-xs text-forest-accent hover:bg-forest-accent/8">
                {filterSummary}
              </button>
              <button type="button" aria-label="清除当前筛选" title="清除当前筛选" onClick={clearFilters} className={toolButtonClass}><X size={17} aria-hidden="true" /></button>
            </>}
          </div>
        )}
      </div>
      {isReadingSource ? <section aria-label="日运手记">
        {!visibleReadings.length && <p className="py-10 text-center text-forest-muted">{dailyReadings.length ? '没有符合条件的日运手记' : '还没有带“日运”标签的手记'}</p>}
        <div className="divide-y divide-forest-accent/10">
          {visibleReadings.map(reading => <button key={reading.id} type="button" onClick={() => setSelectedReadingId(reading.id)} className="flex min-h-20 w-full items-center gap-3 py-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-forest-muted">{getRecordCalendarDate(reading.readingDate || reading.date)} · {reading.userFeedback?.trim() ? '已复盘' : '待复盘'}</span>
              <span className="mt-1 block break-words font-serif text-base font-bold text-forest-ink">{reading.question}</span>
              <span className="mt-1 block break-words text-xs text-forest-muted">{reading.cards.filter(card => card.name).map(card => `${card.name}${card.isReversed ? '（逆位）' : ''}`).join(' · ')} · {reading.spread}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-forest-accent" />
          </button>)}
        </div>
        <ReadingDetailModal asPage reading={dailyReadings.find(reading => reading.id === selectedReadingId) || null} ownerScope={ownerScope} onSaveFeedback={onUpdateReadingFeedback} onClose={() => setSelectedReadingId(null)} onEdit={onEditReading ? reading => { setSelectedReadingId(null); onEditReading(reading); } : undefined} />
      </section> : <>
              {isOrganizing && (
                <div className="mb-2 flex flex-wrap items-center gap-1">
                  <button type="button" onClick={toggleOrganizing} aria-pressed={true} className={filterButtonClass(false)}>
                    <CheckCircle2 size={15} aria-hidden="true" />完成整理
                  </button>
                  <button type="button" onClick={selectCurrentList} disabled={currentListFortunes.length === 0} className={`${filterButtonClass(false)} disabled:opacity-45`}>全选当前</button>
                  <button
                    type="button"
                    onClick={() => { setDeleteError(''); setShowDeleteConfirm(true); }}
                    disabled={selectedDeleteIds.length === 0}
                    aria-label={`删除选中 ${selectedDeleteIds.length} 条日运记录`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-red-50 px-3 text-xs font-medium text-red-500 hover:bg-red-100 disabled:opacity-45"
                  >
                    <Trash2 size={15} aria-hidden="true" />删除选中 {selectedDeleteIds.length}
                  </button>
                </div>
              )}
              <div className="space-y-2.5">
                {fortunes.length === 0 ? (
                  <QuietEmptyState
                    icon={<Archive size={24} />}
                    title="归档第一张日运牌"
                    description="抽牌或录入现实牌后，就能在这里形成你的日运手札。"
                  />
                ) : activeView === 'timeline' ? (
                  renderFortuneList(visibleFortunes)
                ) : activeView === 'cards' ? (
                  <>
                    {!selectedCardName ? (
                      cardGroups.length === 0 ? (
                        renderFortuneList([])
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {cardGroups.map(group => {
                            const latestFortune = group.fortunes[0];
                            const latestPreview = latestFortune ? getFortunePreviewText(latestFortune) : '';

                            return (
                              <button
                                key={group.cardName}
                                type="button"
                                onClick={() => setSelectedCardName(group.cardName)}
                                className="rounded-[1.25rem] border border-forest-accent/7 bg-white/36 p-3 text-left shadow-none transition-colors hover:border-forest-accent/20 hover:bg-white/52"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-serif text-base font-semibold text-forest-ink">{group.cardName}</p>
                                    <p className="mt-1 text-xs text-forest-muted">
                                      当前 {group.totalCount} 次 · {selectedMonthKey} {group.currentMonthCount} 次
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-forest-accent/10 px-2.5 py-1 text-[10px] font-medium text-forest-accent">
                                    注疏 {group.savedToAnnotationCount}
                                  </span>
                                </div>
                                {latestFortune && (
                                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-forest-text/70">
                                    最近 {latestFortune.date}{latestPreview && ` · ${latestPreview}`}
                                  </p>
                                )}
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <span className="rounded-2xl bg-white/34 px-3 py-2 text-[11px] text-forest-muted">
                                    正位 {group.uprightCount}
                                  </span>
                                  <span className="rounded-2xl bg-forest-pink/10 px-3 py-2 text-[11px] text-forest-muted">
                                    逆位 {group.reversedCount}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-x-3">
                          <button type="button" onClick={() => setSelectedCardName(null)} className={filterButtonClass(false)}>全部牌组</button>
                          <p className="min-w-0 text-xs text-forest-muted">
                            <strong className="font-serif text-sm text-forest-ink">{selectedCardName}</strong> · {cardViewFortunes.length} 条
                            {selectedCardGroup && ` · ${selectedMonthKey} ${selectedCardGroup.currentMonthCount} 次 · 注疏 ${selectedCardGroup.savedToAnnotationCount} 条`}
                          </p>
                        </div>
                        {renderFortuneList(cardViewFortunes)}
                      </>
                    )}
                  </>
                ) : (
                  renderFortuneList(monthFortunes)
                )}
              </div>
          <PageView isOpen={Boolean(editingFortune)} onBack={requestCloseEdit} title="补写日运">
            {editingFortune && <>
                  <DailyReflectionCard
                    fortune={editingFortune}
                    description={isEditingPast ? `${editingFortune.date} · 回顾那天的经历。` : '先保留第一眼的感受，再回看这一天。'}
                  />

                  <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                    <label className="block">
                      <span className="text-xs font-medium text-forest-accent">第一直觉</span>
                      <AutoResizeTextarea
                        minRows={1.5}
                        maxRows={7}
                        value={editInitialImpression}
                        onFocus={scrollFocusedFieldIntoView}
                        onChange={(event) => setEditInitialImpression(event.target.value)}
                        aria-label="第一直觉"
                        placeholder="刚看到这张牌时，第一眼想到什么？"
                        className="mt-1 w-full rounded-xl border border-forest-accent/12 bg-white/88 p-3 text-base leading-relaxed text-forest-ink outline-none transition-all placeholder:text-forest-muted/70 focus:border-forest-accent/35 focus:ring-2 focus:ring-forest-accent/15 sm:rounded-2xl sm:p-3.5 sm:text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-forest-accent">{reviewLabel}</span>
                      <AutoResizeTextarea
                        minRows={1.5}
                        maxRows={7}
                        value={editDailyReview}
                        onFocus={scrollFocusedFieldIntoView}
                        onChange={(event) => setEditDailyReview(event.target.value)}
                        aria-label={reviewLabel}
                        placeholder={isEditingPast
                          ? '那天发生了什么？你在牌面和经历之间看到了什么联系？'
                          : '今天发生了什么？它和这张牌哪里有关系，或暂时没有看见关系？'}
                        className="mt-1 w-full rounded-xl border border-forest-accent/12 bg-white/88 p-3 text-base leading-relaxed text-forest-ink outline-none transition-all placeholder:text-forest-muted/70 focus:border-forest-accent/35 focus:ring-2 focus:ring-forest-accent/15 sm:rounded-2xl sm:p-3.5 sm:text-sm"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setEditDailyReview(current => appendNoObviousDailyMatch(current, noMatchText))}
                      className="min-h-11 rounded-full bg-forest-accent/10 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-forest-accent/15"
                    >
                      {noMatchText}
                    </button>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-forest-muted" role={editSaveError || !editDraft.durable ? 'alert' : undefined}>
                    {editSaveError || (!editDraft.durable ? '浏览器存储暂不可用，请保留当前页面或复制文字后再离开。' : '未保存的文字会暂存在本机，可稍后回来继续写。')}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={requestCloseEdit}
                      className="min-h-11 flex-1 rounded-xl px-4 text-xs font-medium text-forest-muted hover:bg-forest-accent/5 hover:text-forest-ink"
                    >
                      稍后再写
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-forest-accent px-4 text-xs font-medium text-white hover:bg-forest-accent/90"
                    >
                      <Save size={14} />
                      保存记录
                    </button>
                  </div>
            </>}
          </PageView>

          <ConfirmDialog
            isOpen={showDeleteConfirm}
            title="删除日运记录"
            message={`确定要删除选中的 ${selectedDeleteIds.length} 条日运记录吗？已归入牌义注疏的内容不会被移除。`}
            confirmText="删除"
            cancelText="取消"
            destructive
            error={deleteError}
            onConfirm={confirmDeleteFortunes}
            onClose={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
          />
      </>}
      {isOpen && createPortal(
        <Modal isOpen={toolsPanel !== null} onClose={closeTools} title={toolsPanel === 'search' ? '查找与筛选' : '更多日运操作'}>
          {toolsPanel === 'search' ? (
            <div className="space-y-3">
              <ArchiveSearchControls
                sourceLabel={sourceLabel} query={query} date={date}
                month={!isReadingSource && activeView === 'month' ? selectedMonthKey : month}
                onQueryChange={isReadingSource ? setReadingQuery : setDrawQuery}
                onDateChange={value => {
                  if (isReadingSource) {
                    setReadingDate(value);
                    if (value) setReadingMonth(value.slice(0, 7));
                  } else {
                    setDrawDate(value);
                    if (value) setDrawMonth(value.slice(0, 7));
                  }
                }}
                onMonthChange={value => {
                  if (isReadingSource) {
                    setReadingMonth(value);
                    if (!readingDate.startsWith(value)) setReadingDate('');
                  } else {
                    setDrawMonth(value);
                    if (!drawDate.startsWith(value || (activeView === 'month' ? currentMonthKey : ''))) setDrawDate('');
                  }
                }}
              />
              {isReadingSource ? (
                <div role="group" aria-label="日运手记复盘筛选" className="flex flex-wrap gap-1.5">
                  {readingFilterOptions.map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={readingFilter === value} onClick={() => setReadingFilter(value)} className={filterButtonClass(readingFilter === value)}>{label}</button>
                  ))}
                </div>
              ) : (
                <div role="group" aria-label="日运抽牌回看筛选" className="flex flex-wrap gap-1.5">
                  {reviewFilterOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleReviewFilterChange(option.id)}
                      aria-pressed={reviewFilter === option.id}
                      aria-label={`筛选${option.label}日运记录`}
                      className={filterButtonClass(reviewFilter === option.id)}
                    >
                      {option.label}<span className="text-[10px] tabular-nums">{option.count}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p role="status" className="text-xs text-forest-muted">{isReadingSource ? visibleReadings.length : exportFortunes.length} 条符合条件</p>
                <div className="ml-auto flex items-center gap-1.5">
                  {filterSummary && <button type="button" aria-label={`清空${sourceLabel}查找`} onClick={clearFilters} className={filterButtonClass(false)}>清空查找</button>}
                  <button type="button" onClick={closeTools} className={filterButtonClass(true)}>查看记录</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div role="group" aria-label="日运浏览方式" className="flex flex-wrap gap-1.5">
                {viewOptions.map(([view, label, Icon]) => (
                  <button key={view} type="button" onClick={() => handleViewChange(view)} aria-pressed={activeView === view} aria-label={`切换到${label}日运`} className={filterButtonClass(activeView === view)}>
                    <Icon size={15} aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={toggleOrganizing} aria-pressed={isOrganizing} className={filterButtonClass(false)}>
                  <CheckCircle2 size={15} aria-hidden="true" />{isOrganizing ? '完成整理' : '整理'}
                </button>
                  <button
                    type="button"
                    onClick={toggleExportMenu}
                    disabled={exportFortunes.length === 0}
                    aria-haspopup="menu"
                    aria-expanded={isExportMenuOpen}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-forest-accent/88 px-3 text-xs font-medium text-white hover:bg-forest-accent disabled:opacity-45"
                  >
                    <Download size={13} />
                    导出
                    <ChevronDown size={13} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
              </div>
              {isExportMenuOpen && (
                <div
                  role="menu"
                  className="mt-1 rounded-2xl border border-forest-accent/7 bg-white/92 p-2 shadow-[0_16px_42px_-36px_rgba(62,58,54,0.5)] backdrop-blur-md"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportPdf}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-medium text-forest-ink hover:bg-forest-bg"
                  >
                    <span>
                      PDF 手札
                      <span className="mt-0.5 block text-[10px] font-normal text-forest-muted">
                        适合打印或留存整册
                      </span>
                    </span>
                    <Download size={13} className="text-forest-accent" />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportCsv}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-medium text-forest-ink hover:bg-forest-bg"
                  >
                    <span>
                      表格
                      <span className="mt-0.5 block text-[10px] font-normal text-forest-muted">
                        适合继续筛选整理
                      </span>
                    </span>
                    <Table2 size={13} className="text-forest-accent" />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportMarkdown}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-medium text-forest-ink hover:bg-forest-bg"
                  >
                    <span>
                      Markdown
                      <span className="mt-0.5 block text-[10px] font-normal text-forest-muted">
                        适合 Notion / Obsidian
                      </span>
                    </span>
                    <FileText size={13} className="text-forest-accent" />
                  </button>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-1.5 min-[380px]:grid-cols-4">
                {stats.map(([label, value, suffix]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-forest-accent/8 bg-white/30 px-2.5 py-2">
                    <dt className="text-xs text-forest-muted">{label}</dt>
                    <dd className="font-serif text-base font-bold text-forest-accent">{value}<span className="ml-0.5 font-sans text-[10px] font-normal text-forest-muted">{suffix}</span></dd>
                  </div>
                ))}
              </dl>
              {activeView === 'month' && (
                <div className="space-y-2">
                  <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <h4 className="font-serif text-base font-bold text-forest-ink">{selectedMonthKey} 月度回看</h4>
                      <button type="button" onClick={() => openTools('search')} className={filterButtonClass(false)}>选择月份</button>
                    </div>
                    <p className="mt-1 text-xs text-forest-muted">当前主题：{monthTopCards.length > 0 ? monthTopCards.map(stat => `${stat.cardName}×${stat.count}`).join(' · ') : '待积累'}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white/34 px-3 py-2">
                        <p className="text-[10px] text-forest-muted">逆位比例</p>
                        <p className="mt-1 font-serif text-base font-semibold text-forest-accent">{monthReversedRatio}%</p>
                      </div>
                      <div className="rounded-2xl bg-white/34 px-3 py-2">
                        <p className="text-[10px] text-forest-muted">待回看</p>
                        <p className="mt-1 font-serif text-base font-semibold text-forest-accent">{monthPendingReviewCount}天</p>
                      </div>
                      <div className="rounded-2xl bg-white/34 px-3 py-2">
                        <p className="text-[10px] text-forest-muted">记录</p>
                        <p className="mt-1 font-serif text-base font-semibold text-forest-accent">{monthFortunes.length}天</p>
                      </div>
                    </div>
                    {monthlyStats.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {monthlyStats.map(stat => (
                          <button
                            key={stat.cardName}
                            type="button"
                            onClick={() => {
                              setDrawMonth(selectedMonthKey);
                              handleViewChange('cards');
                              setSelectedCardName(stat.cardName);
                            }}
                            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-white/34 px-3 text-left text-xs text-forest-ink"
                          >
                            <span className="font-semibold text-forest-accent">{stat.cardName}</span>
                            <span className="text-forest-muted">
                              {stat.count} 次 · 正 {stat.uprightCount} / 逆 {stat.reversedCount}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-2xl border border-dashed border-forest-accent/14 bg-white/34 px-3 py-4 text-center text-xs text-forest-muted">
                        所选月份暂时没有符合条件的日运。
                      </p>
                    )}
                  </div>

                  {monthFortunes.length > 0 && (
                    <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                      <p className="font-serif text-base font-semibold text-forest-ink">月末回看提纲</p>
                      <div className="mt-3 space-y-2">
                        {[
                          '哪张牌最像这个月反复出现的主题？',
                          '哪些逆位提醒，后来在生活里有了答案？',
                          '哪一条日运值得归入牌义注疏？',
                        ].map(prompt => (
                          <p key={prompt} className="rounded-2xl bg-white/34 px-3 py-2 text-xs leading-relaxed text-forest-text/75">
                            {prompt}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>,
        document.body,
      )}
    </PageView>
  );
};
