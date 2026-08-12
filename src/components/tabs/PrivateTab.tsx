import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Search,
  Table2,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { ReadingKeywordCandidate, TarotReading, TarotCardMetadata } from '../../types';
import { ReadingCard } from '../ReadingCard';
import { TarotCardImage } from '../TarotCardImage';
import { ConfirmDialog } from '../ConfirmDialog';
import { useProgressiveList } from '../../hooks/useProgressiveList';
import { getCardImageUrl, TAROT_CARDS } from '../../constants';
import {
  buildReadingReviewPdfLines,
  exportReadingsToCsv,
  exportReadingsToMarkdown,
} from '../../lib/readingReview';
import { createExportPdfBlobFromLines } from '../../lib/pdfExport';
import { parseReadingManualTags } from '../../lib/readingSubmitPayload';
import { useClickOutside } from '../../hooks/useClickOutside';
import { QuietEmptyState } from '../ui/SoftUI';
import {
  buildReadingArchiveIndex,
  readingMatchesArchiveIndexFilter,
} from '../../lib/readingArchiveIndex';
import { trackEvent } from '../../lib/analytics';
import type { ReadingArchiveIndexFilter } from '../../lib/readingArchiveIndex';

const getReadingSortTime = (reading: TarotReading) => (
  new Date(reading.updatedAt || reading.readingDate || reading.date || 0).getTime()
);

const getReadingManualTags = (reading: TarotReading) => (
  reading.manualTags && reading.manualTags.length > 0
    ? parseReadingManualTags(reading.manualTags)
    : parseReadingManualTags(reading.category)
);

type ArchiveIndexTab = 'card' | 'spread' | 'tag' | 'question';

interface PrivateTabProps {
  readings: TarotReading[];
  ownerName?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchTags: string[];
  onToggleTag: (tag: string) => void;
  onNavigate: (tab: string) => void;
  onTogglePublic: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reading: TarotReading) => void;
  onViewDetails: (reading: TarotReading) => void;
  onAuthorClick: (author: string) => void;
  onProcessAi: (id: string) => void;
  onExtractKeywordCandidates: (id: string) => Promise<ReadingKeywordCandidate[]>;
  onConfirmKeywordCandidates: (id: string, candidates: ReadingKeywordCandidate[]) => void;
  cardMetadata: TarotCardMetadata[];
  highlightedReadingId?: string | null;
}

export const PrivateTab: React.FC<PrivateTabProps> = ({
  readings,
  ownerName = '见习阁主',
  searchQuery,
  setSearchQuery,
  searchTags,
  onToggleTag,
  onNavigate,
  onTogglePublic,
  onDelete,
  onEdit,
  onViewDetails,
  onAuthorClick,
  onProcessAi,
  onExtractKeywordCandidates,
  onConfirmKeywordCandidates,
  cardMetadata,
  highlightedReadingId,
}) => {
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'self' | 'client'>('all');
  const [clientFilter, setClientFilter] = useState('');
  const [readingViewMode, setReadingViewMode] = useState<'grid' | 'list'>('grid');
  const [isReviewFilterOpen, setIsReviewFilterOpen] = useState(false);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [archiveIndexTab, setArchiveIndexTab] = useState<ArchiveIndexTab>('card');
  const [activeIndexFilter, setActiveIndexFilter] = useState<ReadingArchiveIndexFilter | null>(null);
  const [indexQuestionQuery, setIndexQuestionQuery] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);
  const [selectedReadingIds, setSelectedReadingIds] = useState<string[]>([]);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const hasRealReadings = useMemo(() => readings.some(reading => !reading.isExample), [readings]);
  const archiveIndex = useMemo(() => buildReadingArchiveIndex(readings), [readings]);
  const cardLookupByName = useMemo(() => {
    const lookup = new Map<string, TarotCardMetadata>();
    [...TAROT_CARDS, ...cardMetadata].forEach(card => {
      if (card.name) lookup.set(card.name, card);
    });

    return lookup;
  }, [cardMetadata]);

  const clientNames = useMemo(() => (
    Array.from(new Set(
      readings
        .filter(reading => reading.isForClient)
        .map(reading => reading.clientName?.trim() || '未命名客户')
    )).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  ), [readings]);

  const tagOptions = useMemo(() => {
    const groups = new Map<string, number>();
    readings
      .filter(reading => !(hasRealReadings && reading.isExample))
      .forEach(reading => {
        getReadingManualTags(reading).forEach(manualTag => {
          const tag = manualTag.trim();
          if (!tag) return;
          groups.set(tag, (groups.get(tag) || 0) + 1);
        });
      });

    return Array.from(groups.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));
  }, [hasRealReadings, readings]);

  const filteredReadings = useMemo(() => readings.filter(r => {
    if (hasRealReadings && r.isExample) return false;

    const hasFeedback = !!r.userFeedback?.trim();
    if (reviewFilter === 'reviewed' && !hasFeedback) return false;
    if (reviewFilter === 'unreviewed' && hasFeedback) return false;
    if (audienceFilter === 'self' && r.isForClient) return false;
    if (audienceFilter === 'client' && !r.isForClient) return false;
    if (clientFilter) {
      const name = r.clientName?.trim() || '未命名客户';
      if (!r.isForClient || name !== clientFilter) return false;
    }
    if (!readingMatchesArchiveIndexFilter(r, activeIndexFilter)) return false;

    if (!searchQuery && searchTags.length === 0) return true;
    
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q || 
      r.id.toLowerCase().includes(q) ||
      r.question.toLowerCase().includes(q) ||
      r.keywords.some(k => k.toLowerCase().includes(q)) ||
      r.authorName.toLowerCase().includes(q) ||
      (r.clientName || '').toLowerCase().includes(q);
    
    const manualTags = getReadingManualTags(r);
    const matchesTags = searchTags.length === 0 || 
      searchTags.every(tag => manualTags.includes(tag));
    
    return matchesQuery && matchesTags;
  }).sort((a, b) => getReadingSortTime(b) - getReadingSortTime(a)), [readings, hasRealReadings, reviewFilter, audienceFilter, clientFilter, activeIndexFilter, searchQuery, searchTags]);

  const {
    hasMore,
    sentinelRef,
    visibleItems: visibleReadings,
  } = useProgressiveList(filteredReadings);

  const selectableReadings = useMemo(() => (
    filteredReadings.filter(reading => !reading.isExample)
  ), [filteredReadings]);
  const selectedReadings = useMemo(() => (
    selectableReadings.filter(reading => selectedReadingIds.includes(reading.id))
  ), [selectableReadings, selectedReadingIds]);
  const canExport = selectedReadings.length > 0;
  const shouldShowSelectionToolbar = isSelectionMode && selectableReadings.length > 0;
  const allSelectableSelected = selectableReadings.length > 0
    && selectableReadings.every(reading => selectedReadingIds.includes(reading.id));
  const closeFilterMenu = useCallback(() => setIsReviewFilterOpen(false), []);
  const closeExportMenu = useCallback(() => setIsExportMenuOpen(false), []);
  const closeIndexPanel = useCallback(() => setIsIndexOpen(false), []);
  useClickOutside(filterMenuRef, closeFilterMenu, isReviewFilterOpen);
  useClickOutside(exportMenuRef, closeExportMenu, isExportMenuOpen);

  useEffect(() => {
    const availableIds = new Set(selectableReadings.map(reading => reading.id));
    setSelectedReadingIds(prev => prev.filter(id => availableIds.has(id)));
  }, [selectableReadings]);

  useEffect(() => () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
  }, []);

  const getSafeFileNamePart = (value: string) => (
    value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 24) || '见习阁主'
  );

  const getReviewFileBaseName = () => (
    `${getSafeFileNamePart(ownerName)}-典籍复盘-${new Date().toISOString().split('T')[0]}`
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

  const downloadBlobFile = (filename: string, blob: Blob) => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!canExport) return;

    try {
      const blob = createExportPdfBlobFromLines(
        buildReadingReviewPdfLines(selectedReadings, '塔罗研习阁｜典籍复盘', ownerName)
      );
      downloadBlobFile(`${getReviewFileBaseName()}.pdf`, blob);
      setIsExportMenuOpen(false);
      trackEvent('archive_exported', {
        format: 'pdf',
        record_count: selectedReadings.length,
        reviewed_count: selectedReadings.filter(reading => reading.userFeedback?.trim()).length,
      });
    } catch (error) {
      console.warn('Failed to export reading review PDF:', error);
    }
  };

  const handleExportCsv = () => {
    if (!canExport) return;
    downloadTextFile(
      `${getReviewFileBaseName()}.csv`,
      `\ufeff${exportReadingsToCsv(selectedReadings)}`,
      'text/csv;charset=utf-8',
    );
    setIsExportMenuOpen(false);
    trackEvent('archive_exported', {
      format: 'csv',
      record_count: selectedReadings.length,
      reviewed_count: selectedReadings.filter(reading => reading.userFeedback?.trim()).length,
    });
  };

  const handleExportMarkdown = () => {
    if (!canExport) return;
    downloadTextFile(
      `${getReviewFileBaseName()}.md`,
      exportReadingsToMarkdown(selectedReadings, '典籍复盘记录', ownerName),
      'text/markdown;charset=utf-8',
    );
    setIsExportMenuOpen(false);
    trackEvent('archive_exported', {
      format: 'markdown',
      record_count: selectedReadings.length,
      reviewed_count: selectedReadings.filter(reading => reading.userFeedback?.trim()).length,
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setReviewFilter('all');
    setAudienceFilter('all');
    setClientFilter('');
    setActiveIndexFilter(null);
    setIndexQuestionQuery('');
    setIsReviewFilterOpen(false);
    setIsIndexOpen(false);
    setIsExportMenuOpen(false);
    searchTags.forEach(onToggleTag);
  };

  const applyArchiveIndexFilter = (filter: ReadingArchiveIndexFilter) => {
    setActiveIndexFilter(filter);
    setIsIndexOpen(false);
    setIsReviewFilterOpen(false);
    setIsExportMenuOpen(false);
  };

  const applyQuestionIndexFilter = (value: string) => {
    const query = value.trim();
    if (!query) return;
    applyArchiveIndexFilter({
      type: 'question',
      value: query,
      label: `问题包含「${query}」`,
    });
  };

  const formatIndexDate = (time: number) => {
    if (!time) return '暂无日期';
    const date = new Date(time);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const toggleReadingSelection = (id: string) => {
    setIsSelectionMode(true);
    setSelectedReadingIds(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ));
  };

  const enterSelectionMode = () => {
    setIsReviewFilterOpen(false);
    setIsExportMenuOpen(false);
    setIsSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectedReadingIds([]);
    setIsSelectionMode(false);
    setIsExportMenuOpen(false);
    setIsDeleteSelectedConfirmOpen(false);
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedReadingIds([]);
      return;
    }

    setSelectedReadingIds(selectableReadings.map(reading => reading.id));
  };

  const cancelReadingLongPress = () => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const startReadingLongPress = (reading: TarotReading, event: React.PointerEvent<HTMLDivElement>) => {
    if (reading.isExample) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

    cancelReadingLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedReadingIds(prev => (prev.includes(reading.id) ? prev : [...prev, reading.id]));
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(18);
      }
      longPressTimerRef.current = null;
    }, 520);
  };

  const handleSelectionCardClick = (reading: TarotReading, event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectionMode || reading.isExample) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

    event.preventDefault();
    event.stopPropagation();
    toggleReadingSelection(reading.id);
  };

  const handleDeleteSelectedReadings = () => {
    if (selectedReadings.length === 0) return;

    selectedReadings.forEach(reading => onDelete(reading.id));
    exitSelectionMode();
  };

  const reviewFilterOptions = [
    { id: 'all' as const, label: '全部', icon: BookOpen },
    { id: 'reviewed' as const, label: '已复盘', icon: CheckCircle2 },
    { id: 'unreviewed' as const, label: '未复盘', icon: Circle },
  ];
  const activeReviewFilter = reviewFilterOptions.find(option => option.id === reviewFilter) || reviewFilterOptions[0];
  const audienceFilterOptions = [
    { id: 'all' as const, label: '全部记录', icon: BookOpen },
    { id: 'self' as const, label: '给自己', icon: UserRound },
    { id: 'client' as const, label: '客户记录', icon: UsersRound },
  ];
  const activeAudienceFilter = audienceFilterOptions.find(option => option.id === audienceFilter) || audienceFilterOptions[0];
  const archiveIndexTabs = [
    { id: 'card' as const, label: '按牌', count: archiveIndex.cards.length, icon: BookOpen },
    { id: 'spread' as const, label: '牌阵', count: archiveIndex.spreads.length, icon: LayoutGrid },
    { id: 'tag' as const, label: '标签', count: archiveIndex.tags.length, icon: Tag },
    { id: 'question' as const, label: '问题', count: archiveIndex.questions.length, icon: Search },
  ];
  const readingGridClassName = readingViewMode === 'list'
    ? 'space-y-1.5'
    : filteredReadings.length === 1
    ? 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,520px)] md:justify-center'
    : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

  return (
    <motion.div 
      key="private" 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }} 
      className="space-y-3 sm:space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-[1.38rem] font-bold text-forest-accent sm:text-[1.55rem]">
            阁中典籍
            <span className="text-[10px] font-sans font-normal text-forest-muted/70 bg-white/30 px-2 py-0.5 rounded-full ring-1 ring-forest-accent/8">研精覃思，洞见未来</span>
          </h2>
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2">
        <div className="relative group min-w-0 flex-1 basis-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-muted group-focus-within:text-forest-accent transition-colors sm:left-4" size={16} />
          <input 
            type="text" 
            placeholder="搜索记录..."
            className="h-11 w-full rounded-full border border-forest-accent/8 bg-white/46 pl-9 pr-8 text-[13px] transition-all placeholder:text-forest-muted/55 focus:outline-none focus:ring-2 focus:ring-forest-accent/15 sm:h-auto sm:py-3 sm:pl-11 sm:pr-10 sm:text-sm"
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-forest-muted hover:text-forest-accent transition-colors sm:right-3"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex shrink-0 rounded-full border border-forest-accent/8 bg-white/32 p-0.5">
          {([
            { id: 'grid' as const, label: '网格', icon: LayoutGrid },
            { id: 'list' as const, label: '列表', icon: List },
          ]).map(option => {
            const Icon = option.icon;
            const active = readingViewMode === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setReadingViewMode(option.id)}
                aria-pressed={active}
                aria-label={option.label}
                className={`flex h-11 min-w-10 items-center justify-center gap-1 rounded-full px-1.5 text-xs font-medium transition-all sm:min-w-0 sm:px-2.5 ${
                  active
                    ? 'bg-forest-accent/88 text-white'
                    : 'text-forest-muted hover:bg-white/50 hover:text-forest-accent'
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setIsIndexOpen(prev => !prev);
            setIsReviewFilterOpen(false);
            setIsExportMenuOpen(false);
          }}
          aria-label="典籍索引"
          aria-expanded={isIndexOpen}
          className={`flex h-11 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 ${
            isIndexOpen || activeIndexFilter
              ? 'border-forest-accent/35 bg-forest-accent/88 text-white'
              : 'border-forest-accent/8 bg-white/42 text-forest-muted hover:border-forest-accent/20 hover:text-forest-accent'
          }`}
        >
          <Archive size={13} />
          <span className="hidden min-[375px]:inline">索引</span>
        </button>

        <div ref={filterMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsReviewFilterOpen(prev => !prev)}
            className={`flex h-11 items-center gap-1 rounded-full border px-2 text-xs font-medium transition-all sm:gap-1.5 sm:px-4 ${
              reviewFilter === 'all' && audienceFilter === 'all' && !clientFilter
                && searchTags.length === 0
                ? 'bg-white/42 text-forest-muted border-forest-accent/8 hover:text-forest-accent hover:border-forest-accent/20'
                : 'bg-forest-accent/92 text-white border-forest-accent/40'
            }`}
          >
            <Filter size={13} />
            <span className="hidden min-[375px]:inline">筛选</span>
            <span className="hidden sm:inline">
              {activeReviewFilter.label}{audienceFilter !== 'all' ? ` · ${activeAudienceFilter.label}` : ''}
              {searchTags.length > 0 ? ` · 标签${searchTags.length}` : ''}
            </span>
            <ChevronDown size={13} className={`transition-transform ${isReviewFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isReviewFilterOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[min(88vw,360px)] rounded-[1.25rem] border border-forest-accent/7 bg-white/80 p-3 shadow-[0_16px_42px_-36px_rgba(62,58,54,0.5)] backdrop-blur-md">
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-medium tracking-[0.14em] text-forest-muted">复盘状态</p>
                  <div className="flex flex-wrap gap-2">
                    {reviewFilterOptions.map(option => {
                      const Icon = option.icon;
                      const active = reviewFilter === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setReviewFilter(option.id)}
                          className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-forest-accent/88 text-white'
                              : 'bg-white/40 text-forest-accent hover:bg-white/62'
                          }`}
                        >
                          <Icon size={13} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-medium tracking-[0.14em] text-forest-muted">记录类型</p>
                  <div className="flex flex-wrap gap-2">
                    {audienceFilterOptions.map(option => {
                      const Icon = option.icon;
                      const active = audienceFilter === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setAudienceFilter(option.id);
                            if (option.id !== 'client') setClientFilter('');
                          }}
                          className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-forest-accent/88 text-white'
                              : 'bg-white/40 text-forest-accent hover:bg-white/62'
                          }`}
                        >
                          <Icon size={13} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {tagOptions.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium tracking-[0.14em] text-forest-muted">标签复盘</p>
                      {searchTags.length > 0 && (
                        <span className="rounded-full bg-forest-accent/8 px-2 py-0.5 text-[10px] font-normal text-forest-accent">
                          已选 {searchTags.length}
                        </span>
                      )}
                    </div>
                    <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1">
                      {tagOptions.map(({ tag, count }) => {
                        const active = searchTags.includes(tag);

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onToggleTag(tag)}
                            aria-label={active ? `移除标签：${tag}` : `按标签复盘：${tag}`}
                            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] font-medium transition-all ${
                              active
                                ? 'border-forest-accent/35 bg-forest-accent/88 text-white'
                                : 'border-forest-accent/8 bg-white/40 text-forest-muted hover:text-forest-accent'
                            }`}
                          >
                            <Tag size={11} />
                            <span>{tag}</span>
                            <span className={active ? 'text-white/70' : 'text-forest-muted/60'}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {clientNames.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-medium tracking-[0.14em] text-forest-muted">客户</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {clientNames.map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setAudienceFilter('client');
                            setClientFilter(name === clientFilter ? '' : name);
                          }}
                          className={`min-h-9 shrink-0 rounded-full border px-3 text-[10px] font-medium transition-all ${
                            clientFilter === name
                              ? 'border-forest-accent/35 bg-forest-accent/88 text-white'
                              : 'border-forest-accent/8 bg-white/40 text-forest-muted hover:text-forest-accent'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end border-t border-forest-accent/8 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReviewFilterOpen(false)}
                    className="min-h-9 rounded-full bg-white/42 px-4 text-xs font-medium text-forest-accent hover:bg-white/64"
                  >
                    收起筛选
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isSelectionMode && selectableReadings.length > 0 && (
          <button
            type="button"
            onClick={enterSelectionMode}
            className="hidden h-11 shrink-0 items-center gap-1 rounded-full border border-forest-accent/8 bg-white/42 px-3 text-xs font-medium text-forest-muted transition-all hover:border-forest-accent/20 hover:text-forest-accent sm:flex"
          >
            <CheckCircle2 size={13} />
            多选
          </button>
        )}

        {(canExport || isExportMenuOpen) && (
        <div ref={exportMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsExportMenuOpen(prev => !prev)}
            disabled={!canExport}
            className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-forest-accent/8 bg-white/42 px-2 text-xs font-medium text-forest-muted transition-all hover:text-forest-accent disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:px-3"
            aria-expanded={isExportMenuOpen}
          >
            <Download size={13} />
            <span className="hidden sm:inline">导出</span>
            {selectedReadings.length > 0 && <span>{selectedReadings.length}</span>}
            <ChevronDown size={13} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isExportMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-40 rounded-[1.2rem] border border-forest-accent/7 bg-white/82 p-1.5 shadow-[0_16px_42px_-36px_rgba(62,58,54,0.5)] backdrop-blur-md">
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-medium text-forest-muted hover:bg-forest-accent/5 hover:text-forest-accent"
            >
              <Download size={14} />
              导出PDF
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-medium text-forest-muted hover:bg-forest-accent/5 hover:text-forest-accent"
            >
              <Table2 size={14} />
              导出表格
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-medium text-forest-muted hover:bg-forest-accent/5 hover:text-forest-accent"
            >
              <FileText size={14} />
              Markdown 手札
            </button>
            </div>
          )}
        </div>
        )}
      </div>

      {isIndexOpen && (
        <>
          <button
            type="button"
            aria-label="关闭典籍索引"
            className="fixed inset-0 z-40 bg-forest-ink/5 sm:bg-forest-ink/10"
            onClick={closeIndexPanel}
          />
          <motion.aside
            role="dialog"
            aria-label="典籍索引"
            initial={{ opacity: 0, y: 18, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 18, x: 0 }}
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 max-h-[72vh] overflow-hidden rounded-[1.4rem] border border-forest-accent/10 bg-[#fffdf8]/92 shadow-[0_18px_54px_-36px_rgba(62,58,54,0.62)] backdrop-blur-xl sm:inset-y-4 sm:left-auto sm:right-4 sm:w-[420px] sm:max-h-[calc(100vh-2rem)] sm:rounded-[1.5rem]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-forest-accent/8 px-4 py-3">
              <div>
                <p className="font-serif text-lg font-bold text-forest-accent">典籍索引</p>
                <p className="mt-0.5 text-[11px] text-forest-muted">按牌、牌阵、标签或问题找回手记。</p>
              </div>
              <button
                type="button"
                onClick={closeIndexPanel}
                className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-forest-muted transition-colors hover:bg-forest-accent/6 hover:text-forest-accent"
                aria-label="收起典籍索引"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-4 gap-1.5 rounded-full border border-forest-accent/8 bg-white/36 p-1">
                {archiveIndexTabs.map(tab => {
                  const Icon = tab.icon;
                  const active = archiveIndexTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setArchiveIndexTab(tab.id)}
                      aria-label={tab.label}
                      className={`flex min-h-10 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-medium transition-all ${
                        active
                          ? 'bg-forest-accent/88 text-white'
                          : 'text-forest-muted hover:bg-white/60 hover:text-forest-accent'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{tab.label}</span>
                      <span
                        aria-hidden="true"
                        className={`rounded-full px-1.5 py-0.5 text-[9px] leading-none ${
                          active ? 'bg-white/20 text-white' : 'bg-forest-accent/7 text-forest-muted'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {archiveIndexTab === 'card' && (
                <div className="space-y-2">
                  {archiveIndex.cards.length === 0 ? (
                    <p className="rounded-2xl bg-white/34 px-3 py-4 text-center text-xs text-forest-muted">还没有可索引的牌面记录。</p>
                  ) : archiveIndex.cards.map(item => {
                    const card = cardLookupByName.get(item.cardName);

                    return (
                      <button
                        key={item.cardName}
                        type="button"
                        onClick={() => applyArchiveIndexFilter({
                          type: 'card',
                          value: item.cardName,
                          label: `${item.cardName}出现过的记录`,
                        })}
                        aria-label={`按牌索引：${item.cardName}`}
                        className="flex min-h-[4.25rem] w-full items-center justify-between gap-3 rounded-2xl border border-forest-accent/8 bg-white/34 px-3 py-2 text-left transition-all hover:border-forest-accent/18 hover:bg-white/58"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-forest-accent/10 bg-forest-bg/70 shadow-inner">
                            {card ? (
                              <TarotCardImage
                                src={getCardImageUrl(card.id)}
                                alt={item.cardName}
                                name={item.cardName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <BookOpen size={16} className="text-forest-accent/55" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-forest-ink">{item.cardName}</p>
                            <p className="mt-0.5 text-[11px] text-forest-muted">
                              正 {item.uprightCount} · 逆 {item.reversedCount} · 已复盘 {item.reviewedCount}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-forest-muted/75">
                              最近：{item.latestQuestion}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium text-forest-accent">{item.count} 次</p>
                          <p className="text-[10px] text-forest-muted">{formatIndexDate(item.lastSeenAt)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {archiveIndexTab === 'spread' && (
                <div className="space-y-2">
                  {archiveIndex.spreads.length === 0 ? (
                    <p className="rounded-2xl bg-white/34 px-3 py-4 text-center text-xs text-forest-muted">还没有可索引的牌阵记录。</p>
                  ) : archiveIndex.spreads.map(item => (
                    <button
                      key={item.spread}
                      type="button"
                      onClick={() => applyArchiveIndexFilter({
                        type: 'spread',
                        value: item.spread,
                        label: `${item.spread}记录`,
                      })}
                      aria-label={`按牌阵索引：${item.spread}`}
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-forest-accent/8 bg-white/34 px-3 py-2 text-left transition-all hover:border-forest-accent/18 hover:bg-white/58"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-forest-ink">{item.spread}</p>
                        <p className="mt-0.5 text-[11px] text-forest-muted">已复盘 {item.reviewedCount} 条</p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-forest-muted/75">
                          最近：{item.latestQuestion}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-forest-accent">{item.count} 条</p>
                        <p className="text-[10px] text-forest-muted">{formatIndexDate(item.lastSeenAt)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {archiveIndexTab === 'tag' && (
                <div className="space-y-2">
                  {archiveIndex.tags.length === 0 ? (
                    <p className="rounded-2xl bg-white/34 px-3 py-4 text-center text-xs text-forest-muted">还没有用户标签。记录时添加标签，之后就能从这里复盘。</p>
                  ) : archiveIndex.tags.map(item => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => applyArchiveIndexFilter({
                        type: 'tag',
                        value: item.tag,
                        label: `标签「${item.tag}」`,
                      })}
                      aria-label={`按标签索引：${item.tag}`}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-forest-accent/8 bg-white/34 px-3 py-2 text-left transition-all hover:border-forest-accent/18 hover:bg-white/58"
                    >
                      <span className="flex min-w-0 items-start gap-2">
                        <Tag size={13} className="mt-0.5 shrink-0 text-forest-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-forest-ink">{item.tag}</span>
                          <span className="mt-0.5 line-clamp-1 text-[10px] text-forest-muted/75">
                            最近：{item.latestQuestion}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] text-forest-muted">
                        {item.count} 条<br />
                        复盘 {item.reviewedCount}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {archiveIndexTab === 'question' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-forest-accent/8 bg-white/34 p-2">
                    <div className="flex items-center gap-2">
                      <Search size={14} className="ml-1 shrink-0 text-forest-muted" />
                      <input
                        type="text"
                        value={indexQuestionQuery}
                        onChange={event => setIndexQuestionQuery(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') applyQuestionIndexFilter(indexQuestionQuery);
                        }}
                        placeholder="输入问题关键词..."
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm text-forest-ink placeholder:text-forest-muted/55 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => applyQuestionIndexFilter(indexQuestionQuery)}
                        disabled={!indexQuestionQuery.trim()}
                        className="min-h-10 rounded-full bg-forest-accent/88 px-3 text-xs font-medium text-white transition-all hover:bg-forest-accent disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        查看
                      </button>
                    </div>
                  </div>
                  {archiveIndex.questions.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-medium tracking-[0.14em] text-forest-muted">最近问题</p>
                      <div className="space-y-2">
                        {archiveIndex.questions.map(item => (
                          <button
                            key={`${item.question}-${item.lastSeenAt}`}
                            type="button"
                            onClick={() => applyQuestionIndexFilter(item.question)}
                            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-forest-accent/8 bg-white/34 px-3 py-2 text-left transition-all hover:border-forest-accent/18 hover:bg-white/58"
                          >
                            <span className="line-clamp-2 text-xs font-medium text-forest-ink">{item.question}</span>
                            <span className="shrink-0 text-[10px] text-forest-muted">{formatIndexDate(item.lastSeenAt)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}

      {(searchQuery || searchTags.length > 0 || reviewFilter !== 'all' || audienceFilter !== 'all' || clientFilter || activeIndexFilter) && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span className="text-[10px] text-forest-muted">{activeIndexFilter ? '正在查看:' : '正在筛选:'}</span>
          {activeIndexFilter && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              {activeIndexFilter.label}
              <X size={10} className="cursor-pointer" onClick={() => setActiveIndexFilter(null)} />
            </span>
          )}
          {searchQuery && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              关键词: {searchQuery}
              <X size={10} className="cursor-pointer" onClick={() => setSearchQuery('')} />
            </span>
          )}
          {searchTags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-forest-accent/90 text-white rounded-full text-[10px] font-medium flex items-center gap-1">
              标签: {tag}
              <X size={10} className="cursor-pointer" onClick={() => onToggleTag(tag)} />
            </span>
          ))}
          {reviewFilter !== 'all' && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              复盘: {reviewFilter === 'reviewed' ? '已复盘' : '未复盘'}
              <X size={10} className="cursor-pointer" onClick={() => setReviewFilter('all')} />
            </span>
          )}
          {audienceFilter !== 'all' && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              类型: {audienceFilter === 'self' ? '给自己' : '客户记录'}
              <X size={10} className="cursor-pointer" onClick={() => {
                setAudienceFilter('all');
                setClientFilter('');
              }} />
            </span>
          )}
          {clientFilter && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              客户: {clientFilter}
              <X size={10} className="cursor-pointer" onClick={() => setClientFilter('')} />
            </span>
          )}
          <button 
            onClick={handleClearFilters}
            className="text-[10px] text-forest-muted hover:text-forest-accent underline ml-auto"
          >
            清除全部
          </button>
        </div>
      )}

      {shouldShowSelectionToolbar && (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-forest-accent/7 bg-white/18 px-2.5 py-2 text-[10px] font-normal text-forest-muted">
          <span className="rounded-full bg-white/42 px-2.5 py-1">
            已选 {selectedReadings.length} / 当前 {selectableReadings.length}
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="min-h-8 rounded-full bg-forest-accent/8 px-3 text-forest-accent hover:bg-forest-accent/12"
          >
            {allSelectableSelected ? '取消全选' : '全选当前'}
          </button>
          {selectedReadings.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedReadingIds([])}
              className="min-h-8 rounded-full bg-white/42 px-3 text-forest-muted hover:text-forest-accent"
            >
              清空选择
            </button>
          )}
          {selectedReadings.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDeleteSelectedConfirmOpen(true)}
              className="flex min-h-8 items-center gap-1 rounded-full bg-red-50/80 px-3 text-red-500 hover:bg-red-50"
            >
              <Trash2 size={12} />
              删除所选
            </button>
          )}
          <button
            type="button"
            onClick={exitSelectionMode}
            className="min-h-8 rounded-full bg-white/42 px-3 text-forest-muted hover:text-forest-accent"
          >
            完成
          </button>
          <span className="text-forest-muted/70">长按记录进入多选，可批量导出。</span>
        </div>
      )}

      {filteredReadings.length === 0 ? (
        <QuietEmptyState
          icon={<BookOpen size={24} />}
          title="暂时没有匹配的手记"
          description="换个筛选，或写下第一条可回看的记录。"
          action={(
            <button
              onClick={() => { onNavigate('add'); handleClearFilters(); }}
              className="min-h-10 rounded-full bg-forest-accent/88 px-5 text-xs font-medium text-white transition-all hover:bg-forest-accent"
            >
              写第一条手记
            </button>
          )}
          className="sm:py-12"
        />
      ) : (
        <div className={readingGridClassName}>
          {visibleReadings.map(reading => {
            const isSelectable = !reading.isExample;
            const isSelected = selectedReadingIds.includes(reading.id);

            return (
              <div
                key={reading.id}
                data-reading-selection-target={isSelectable ? 'true' : undefined}
                onPointerDown={event => startReadingLongPress(reading, event)}
                onPointerUp={cancelReadingLongPress}
                onPointerLeave={cancelReadingLongPress}
                onPointerCancel={cancelReadingLongPress}
                onClickCapture={event => handleSelectionCardClick(reading, event)}
                className={`relative transition-all ${
                  isSelected ? 'ring-2 ring-forest-accent/25 ring-offset-2 ring-offset-forest-bg' : ''
                }`}
              >
                {isSelectable && isSelectionMode && (
                  <button
                    type="button"
                    onClick={() => toggleReadingSelection(reading.id)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? '取消选择' : '选择'}记录：${reading.question || '未命名问题'}`}
                    className={`absolute z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? 'border-forest-accent/40 bg-forest-accent/92 text-white'
                        : 'border-forest-accent/8 bg-white/62 text-forest-muted hover:text-forest-accent'
                    } ${readingViewMode === 'list' ? 'left-1.5 top-1.5' : 'left-3 top-3'}`}
                  >
                    {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                )}
                <ReadingCard
                  reading={reading}
                  onTogglePublic={() => onTogglePublic(reading.id)}
                  onEdit={() => onEdit(reading)}
                  onViewDetails={() => onViewDetails(reading)}
                  onTagClick={onToggleTag}
                  activeTags={searchTags}
                  cardMetadata={cardMetadata}
                  onAuthorClick={onAuthorClick}
                  onProcessAi={onProcessAi}
                  onExtractKeywordCandidates={onExtractKeywordCandidates}
                  onConfirmKeywordCandidates={onConfirmKeywordCandidates}
                  isHighlighted={reading.id === highlightedReadingId}
                  variant={readingViewMode === 'list' ? 'list' : 'card'}
                  hideDeleteAction
                />
              </div>
            );
          })}
          <div ref={sentinelRef} className="col-span-full h-1" aria-hidden />
        </div>
      )}
      {hasMore && (
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-white/24 px-3 py-1 text-[10px] font-medium text-forest-muted">
            正在继续展开典籍…
          </span>
        </div>
      )}

      <ConfirmDialog
        isOpen={isDeleteSelectedConfirmOpen}
        title="删除所选手记"
        message={`确定删除选中的 ${selectedReadings.length} 条手记吗？此操作会同时移出阁中典籍。`}
        confirmText="删除"
        destructive
        onConfirm={handleDeleteSelectedReadings}
        onClose={() => setIsDeleteSelectedConfirmOpen(false)}
      />

    </motion.div>
  );
};
