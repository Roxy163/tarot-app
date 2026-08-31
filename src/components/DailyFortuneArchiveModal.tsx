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
  X,
} from 'lucide-react';
import { DailyFortune, DailyFortuneReflectionParts } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { TarotCardImage } from './TarotCardImage';
import {
  getDailyReflectionParts,
  hasDailyReflectionContent,
  NO_OBVIOUS_DAILY_MATCH_TEXT,
} from '../lib/dailyFortuneReflection';
import {
  buildDailyFortunePdfLines,
  exportDailyFortunesToCsv,
  exportDailyFortunesToMarkdown,
  getCurrentMonthKey,
  getDailyFortuneMonthlyCardStats,
  getDailyFortunesByCard,
  getFortunesForMonth,
} from '../lib/dailyFortuneReview';
import { createExportPdfBlobFromLines } from '../lib/pdfExport';
import { useClickOutside } from '../hooks/useClickOutside';
import { MysticWatermark } from './MysticWatermark';
import { QuietEmptyState } from './ui/SoftUI';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { trackEvent } from '../lib/analytics';
import { ConfirmDialog } from './ConfirmDialog';

interface DailyFortuneArchiveModalProps {
  fortunes: DailyFortune[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateReflection: (id: string, reflection: string | DailyFortuneReflectionParts) => void;
  onSaveToCardAnnotation: (id: string, note?: string) => void;
  onDeleteFortunes: (ids: string[]) => void;
  ownerName?: string;
}

type ReviewView = 'timeline' | 'cards' | 'month';
type ReviewFilter = 'all' | 'pending' | 'reviewed' | 'saved';
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

const getFortunePreviewText = (fortune: DailyFortune) => {
  const parts = getDailyReflectionParts(fortune);
  return (
    parts.dailyReview
    || parts.initialImpression
    || fortune.reflection
    || fortune.interpretation
  );
};

const clampSwipeOffset = (value: number) => Math.min(0, Math.max(-SWIPE_MAX_OFFSET, value));

const getSafeFileNamePart = (value: string) => (
  value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 24) || '见习阁主'
);

const getDailyReviewFileBaseName = (ownerName: string) => (
  `${getSafeFileNamePart(ownerName)}-日运复盘-${new Date().toISOString().split('T')[0]}`
);

const downloadTextFile = (filename: string, content: string, type: string) => {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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
  expanded: boolean;
  isOrganizing: boolean;
  isSelected: boolean;
  resetSwipeToken: number;
  onToggle: () => void;
  onToggleSelected: () => void;
  onEdit: (fortune: DailyFortune) => void;
  onSaveToCardAnnotation: (fortune: DailyFortune) => void;
  onRequestDelete: (fortune: DailyFortune) => void;
}

const FortuneArchiveItem = ({
  fortune,
  expanded,
  isOrganizing,
  isSelected,
  resetSwipeToken,
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
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeStateRef.current;
    if (!state.isTracking || state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.isDragging && (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY))) return;

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
    event.currentTarget.releasePointerCapture?.(event.pointerId);

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
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-serif text-lg font-semibold text-forest-ink">{fortune.cardName}</p>
              <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-medium text-forest-accent">
                {getDirectionLabel(fortune)}
              </span>
              {isSavedToAnnotation && (
                <span className="rounded-full bg-forest-pink/10 px-2 py-0.5 text-[10px] font-medium text-forest-pink">
                  已归入注疏
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-forest-muted">{fortune.date} · {getSourceLabel(fortune.source)}</p>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-forest-text/70">
              {fortune.reflection || '还没有写第一直觉或今日回看。'}
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
}) => {
  useBodyScrollLock(isOpen);

  const [activeView, setActiveView] = useState<ReviewView>('timeline');
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(fortunes[0]?.id || null);
  const [editingFortune, setEditingFortune] = useState<DailyFortune | null>(null);
  const [editInitialImpression, setEditInitialImpression] = useState('');
  const [editDailyReview, setEditDailyReview] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeResetToken, setSwipeResetToken] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const closeExportMenu = useCallback(() => setIsExportMenuOpen(false), []);
  useClickOutside(exportMenuRef, closeExportMenu, isExportMenuOpen);

  const currentMonthKey = getCurrentMonthKey();
  const visibleFortunes = useMemo(
    () => fortunes.filter(fortune => matchesReviewFilter(fortune, reviewFilter)),
    [fortunes, reviewFilter],
  );
  const allMonthFortunes = useMemo(
    () => getFortunesForMonth(fortunes, currentMonthKey),
    [currentMonthKey, fortunes],
  );
  const monthFortunes = useMemo(
    () => getFortunesForMonth(visibleFortunes, currentMonthKey),
    [currentMonthKey, visibleFortunes],
  );
  const cardGroups = useMemo(
    () => getDailyFortunesByCard(visibleFortunes, currentMonthKey),
    [currentMonthKey, visibleFortunes],
  );
  const monthlyStats = useMemo(
    () => getDailyFortuneMonthlyCardStats(visibleFortunes, currentMonthKey),
    [currentMonthKey, visibleFortunes],
  );
  const allMonthlyStats = useMemo(
    () => getDailyFortuneMonthlyCardStats(fortunes, currentMonthKey),
    [currentMonthKey, fortunes],
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

  const savedCount = fortunes.filter(fortune => Boolean(fortune.savedToCardAnnotationAt)).length;
  const reviewedCount = fortunes.filter(hasDailyReview).length;
  const pendingReviewCount = fortunes.filter(isDailyReviewPending).length;
  const monthReversedCount = allMonthFortunes.filter(fortune => fortune.isReversed).length;
  const monthReversedRatio = allMonthFortunes.length > 0
    ? Math.round((monthReversedCount / allMonthFortunes.length) * 100)
    : 0;
  const monthPendingReviewCount = allMonthFortunes.filter(isDailyReviewPending).length;
  const monthTopCards = allMonthlyStats.slice(0, 3);

  const stats = useMemo(() => ([
    ['已归档', fortunes.length, '天'],
    ['本月', allMonthFortunes.length, '天'],
    ['待回看', pendingReviewCount, '天'],
    ['入注疏', savedCount, '条'],
  ]), [allMonthFortunes.length, fortunes.length, pendingReviewCount, savedCount]);

  const reviewFilterOptions = useMemo(() => ([
    { id: 'all' as const, label: '全部', count: fortunes.length },
    { id: 'pending' as const, label: '待回看', count: pendingReviewCount },
    { id: 'reviewed' as const, label: '已回看', count: reviewedCount },
    { id: 'saved' as const, label: '入注疏', count: savedCount },
  ]), [fortunes.length, pendingReviewCount, reviewedCount, savedCount]);

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
    setIsExportMenuOpen(false);
    const reflectionParts = getDailyReflectionParts(fortune);
    setEditingFortune(fortune);
    setEditInitialImpression(reflectionParts.initialImpression);
    setEditDailyReview(reflectionParts.dailyReview);
  };

  const closeEdit = () => {
    setEditingFortune(null);
    setEditInitialImpression('');
    setEditDailyReview('');
  };

  const resetSwipeActions = useCallback(() => {
    setSwipeResetToken(current => current + 1);
  }, []);

  const saveEdit = () => {
    if (!editingFortune) return;
    onUpdateReflection(editingFortune.id, {
      initialImpression: editInitialImpression,
      dailyReview: editDailyReview,
    });
    closeEdit();
  };

  const handleSaveToCardAnnotation = (fortune: DailyFortune) => {
    if (!hasDailyReflectionContent(fortune) || fortune.savedToCardAnnotationAt) return;
    resetSwipeActions();
    setIsExportMenuOpen(false);
    onSaveToCardAnnotation(fortune.id);
  };

  const closeOrganizing = () => {
    resetSwipeActions();
    setIsOrganizing(false);
    setSelectedDeleteIds([]);
    setShowDeleteConfirm(false);
  };

  const handleViewChange = (view: ReviewView) => {
    resetSwipeActions();
    setActiveView(view);
    setExpandedId(null);
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
    setSelectedDeleteIds([fortune.id]);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteFortunes = () => {
    if (selectedDeleteIds.length === 0) return;

    onDeleteFortunes(selectedDeleteIds);
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
    setIsExportMenuOpen(false);
  };

  const handleExportPdf = () => {
    if (exportFortunes.length === 0) return;

    const blob = createExportPdfBlobFromLines(
      buildDailyFortunePdfLines(exportFortunes, '塔罗研习阁｜日运复盘', ownerName)
    );
    const fileBaseName = getDailyReviewFileBaseName(ownerName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileBaseName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    trackEvent('daily_review_exported', {
      format: 'pdf',
      record_count: exportFortunes.length,
      view: activeView,
    });
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
  };

  const renderFortuneList = (items: DailyFortune[]) => (
    items.length === 0 ? (
      <QuietEmptyState
        icon={reviewFilter === 'pending' ? <Clock3 size={23} /> : <Archive size={23} />}
        title={reviewFilter === 'all' ? '这里还没有日运记录' : '没有符合筛选的日运'}
        description={reviewFilter === 'all'
          ? '抽牌或录入现实牌后，就能在这里形成你的日运手札。'
          : '换一个筛选条件，或回到全部记录继续查看。'}
        className="py-8"
      />
    ) : items.map(fortune => (
      <FortuneArchiveItem
        key={fortune.id}
        fortune={fortune}
        expanded={!isOrganizing && expandedId === fortune.id}
        isOrganizing={isOrganizing}
        isSelected={selectedDeleteIds.includes(fortune.id)}
        resetSwipeToken={swipeResetToken}
        onToggle={() => setExpandedId(expandedId === fortune.id ? null : fortune.id)}
        onToggleSelected={() => toggleDeleteSelection(fortune.id)}
        onEdit={openEdit}
        onSaveToCardAnnotation={handleSaveToCardAnnotation}
        onRequestDelete={requestDeleteFortune}
      />
    ))
  );

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[900] flex items-center justify-center bg-[rgba(62,58,54,0.36)] p-2.5 backdrop-blur-[3px] overscroll-contain sm:p-5">
            <motion.div
              role="dialog"
              aria-label="日运复盘"
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.98 }}
              className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.35rem] border border-forest-accent/7 bg-forest-bg shadow-[0_22px_70px_-56px_rgba(62,58,54,0.62)] sm:rounded-[1.55rem]"
            >
              <MysticWatermark variant="sun" className="-right-9 -top-10 h-40 w-40 text-forest-accent opacity-[0.035]" />
              <div className="relative border-b border-forest-accent/7 bg-white/40 p-3 sm:p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-forest-accent">
                      <Archive size={18} />
                      <h3 className="font-serif text-lg font-semibold text-forest-ink sm:text-xl">日运复盘</h3>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                      回看每天的一张牌，把真实生活归入你的牌义体系。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeOrganizing();
                      onClose();
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-forest-muted hover:bg-white/50 hover:text-forest-accent"
                    aria-label="关闭日运复盘"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  {stats.map(([label, value, suffix]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-forest-accent/6 bg-white/26 px-3 py-2.5">
                      <p className="text-[10px] font-medium text-forest-muted">{label}</p>
                      <p className="mt-1 truncate font-serif text-base font-semibold text-forest-accent">
                        {value}
                        <span className="ml-0.5 text-[10px] font-sans text-forest-muted">{suffix}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {([
                    ['timeline', '时间线', Archive],
                    ['cards', '按牌', Library],
                    ['month', '本月', BarChart3],
                  ] as const).map(([view, label, Icon]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => handleViewChange(view)}
                      aria-label={`切换到${label}日运`}
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                        activeView === view
                          ? 'bg-forest-accent/92 text-white'
                          : 'bg-white/40 text-forest-accent hover:bg-white/66'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={toggleOrganizing}
                    aria-pressed={isOrganizing}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                      isOrganizing
                        ? 'bg-red-50 text-red-500 ring-1 ring-red-100'
                        : 'bg-white/40 text-forest-accent hover:bg-white/66'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    {isOrganizing ? '完成整理' : '整理'}
                  </button>
                  {isOrganizing && (
                    <>
                      <button
                        type="button"
                        onClick={selectCurrentList}
                        disabled={currentListFortunes.length === 0}
                        className="flex min-h-11 items-center justify-center rounded-full bg-white/40 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-white/66 disabled:opacity-45"
                      >
                        全选当前
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={selectedDeleteIds.length === 0}
                        aria-label={`删除选中 ${selectedDeleteIds.length} 条日运记录`}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-red-50 px-3 text-xs font-medium text-red-500 transition-colors hover:bg-red-100 disabled:opacity-45"
                      >
                        <Trash2 size={13} />
                        删除选中 {selectedDeleteIds.length > 0 ? selectedDeleteIds.length : ''}
                      </button>
                    </>
                  )}
                </div>

                <div className={`mt-2 grid items-start gap-2 ${
                  isOrganizing ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_auto]'
                }`}>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewFilterOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleReviewFilterChange(option.id)}
                        aria-pressed={reviewFilter === option.id}
                        aria-label={`筛选${option.label}日运记录`}
                        className={`flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                          reviewFilter === option.id
                            ? 'bg-forest-accent/90 text-white'
                            : 'bg-white/36 text-forest-accent hover:bg-white/60'
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          reviewFilter === option.id
                            ? 'bg-white/18 text-white'
                            : 'bg-forest-accent/8 text-forest-muted'
                        }`}>
                          {option.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {!isOrganizing && (
                    <div ref={exportMenuRef} className="relative flex justify-end">
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
                      {isExportMenuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-12 z-10 w-56 rounded-2xl border border-forest-accent/7 bg-white/92 p-2 shadow-[0_16px_42px_-36px_rgba(62,58,54,0.5)] backdrop-blur-md"
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
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3 sm:p-3.5">
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
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setSelectedCardName(null)}
                        className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${
                          !selectedCardName ? 'bg-forest-accent/92 text-white' : 'bg-white/42 text-forest-accent'
                        }`}
                      >
                        全部
                      </button>
                      {cardGroups.map(group => (
                        <button
                          key={group.cardName}
                          type="button"
                          onClick={() => setSelectedCardName(group.cardName)}
                          className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-medium ${
                            selectedCardName === group.cardName ? 'bg-forest-accent/92 text-white' : 'bg-white/42 text-forest-accent'
                          }`}
                        >
                          {group.cardName} ×{group.totalCount}
                        </button>
                      ))}
                    </div>

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
                                      历史 {group.totalCount} 次 · 本月 {group.currentMonthCount} 次
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-forest-accent/10 px-2.5 py-1 text-[10px] font-medium text-forest-accent">
                                    注疏 {group.savedToAnnotationCount}
                                  </span>
                                </div>
                                {latestFortune && (
                                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-forest-text/70">
                                    最近 {latestFortune.date} · {latestPreview}
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
                        {selectedCardGroup && (
                          <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                            <p className="font-serif text-base font-semibold text-forest-ink">{selectedCardGroup.cardName}</p>
                            <p className="mt-1 text-xs text-forest-muted">
                              历史 {selectedCardGroup.totalCount} 次 · 本月 {selectedCardGroup.currentMonthCount} 次 · 已归入注疏 {selectedCardGroup.savedToAnnotationCount} 条
                            </p>
                            {selectedCardGroup.fortunes[0] && (
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-forest-text/70">
                                最近 {selectedCardGroup.fortunes[0].date} · {getFortunePreviewText(selectedCardGroup.fortunes[0])}
                              </p>
                            )}
                          </div>
                        )}
                        {renderFortuneList(cardViewFortunes)}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                      <p className="font-serif text-base font-semibold text-forest-ink">{currentMonthKey} 月度回看</p>
                      <p className="mt-1 text-xs text-forest-muted">本月主题：{monthTopCards.length > 0 ? monthTopCards.map(stat => `${stat.cardName}×${stat.count}`).join(' · ') : '待积累'}</p>
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
                          <p className="mt-1 font-serif text-base font-semibold text-forest-accent">{allMonthFortunes.length}天</p>
                        </div>
                      </div>
                      {monthlyStats.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {monthlyStats.map(stat => (
                            <button
                              key={stat.cardName}
                              type="button"
                              onClick={() => {
                                setActiveView('cards');
                                setSelectedCardName(stat.cardName);
                                setExpandedId(null);
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
                          本月暂时没有符合筛选的日运。
                        </p>
                      )}
                    </div>

                    {allMonthFortunes.length > 0 && (
                      <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                        <p className="font-serif text-base font-semibold text-forest-ink">月末回看提纲</p>
                        <div className="mt-3 space-y-2">
                          {[
                            '哪张牌最像本月反复出现的主题？',
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
                    {renderFortuneList(monthFortunes)}
                  </>
                )}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {editingFortune && (
              <div className="fixed inset-0 z-[960] flex items-center justify-center bg-[rgba(62,58,54,0.42)] p-3 backdrop-blur-[3px] overscroll-contain">
                <motion.div
                  role="dialog"
                  aria-label="补写日运对应"
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[1.25rem] border border-forest-accent/8 bg-[#fffaf4] p-3.5 shadow-[0_20px_60px_-45px_rgba(62,58,54,0.62)] sm:rounded-[1.45rem] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest-accent">补写日运</p>
                      <h3 className="mt-1 font-serif text-lg font-semibold text-forest-ink">
                        {editingFortune.cardName} · {editingFortune.isReversed ? '逆位' : '正位'}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                        先保留第一眼的感受，再温和地回看今天。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-forest-muted hover:bg-white hover:text-forest-accent"
                      aria-label="关闭补写日运对应"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                    <label className="block">
                      <span className="text-xs font-medium text-forest-accent">第一直觉</span>
                      <AutoResizeTextarea
                        minRows={1.5}
                        maxRows={7}
                        value={editInitialImpression}
                        onChange={(event) => setEditInitialImpression(event.target.value)}
                        aria-label="第一直觉"
                        placeholder="刚看到这张牌时，第一眼想到什么？"
                        className="mt-1 w-full rounded-xl border border-forest-accent/12 bg-white/88 p-3 text-[13px] leading-relaxed text-forest-ink outline-none transition-all placeholder:text-forest-muted/70 focus:border-forest-accent/35 focus:ring-2 focus:ring-forest-accent/15 sm:rounded-2xl sm:p-3.5 sm:text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-forest-accent">今日回看</span>
                      <AutoResizeTextarea
                        minRows={1.5}
                        maxRows={7}
                        value={editDailyReview}
                        onChange={(event) => setEditDailyReview(event.target.value)}
                        aria-label="今日回看"
                        placeholder="今天发生了什么？它和这张牌哪里有关系，或暂时没有看见关系？"
                        className="mt-1 w-full rounded-xl border border-forest-accent/12 bg-white/88 p-3 text-[13px] leading-relaxed text-forest-ink outline-none transition-all placeholder:text-forest-muted/70 focus:border-forest-accent/35 focus:ring-2 focus:ring-forest-accent/15 sm:rounded-2xl sm:p-3.5 sm:text-sm"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setEditDailyReview(NO_OBVIOUS_DAILY_MATCH_TEXT)}
                      className="min-h-10 rounded-full bg-forest-accent/10 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-forest-accent/15"
                    >
                      今天暂未看见明显对应
                    </button>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="min-h-11 flex-1 rounded-xl px-4 text-xs font-medium text-forest-muted hover:bg-forest-accent/5 hover:text-forest-ink"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-forest-accent px-4 text-xs font-medium text-white hover:bg-forest-accent/90"
                    >
                      <Save size={14} />
                      保存补写
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <ConfirmDialog
            isOpen={showDeleteConfirm}
            title="删除日运记录"
            message={`确定要删除选中的 ${selectedDeleteIds.length} 条日运记录吗？已归入牌义注疏的内容不会被移除。`}
            confirmText="删除"
            cancelText="取消"
            destructive
            onConfirm={confirmDeleteFortunes}
            onClose={() => setShowDeleteConfirm(false)}
          />
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
};
