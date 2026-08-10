import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  Library,
  PenLine,
  Save,
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

interface DailyFortuneArchiveModalProps {
  fortunes: DailyFortune[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateReflection: (id: string, reflection: string | DailyFortuneReflectionParts) => void;
  onSaveToCardAnnotation: (id: string, note?: string) => void;
  ownerName?: string;
}

type ReviewView = 'timeline' | 'cards' | 'month';

const getCardData = (cardName: string) => TAROT_CARDS.find(card => card.name === cardName);

const getSourceLabel = (source?: DailyFortune['source']) => (
  source === 'physical-draw' ? '现实抽牌' : '系统抽牌'
);

const getDirectionLabel = (fortune: DailyFortune) => (fortune.isReversed ? '逆位' : '正位');

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
  onToggle: () => void;
  onEdit: (fortune: DailyFortune) => void;
  onSaveToCardAnnotation: (fortune: DailyFortune) => void;
}

const FortuneArchiveItem = ({
  fortune,
  expanded,
  onToggle,
  onEdit,
  onSaveToCardAnnotation,
}: FortuneArchiveItemProps) => {
  const card = getCardData(fortune.cardName);
  const canSaveToAnnotation = hasDailyReflectionContent(fortune);
  const isSavedToAnnotation = Boolean(fortune.savedToCardAnnotationAt);

  return (
    <div className="overflow-hidden rounded-[1.45rem] border border-forest-accent/8 bg-white/44 shadow-none">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
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
        {expanded && (
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
    </div>
  );
};

export const DailyFortuneArchiveModal: React.FC<DailyFortuneArchiveModalProps> = ({
  fortunes,
  isOpen,
  onClose,
  onUpdateReflection,
  onSaveToCardAnnotation,
  ownerName = '见习阁主',
}) => {
  useBodyScrollLock(isOpen);

  const [activeView, setActiveView] = useState<ReviewView>('timeline');
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(fortunes[0]?.id || null);
  const [editingFortune, setEditingFortune] = useState<DailyFortune | null>(null);
  const [editInitialImpression, setEditInitialImpression] = useState('');
  const [editDailyReview, setEditDailyReview] = useState('');
  const [showMoreExportFormats, setShowMoreExportFormats] = useState(false);
  const moreExportFormatsRef = useRef<HTMLDivElement | null>(null);
  const closeMoreExportFormats = useCallback(() => setShowMoreExportFormats(false), []);
  useClickOutside(moreExportFormatsRef, closeMoreExportFormats, showMoreExportFormats);

  const currentMonthKey = getCurrentMonthKey();
  const monthFortunes = useMemo(
    () => getFortunesForMonth(fortunes, currentMonthKey),
    [currentMonthKey, fortunes],
  );
  const cardGroups = useMemo(
    () => getDailyFortunesByCard(fortunes, currentMonthKey),
    [currentMonthKey, fortunes],
  );
  const monthlyStats = useMemo(
    () => getDailyFortuneMonthlyCardStats(fortunes, currentMonthKey),
    [currentMonthKey, fortunes],
  );

  const selectedCardGroup = cardGroups.find(group => group.cardName === selectedCardName) || null;
  const cardViewFortunes = selectedCardGroup?.fortunes || fortunes;
  const exportFortunes = activeView === 'month'
    ? monthFortunes
    : activeView === 'cards'
      ? cardViewFortunes
      : fortunes;

  const topCard = monthlyStats[0]?.cardName || cardGroups[0]?.cardName || '待积累';
  const savedCount = fortunes.filter(fortune => Boolean(fortune.savedToCardAnnotationAt)).length;

  const stats = useMemo(() => ([
    ['已归档', fortunes.length, '天'],
    ['本月', monthFortunes.length, '天'],
    ['常见牌', topCard, ''],
    ['入注疏', savedCount, '条'],
  ]), [fortunes.length, monthFortunes.length, savedCount, topCard]);

  const openEdit = (fortune: DailyFortune) => {
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
    onSaveToCardAnnotation(fortune.id);
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
    setShowMoreExportFormats(false);
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
  };

  const renderFortuneList = (items: DailyFortune[]) => (
    items.length === 0 ? (
      <QuietEmptyState
        icon={<Archive size={23} />}
        title="这里还没有日运记录"
        description="抽牌或录入现实牌后，就能在这里形成你的日运手札。"
        className="py-8"
      />
    ) : items.map(fortune => (
      <FortuneArchiveItem
        key={fortune.id}
        fortune={fortune}
        expanded={expandedId === fortune.id}
        onToggle={() => setExpandedId(expandedId === fortune.id ? null : fortune.id)}
        onEdit={openEdit}
        onSaveToCardAnnotation={handleSaveToCardAnnotation}
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
                    onClick={onClose}
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
                      onClick={() => setActiveView(view)}
                      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                        activeView === view
                          ? 'bg-forest-accent/92 text-white'
                          : 'bg-white/40 text-forest-accent hover:bg-white/66'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                  <div ref={moreExportFormatsRef} className="relative flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={exportFortunes.length === 0}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-forest-accent/88 px-3 text-xs font-medium text-white hover:bg-forest-accent disabled:opacity-45 sm:flex-none"
                    >
                      <Download size={13} />
                      导出PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      disabled={exportFortunes.length === 0}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-forest-pink/10 px-3 text-xs font-medium text-forest-pink hover:bg-forest-pink/15 disabled:opacity-45 sm:flex-none"
                    >
                      <BarChart3 size={13} />
                      导出表格
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMoreExportFormats(prev => !prev)}
                      disabled={exportFortunes.length === 0}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/36 px-3 text-xs font-medium text-forest-accent hover:bg-white/60 disabled:opacity-45 sm:flex-none"
                    >
                      更多格式
                    </button>
                    {showMoreExportFormats && (
                      <div className="w-full rounded-2xl border border-forest-accent/7 bg-white/88 p-2 shadow-[0_16px_42px_-36px_rgba(62,58,54,0.5)] backdrop-blur-md sm:absolute sm:right-0 sm:top-12 sm:z-10 sm:w-56">
                        <button
                          type="button"
                          onClick={handleExportMarkdown}
                          className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-medium text-forest-ink hover:bg-forest-bg"
                        >
                          <span>
                            Markdown 手札
                            <span className="mt-0.5 block text-[10px] font-normal text-forest-muted">
                              适合 Notion / Obsidian 留存
                            </span>
                          </span>
                          <Download size={13} className="text-forest-accent" />
                        </button>
                      </div>
                    )}
                  </div>
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
                  renderFortuneList(fortunes)
                ) : activeView === 'cards' ? (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setSelectedCardName(null)}
                        className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-medium ${
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
                          className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-medium ${
                            selectedCardName === group.cardName ? 'bg-forest-accent/92 text-white' : 'bg-white/42 text-forest-accent'
                          }`}
                        >
                          {group.cardName} ×{group.totalCount}
                        </button>
                      ))}
                    </div>

                    {!selectedCardName ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {cardGroups.map(group => (
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
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <span className="rounded-2xl bg-white/34 px-3 py-2 text-[11px] text-forest-muted">
                                正位 {group.uprightCount}
                              </span>
                              <span className="rounded-2xl bg-forest-pink/10 px-3 py-2 text-[11px] text-forest-muted">
                                逆位 {group.reversedCount}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        {selectedCardGroup && (
                          <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                            <p className="font-serif text-base font-semibold text-forest-ink">{selectedCardGroup.cardName}</p>
                            <p className="mt-1 text-xs text-forest-muted">
                              历史 {selectedCardGroup.totalCount} 次 · 本月 {selectedCardGroup.currentMonthCount} 次 · 已归入注疏 {selectedCardGroup.savedToAnnotationCount} 条
                            </p>
                          </div>
                        )}
                        {renderFortuneList(cardViewFortunes)}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-[1.25rem] border border-forest-accent/7 bg-white/32 p-3">
                      <p className="font-serif text-base font-semibold text-forest-ink">{currentMonthKey} 日运牌频</p>
                      <p className="mt-1 text-xs text-forest-muted">本月出现过的牌会按次数排序，点牌名可查看它的历史日运。</p>
                      {monthlyStats.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {monthlyStats.map(stat => (
                            <button
                              key={stat.cardName}
                              type="button"
                              onClick={() => {
                                setActiveView('cards');
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
                          本月暂时没有归档日运。
                        </p>
                      )}
                    </div>
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
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
};
