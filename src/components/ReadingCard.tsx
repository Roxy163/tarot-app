import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RefreshCw, Share2, ChevronDown, ChevronUp, PencilLine, Trash2, Lock, Sparkles, Check, Loader2, CheckCircle2, Eye, Clock3 } from 'lucide-react';
import { ReadingKeywordCandidate, TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl, LAYOUT_TEMPLATES } from '../constants';
import { ConfirmDialog } from './ConfirmDialog';
import { TarotCardImage } from './TarotCardImage';
import { formatReadingDateTime } from '../lib/dateFormat';
import {
  FREE_LAYOUT_CANVAS_HEIGHT,
  FREE_LAYOUT_CANVAS_WIDTH,
  getFreeLayoutDisplayFrame,
  FREE_LAYOUT_SLOT_HEIGHT,
  FREE_LAYOUT_SLOT_WIDTH,
} from '../lib/freeLayout';

const getGridNumber = (position: string, type: 'col' | 'row') => {
  const pattern = type === 'col' ? /col-start-(\d+)/ : /row-start-(\d+)/;
  const match = position.match(pattern);
  return match ? Number(match[1]) : 1;
};

const yearlyPreviewPositions = [
  { x: 8, y: 49 },
  { x: 18, y: 67 },
  { x: 34, y: 79 },
  { x: 50, y: 83 },
  { x: 66, y: 79 },
  { x: 82, y: 67 },
  { x: 92, y: 49 },
  { x: 82, y: 31 },
  { x: 66, y: 19 },
  { x: 50, y: 15 },
  { x: 34, y: 19 },
  { x: 18, y: 31 },
  { x: 50, y: 49 },
];

const celticPreviewPositions = [
  { x: 36, y: 47 },
  { x: 36, y: 47 },
  { x: 36, y: 73 },
  { x: 14, y: 47 },
  { x: 36, y: 21 },
  { x: 58, y: 47 },
  { x: 84, y: 78 },
  { x: 84, y: 58 },
  { x: 84, y: 38 },
  { x: 84, y: 18 },
];

interface ReadingCardProps {
  reading: TarotReading;
  cardMetadata: TarotCardMetadata[];
  onEdit?: () => void;
  onTagClick?: (tag: string) => void;
  activeTags?: string[];
  onAuthorClick?: (author: string) => void;
  onProcessAi?: (id: string) => void;
  onExtractKeywordCandidates?: (id: string) => Promise<ReadingKeywordCandidate[]>;
  onConfirmKeywordCandidates?: (id: string, candidates: ReadingKeywordCandidate[]) => void;
  isMini?: boolean;
  onTogglePublic?: () => void;
  isPublicView?: boolean;
  onDelete?: () => void;
  onViewDetails?: () => void;
  isHighlighted?: boolean;
  variant?: 'card' | 'list';
  hideDeleteAction?: boolean;
}

export const ReadingCard: React.FC<ReadingCardProps> = ({
  reading,
  onEdit,
  onTagClick,
  onAuthorClick,
  onExtractKeywordCandidates,
  onConfirmKeywordCandidates,
  isMini = false,
  onTogglePublic,
  isPublicView = false,
  onDelete,
  onViewDetails,
  isHighlighted = false,
  variant = 'card',
  hideDeleteAction = false,
}) => {
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [keywordCandidates, setKeywordCandidates] = useState<ReadingKeywordCandidate[]>([]);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [showKeywordReview, setShowKeywordReview] = useState(false);
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  const [keywordNotice, setKeywordNotice] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [mobilePreviewScale, setMobilePreviewScale] = useState(1);
  const [mobilePreviewPosition, setMobilePreviewPosition] = useState({ x: 0, y: 0 });
  const lastPosition = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchAnchor = useRef<{ x: number; y: number } | null>(null);
  const mobilePreviewScaleRef = useRef(1);
  const mobilePreviewTouchDistance = useRef<number | null>(null);
  const mobilePreviewTouchAnchor = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isListView = variant === 'list';

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setPreviewWidth(element.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.target instanceof HTMLDivElement && !e.target.classList.contains('card-zoom-handler')) {
      setIsDragging(true);
      lastPosition.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - lastPosition.current.x,
        y: e.clientY - lastPosition.current.y
      });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveDom = (e: MouseEvent) => handleMouseMove(e as unknown as React.MouseEvent);
      const handleMouseUpDom = () => handleMouseUp();
      document.addEventListener('mousemove', handleMouseMoveDom);
      document.addEventListener('mouseup', handleMouseUpDom);
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveDom);
        document.removeEventListener('mouseup', handleMouseUpDom);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSelectedCardIdx(null);
  };

  const clampScale = (value: number) => Math.min(Math.max(value, 0.5), 2);
  const clampMobilePreviewScale = (value: number) => Math.min(Math.max(value, 1), 2.8);
  const clampMobilePreviewPosition = (nextPosition: { x: number; y: number }, nextScale: number) => {
    const xLimit = Math.max(0, (nextScale - 1) * 34);
    const yLimit = Math.max(0, (nextScale - 1) * 22);

    return {
      x: Math.min(xLimit, Math.max(-xLimit, nextPosition.x)),
      y: Math.min(yLimit, Math.max(-yLimit, nextPosition.y)),
    };
  };

  const getTouchDistance = (touches: React.TouchList) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  const getTouchCenter = (touches: React.TouchList) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const center = getTouchCenter(event.touches);
      lastTouchDistance.current = getTouchDistance(event.touches);
      lastTouchAnchor.current = {
        x: center.x - position.x,
        y: center.y - position.y,
      };
      return;
    }

    if (event.touches.length === 1 && scale > 1) {
      event.preventDefault();
      lastTouchDistance.current = null;
      lastTouchAnchor.current = {
        x: event.touches[0].clientX - position.x,
        y: event.touches[0].clientY - position.y,
      };
    }
  }, [position.x, position.y, scale]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      event.stopPropagation();
      const currentDistance = getTouchDistance(event.touches);
      const previousDistance = lastTouchDistance.current || currentDistance;
      const center = getTouchCenter(event.touches);
      lastTouchDistance.current = currentDistance;

      setScale(prev => clampScale(prev * (currentDistance / Math.max(1, previousDistance))));
      if (lastTouchAnchor.current) {
        setPosition({
          x: center.x - lastTouchAnchor.current.x,
          y: center.y - lastTouchAnchor.current.y,
        });
      }
      return;
    }

    if (event.touches.length === 1 && scale > 1 && lastTouchAnchor.current) {
      event.preventDefault();
      event.stopPropagation();
      setPosition({
        x: event.touches[0].clientX - lastTouchAnchor.current.x,
        y: event.touches[0].clientY - lastTouchAnchor.current.y,
      });
    }
  }, [scale]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    lastTouchAnchor.current = null;
  }, []);

  const handleMobilePreviewTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (event.touches.length === 2) {
      event.preventDefault();
      const center = getTouchCenter(event.touches);
      mobilePreviewTouchDistance.current = getTouchDistance(event.touches);
      mobilePreviewTouchAnchor.current = {
        x: center.x - mobilePreviewPosition.x,
        y: center.y - mobilePreviewPosition.y,
      };
      return;
    }

    if (event.touches.length === 1 && mobilePreviewScaleRef.current > 1) {
      event.preventDefault();
      mobilePreviewTouchDistance.current = null;
      mobilePreviewTouchAnchor.current = {
        x: event.touches[0].clientX - mobilePreviewPosition.x,
        y: event.touches[0].clientY - mobilePreviewPosition.y,
      };
    }
  }, [mobilePreviewPosition.x, mobilePreviewPosition.y]);

  const handleMobilePreviewTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (event.touches.length === 2) {
      event.preventDefault();
      const currentDistance = getTouchDistance(event.touches);
      const previousDistance = mobilePreviewTouchDistance.current || currentDistance;
      const center = getTouchCenter(event.touches);
      const nextScale = clampMobilePreviewScale(mobilePreviewScaleRef.current * (currentDistance / Math.max(1, previousDistance)));

      mobilePreviewTouchDistance.current = currentDistance;
      mobilePreviewScaleRef.current = nextScale;
      setMobilePreviewScale(nextScale);

      if (mobilePreviewTouchAnchor.current) {
        setMobilePreviewPosition(clampMobilePreviewPosition({
          x: center.x - mobilePreviewTouchAnchor.current.x,
          y: center.y - mobilePreviewTouchAnchor.current.y,
        }, nextScale));
      }
      return;
    }

    if (event.touches.length === 1 && mobilePreviewScaleRef.current > 1 && mobilePreviewTouchAnchor.current) {
      event.preventDefault();
      setMobilePreviewPosition(clampMobilePreviewPosition({
        x: event.touches[0].clientX - mobilePreviewTouchAnchor.current.x,
        y: event.touches[0].clientY - mobilePreviewTouchAnchor.current.y,
      }, mobilePreviewScaleRef.current));
    }
  }, []);

  const handleMobilePreviewTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    mobilePreviewTouchDistance.current = null;

    if (event.touches.length === 1 && mobilePreviewScaleRef.current > 1) {
      mobilePreviewTouchAnchor.current = {
        x: event.touches[0].clientX - mobilePreviewPosition.x,
        y: event.touches[0].clientY - mobilePreviewPosition.y,
      };
      return;
    }

    mobilePreviewTouchAnchor.current = null;
    if (mobilePreviewScaleRef.current <= 1.04) {
      mobilePreviewScaleRef.current = 1;
      setMobilePreviewScale(1);
      setMobilePreviewPosition({ x: 0, y: 0 });
    }
  }, [mobilePreviewPosition.x, mobilePreviewPosition.y]);

  const handleMobileCardOpen = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onViewDetails) return;
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;
    onViewDetails();
  }, [onViewDetails]);

  const zoomFromWheelDelta = useCallback((deltaY: number) => {
    const delta = deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => clampScale(prev + delta));
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      zoomFromWheelDelta(event.deltaY);
    };

    element.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => element.removeEventListener('wheel', handleWheelZoom);
  }, [zoomFromWheelDelta]);

  const canReviewKeywords = !isPublicView && !reading.isExample && !!onExtractKeywordCandidates && !!onConfirmKeywordCandidates;
  const hasFeedback = !!reading.userFeedback?.trim();
  const displayAuthorName = reading.isAnonymous ? '匿名研习者' : reading.authorName;
  const clientDisplayName = reading.clientName?.trim() || '未命名客户';
  const displayDate = formatReadingDateTime(reading.readingDate || reading.date);
  const cardInterpretationRows = (reading.cards || [])
    .map((card, index) => ({
      card,
      label: reading.slotLabels?.[index] || `第 ${index + 1} 张`,
      text: reading.cardInterpretations?.[index]?.trim() || '',
    }))
    .filter(item => item.text);
  const hasCardInterpretationRows = cardInterpretationRows.length > 0;
  const legacySingleCardText = reading.interpretation?.singleCard?.trim();
  const overviewText = (
    reading.interpretation?.combination?.trim() ||
    reading.interpretation?.summary?.trim() ||
    legacySingleCardText ||
    ''
  );
  const influenceNotes = [
    { label: '灵数影响', value: reading.interpretation?.numerologyInfluence },
    { label: '行星星座影响', value: reading.interpretation?.astrologyInfluence },
    { label: '宫位影响', value: reading.interpretation?.houseInfluence },
    { label: '元素影响', value: reading.interpretation?.elementInfluence },
  ].filter(item => item.value?.trim());

  const groupedKeywordCandidates = keywordCandidates.reduce<Record<string, ReadingKeywordCandidate[]>>((groups, candidate) => {
    if (!groups[candidate.cardName]) groups[candidate.cardName] = [];
    groups[candidate.cardName].push(candidate);
    return groups;
  }, {});

  const handleExtractKeywords = async () => {
    if (!onExtractKeywordCandidates) return;

    setIsExtractingKeywords(true);
    setKeywordNotice('');
    try {
      const candidates = await onExtractKeywordCandidates(reading.id);
      setKeywordCandidates(candidates);
      setSelectedKeywordIds(candidates.map(candidate => candidate.id));
      setShowKeywordReview(true);
      if (candidates.length === 0) {
        setKeywordNotice('这条手记里暂时没有提取到可保存的关键词。');
      }
    } catch (error) {
      console.error('Failed to extract keyword candidates:', error);
      setKeywordNotice('关键词整理暂时失败，可以稍后再试。');
    } finally {
      setIsExtractingKeywords(false);
    }
  };

  const toggleKeywordCandidate = (candidateId: string) => {
    setSelectedKeywordIds(prev => (
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    ));
  };

  const handleConfirmKeywords = () => {
    if (!onConfirmKeywordCandidates) return;

    const selectedCandidates = keywordCandidates.filter(candidate => selectedKeywordIds.includes(candidate.id));
    if (selectedCandidates.length === 0) {
      setKeywordNotice('至少保留一个关键词，才会写入牌义记忆。');
      return;
    }

    onConfirmKeywordCandidates(reading.id, selectedCandidates);
    setShowKeywordReview(false);
    setKeywordNotice(`已将 ${selectedCandidates.length} 个关键词纳入个人牌义记忆。`);
  };

  const renderCards = () => {
    const layout = reading.layoutType ? (LAYOUT_TEMPLATES[reading.layoutType] || LAYOUT_TEMPLATES.horizontal) : null;
    const isCeltic = reading.layoutType === 'celtic' || reading.layoutType === 'celtic-cross' || reading.spread === '凯尔特十字牌阵';
    const isYearly = reading.layoutType === 'yearly' || reading.spread === '年运十二宫牌阵';
    const isFreeLayout = reading.layoutType === 'free';
    const freeLayoutFrame = isFreeLayout ? getFreeLayoutDisplayFrame(reading.cards) : null;
    const displayPositions = reading.cards.map((_, index) => reading.slotPositions?.[index] || layout?.itemClasses[index] || '');
    const gridExtent = displayPositions.reduce((result, position) => ({
      cols: Math.max(result.cols, getGridNumber(position, 'col')),
      rows: Math.max(result.rows, getGridNumber(position, 'row')),
    }), { cols: 1, rows: 1 });
    const cardWidth = 64;
    const cardHeight = 96;
    const gapSize = isCeltic ? 32 : isYearly ? 0 : reading.cards.length > 3 ? 8 : 12;
    const rawPreviewWidth = isCeltic
      ? 420
      : isYearly
      ? 520
      : isFreeLayout
      ? freeLayoutFrame?.width || FREE_LAYOUT_CANVAS_WIDTH
      : gridExtent.cols * cardWidth + Math.max(0, gridExtent.cols - 1) * gapSize;
    const rawPreviewHeight = isCeltic
      ? 504
      : isYearly
      ? 520
      : isFreeLayout
      ? freeLayoutFrame?.height || FREE_LAYOUT_CANVAS_HEIGHT
      : gridExtent.rows * cardHeight + Math.max(0, gridExtent.rows - 1) * gapSize;
    const shouldFitPreview = isFreeLayout || isCeltic || isYearly || reading.layoutType === 'custom';
    const autoFitScale = shouldFitPreview && previewWidth > 0
      ? Math.min(1, Math.max(0.42, (previewWidth - 24) / Math.max(1, rawPreviewWidth)))
      : 1;
    const fittedFrameStyle = shouldFitPreview ? {
      width: rawPreviewWidth * autoFitScale,
      minHeight: rawPreviewHeight * autoFitScale,
    } : undefined;

    return (
      <div
        ref={containerRef}
        className="relative overflow-hidden overscroll-contain rounded-xl bg-forest-bg/50 border border-forest-accent/10"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className={shouldFitPreview ? 'mx-auto' : undefined} style={fittedFrameStyle}>
        <motion.div
          className="relative"
          style={{
            width: shouldFitPreview ? rawPreviewWidth : undefined,
            minHeight: shouldFitPreview ? rawPreviewHeight : undefined,
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale * autoFitScale})`,
            transformOrigin: shouldFitPreview ? 'top center' : 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          <div
            className={isFreeLayout
              ? 'relative mx-auto'
              : isYearly
                ? 'relative mx-auto rounded-2xl border border-forest-accent/10 bg-forest-bg/20'
              : isCeltic
                ? 'relative mx-auto rounded-2xl border border-forest-accent/10 bg-forest-bg/20'
              : `${reading.layoutType ? layout?.class : 'flex flex-wrap justify-center gap-2 p-4'} ${isYearly ? 'h-[280px] sm:h-[360px]' : ''}`}
            data-testid={isYearly ? 'reading-card-yearly-preview' : isCeltic ? 'reading-card-celtic-preview' : undefined}
            style={{
              ...(isFreeLayout ? {
                width: freeLayoutFrame?.width || FREE_LAYOUT_CANVAS_WIDTH,
                height: freeLayoutFrame?.height || FREE_LAYOUT_CANVAS_HEIGHT,
              } : isYearly ? {
                width: rawPreviewWidth,
                height: rawPreviewHeight,
              } : isCeltic ? {
                width: rawPreviewWidth,
                height: rawPreviewHeight,
              } : {}),
              ...(shouldFitPreview && !isFreeLayout ? {
                width: rawPreviewWidth,
                maxWidth: 'none',
              } : {}),
            }}
          >
            {reading.cards.map((card, idx) => {
              const cardData = TAROT_CARDS.find(c =>
                c.name === card.name ||
                c.english === card.name ||
                c.id === card.name
              );
              const posClass = reading.slotPositions?.[idx] || layout?.itemClasses[idx] || '';
              const label = reading.slotLabels?.[idx];

              const isRotated = reading.rotatedSlots?.includes(idx) || (isCeltic && idx === 1);

              if (isFreeLayout) {
                const scale = card.scale || 1;

                return (
                  <div
                    key={idx}
                    className="absolute flex flex-col items-center gap-1 cursor-pointer group/card"
                    style={{
                      left: (card.x || 0) + (freeLayoutFrame?.offsetX || 0),
                      top: (card.y || 0) + (freeLayoutFrame?.offsetY || 0),
                      width: FREE_LAYOUT_SLOT_WIDTH,
                      minHeight: FREE_LAYOUT_SLOT_HEIGHT,
                      transform: `rotate(${card.rotation || 0}deg) scale(${scale})`,
                      transformOrigin: 'center center',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCardIdx(selectedCardIdx === idx ? null : idx);
                    }}
                  >
                    <div
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${selectedCardIdx === idx ? 'border-forest-accent ring-4 ring-forest-accent/10 scale-110 z-30' : 'border-forest-accent/10 group-hover/card:border-forest-accent/30'} shadow-sm ${card.isReversed ? 'rotate-180' : ''}`}
                      style={{
                        width: FREE_LAYOUT_SLOT_WIDTH,
                        height: FREE_LAYOUT_SLOT_HEIGHT,
                      }}
                    >
                      {reading.showSlotNumbers !== false && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/60 text-white text-[8px] px-1.5 py-0.5 rounded-sm z-20 font-black">
                          {idx + 1}
                        </div>
                      )}
                      <TarotCardImage
                        src={getCardImageUrl(cardData?.id || 'ar00')}
                        alt={card.name}
                        name={cardData?.name || card.name}
                        className="w-full h-full object-contain bg-white"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-forest-text/70 text-white text-[8px] py-0.5 text-center font-sans">
                        {cardData?.name || card.name}
                      </div>
                    </div>
                    {label && (
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded leading-tight transition-colors ${selectedCardIdx === idx ? 'bg-forest-accent text-white' : 'text-forest-accent bg-forest-accent/10'}`}>
                        {label}
                      </span>
                    )}
                    {!label && card.isReversed && <span className="text-[9px] text-red-500">逆位</span>}
                  </div>
                );
              }

              if (isYearly) {
                const point = yearlyPreviewPositions[idx] || yearlyPreviewPositions[yearlyPreviewPositions.length - 1];

                return (
                  <div
                    key={idx}
                    className="absolute z-10 flex flex-col items-center gap-1 cursor-pointer group/card"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: 'translate(-50%, -50%) scale(0.82)',
                      transformOrigin: 'center center',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCardIdx(selectedCardIdx === idx ? null : idx);
                    }}
                  >
                    <div className={`relative w-16 h-24 sm:w-20 sm:h-30 rounded-lg overflow-hidden border-2 transition-all ${selectedCardIdx === idx ? 'border-forest-accent ring-4 ring-forest-accent/10 scale-110 z-30' : 'border-forest-accent/10 group-hover/card:border-forest-accent/30'} shadow-sm ${card.isReversed ? 'rotate-180' : ''}`}>
                      {reading.showSlotNumbers !== false && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/60 text-white text-[8px] px-1.5 py-0.5 rounded-sm z-20 font-black">
                          {idx + 1}
                        </div>
                      )}
                      <TarotCardImage
                        src={getCardImageUrl(cardData?.id || 'ar00')}
                        alt={card.name}
                        name={cardData?.name || card.name}
                        className="w-full h-full object-contain bg-white"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-forest-text/70 text-white text-[8px] py-0.5 text-center font-sans">
                        {cardData?.name || card.name}
                      </div>
                    </div>
                    {label && (
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded leading-tight transition-colors ${selectedCardIdx === idx ? 'bg-forest-accent text-white' : 'text-forest-accent bg-forest-accent/10'}`}>
                        {label}
                      </span>
                    )}
                    {!label && card.isReversed && <span className="text-[9px] text-red-500">逆位</span>}
                  </div>
                );
              }

              if (isCeltic) {
                const point = celticPreviewPositions[idx] || celticPreviewPositions[0];
                const isChallenge = idx === 1;

                return (
                  <div
                    key={idx}
                    className="absolute z-10 flex flex-col items-center gap-1 cursor-pointer group/card"
                    data-testid={idx === 0 ? 'reading-card-celtic-center' : undefined}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: 'translate(-50%, -50%) scale(0.88)',
                      transformOrigin: 'center center',
                      zIndex: idx === 1 ? 35 : idx === 0 ? 30 : idx === 2 ? 15 : 20,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCardIdx(selectedCardIdx === idx ? null : idx);
                    }}
                  >
                    <div className={`relative w-16 h-24 sm:w-20 sm:h-30 rounded-lg overflow-hidden border-2 transition-all ${selectedCardIdx === idx ? 'border-forest-accent ring-4 ring-forest-accent/10 scale-110 z-30' : 'border-forest-accent/10 group-hover/card:border-forest-accent/30'} shadow-sm ${isChallenge ? 'rotate-90' : ''} ${card.isReversed ? 'rotate-180' : ''}`}>
                      {reading.showSlotNumbers !== false && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/60 text-white text-[8px] px-1.5 py-0.5 rounded-sm z-20 font-black">
                          {idx + 1}
                        </div>
                      )}
                      <TarotCardImage
                        src={getCardImageUrl(cardData?.id || 'ar00')}
                        alt={card.name}
                        name={cardData?.name || card.name}
                        className="w-full h-full object-contain bg-white"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-forest-text/70 text-white text-[8px] py-0.5 text-center font-sans">
                        {cardData?.name || card.name}
                      </div>
                    </div>
                    {label && (
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded leading-tight transition-colors ${selectedCardIdx === idx ? 'bg-forest-accent text-white' : 'text-forest-accent bg-forest-accent/10'}`}>
                        {label}
                      </span>
                    )}
                    {!label && card.isReversed && <span className="text-[9px] text-red-500">逆位</span>}
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center gap-1 ${posClass} cursor-pointer group/card`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCardIdx(selectedCardIdx === idx ? null : idx);
                  }}
                >
                  <div className={`relative w-16 h-24 sm:w-20 sm:h-30 rounded-lg overflow-hidden border-2 transition-all ${selectedCardIdx === idx ? 'border-forest-accent ring-4 ring-forest-accent/10 scale-110 z-30' : 'border-forest-accent/10 group-hover/card:border-forest-accent/30'} shadow-sm ${isRotated ? 'rotate-90' : ''} ${card.isReversed ? 'rotate-180' : ''}`}>
                    {reading.showSlotNumbers !== false && (
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/60 text-white text-[8px] px-1.5 py-0.5 rounded-sm z-20 font-black">
                        {idx + 1}
                      </div>
                    )}
                    <TarotCardImage
                      src={getCardImageUrl(cardData?.id || 'ar00')}
                      alt={card.name}
                      name={cardData?.name || card.name}
                      className="w-full h-full object-contain bg-white"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-forest-text/70 text-white text-[8px] py-0.5 text-center font-sans">
                      {cardData?.name || card.name}
                    </div>
                  </div>
                  {label && (
                    <span className={`text-[9px] font-medium px-2 py-0.5 rounded leading-tight transition-colors ${selectedCardIdx === idx ? 'bg-forest-accent text-white' : 'text-forest-accent bg-forest-accent/10'}`}>
                      {label}
                    </span>
                  )}
                  {!label && card.isReversed && <span className="text-[9px] text-red-500">逆位</span>}
                </div>
              );
            })}
          </div>
        </motion.div>
        </div>

        <div className="absolute top-2 right-2 z-40 flex flex-col gap-1.5 sm:flex-row">
          <button
            className="card-zoom-handler flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest-accent/10 bg-white/75 shadow-sm backdrop-blur transition-colors hover:bg-white sm:rounded-xl"
            onClick={(e) => { e.stopPropagation(); setScale(prev => clampScale(prev + 0.2)); }}
            title="放大"
            aria-label="放大牌阵预览"
          >
            <ZoomIn size={16} className="text-forest-accent" />
          </button>
          <button
            className="card-zoom-handler flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest-accent/10 bg-white/75 shadow-sm backdrop-blur transition-colors hover:bg-white sm:rounded-xl"
            onClick={(e) => { e.stopPropagation(); setScale(prev => clampScale(prev - 0.2)); }}
            title="缩小"
            aria-label="缩小牌阵预览"
          >
            <ZoomOut size={16} className="text-forest-accent" />
          </button>
          <button
            className="card-zoom-handler flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest-accent/10 bg-white/75 shadow-sm backdrop-blur transition-colors hover:bg-white sm:rounded-xl"
            onClick={(e) => { e.stopPropagation(); resetView(); }}
            title="重置"
            aria-label="重新预览牌阵"
          >
            <RefreshCw size={16} className="text-forest-accent" />
          </button>
        </div>
      </div>
    );
  };

  if (isMini) {
    const isCeltic = reading.layoutType === 'celtic-cross' || reading.spread === '凯尔特十字牌阵';

    return (
      <div className="flex flex-wrap justify-center gap-1 p-2">
        {reading.cards.map((card, idx) => {
          const cardData = TAROT_CARDS.find(c =>
            c.name === card.name || c.english === card.name || c.id === card.name
          );
          const isRotated = isCeltic && idx === 1;

          return (
            <div key={idx} className={`relative w-10 h-16 rounded-lg overflow-hidden border border-forest-accent/10 ${card.isReversed ? 'rotate-180' : ''} ${isRotated ? 'rotate-90' : ''}`}>
              <TarotCardImage
                src={getCardImageUrl(cardData?.id || 'ar00')}
                alt={card.name}
                name={cardData?.name || card.name}
                className="w-full h-full object-contain bg-forest-bg"
              />
            </div>
          );
        })}
      </div>
    );
  }

  const renderMobileSpreadThumbnailPreview = (
    wrapperClassName = 'px-2.5 pb-2 pt-0 sm:hidden',
    frameClassName = 'h-16',
  ) => {
    const visibleCards = reading.cards.slice(0, 8);
    if (visibleCards.length === 0) return null;

    const layout = reading.layoutType ? (LAYOUT_TEMPLATES[reading.layoutType] || LAYOUT_TEMPLATES.horizontal) : LAYOUT_TEMPLATES.horizontal;
    const isCeltic = reading.layoutType === 'celtic' || reading.layoutType === 'celtic-cross' || reading.spread === '凯尔特十字牌阵';
    const isYearly = reading.layoutType === 'yearly' || reading.spread === '年运十二宫牌阵';
    const isFreeLayout = reading.layoutType === 'free';
    const freeLayoutFrame = isFreeLayout ? getFreeLayoutDisplayFrame(reading.cards) : null;
    const gridPositions = visibleCards.map((_, index) => reading.slotPositions?.[index] || layout?.itemClasses[index] || '');
    const parsedPositions = gridPositions.map((position, index) => {
      const col = getGridNumber(position, 'col');
      const row = getGridNumber(position, 'row');
      return {
        col: Number.isFinite(col) ? col : index + 1,
        row: Number.isFinite(row) ? row : 1,
      };
    });
    const minCol = Math.min(...parsedPositions.map(item => item.col));
    const maxCol = Math.max(...parsedPositions.map(item => item.col));
    const minRow = Math.min(...parsedPositions.map(item => item.row));
    const maxRow = Math.max(...parsedPositions.map(item => item.row));
    const normalize = (value: number, min: number, max: number, start: number, end: number) => (
      max === min ? 50 : start + ((value - min) / (max - min)) * (end - start)
    );

    const points = visibleCards.map((card, idx) => {
      if (isYearly) {
        const point = yearlyPreviewPositions[idx] || yearlyPreviewPositions[yearlyPreviewPositions.length - 1];
        return { x: point.x, y: point.y };
      }

      if (isCeltic) {
        const point = celticPreviewPositions[idx] || celticPreviewPositions[0];
        return { x: point.x, y: point.y };
      }

      if (isFreeLayout && freeLayoutFrame) {
        const x = ((card.x || 0) + (freeLayoutFrame.offsetX || 0) + FREE_LAYOUT_SLOT_WIDTH / 2) / Math.max(1, freeLayoutFrame.width) * 100;
        const y = ((card.y || 0) + (freeLayoutFrame.offsetY || 0) + FREE_LAYOUT_SLOT_HEIGHT / 2) / Math.max(1, freeLayoutFrame.height) * 100;
        return {
          x: Math.min(88, Math.max(12, x)),
          y: Math.min(78, Math.max(22, y)),
        };
      }

      const parsed = parsedPositions[idx];
      return {
        x: normalize(parsed.col, minCol, maxCol, 12, 88),
        y: normalize(parsed.row, minRow, maxRow, 18, 82),
      };
    });
    const compactCards = visibleCards.length > 4;

    return (
      <div className={wrapperClassName}>
        <div
          className={`relative overflow-hidden rounded-xl border border-forest-accent/7 bg-forest-bg/28 ${frameClassName}`}
          style={{ touchAction: mobilePreviewScale > 1 ? 'none' : 'pan-y' }}
          onClick={(event) => event.stopPropagation()}
          onTouchStart={handleMobilePreviewTouchStart}
          onTouchMove={handleMobilePreviewTouchMove}
          onTouchEnd={handleMobilePreviewTouchEnd}
          onTouchCancel={handleMobilePreviewTouchEnd}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${mobilePreviewPosition.x}px, ${mobilePreviewPosition.y}px) scale(${mobilePreviewScale})`,
              transformOrigin: 'center center',
              transition: mobilePreviewScale === 1 ? 'transform 0.18s ease-out' : 'none',
            }}
          >
          <div className="absolute inset-x-3 top-1/2 border-t border-dashed border-forest-accent/8" aria-hidden />
          <div className="absolute inset-y-2 left-1/2 border-l border-dashed border-forest-accent/7" aria-hidden />
          {visibleCards.map((card, idx) => {
            const cardData = TAROT_CARDS.find(c =>
              c.name === card.name || c.english === card.name || c.id === card.name
            );
            const cardName = cardData?.name || card.name;
            const isRotated = reading.rotatedSlots?.includes(idx) || (isCeltic && idx === 1);
            const rotation = (isRotated ? 90 : 0) + (card.isReversed ? 180 : 0);

            return (
              <div
                key={`${card.name}-${idx}`}
                className={`absolute border border-forest-accent/12 bg-white/70 shadow-[0_6px_16px_-14px_rgba(62,58,54,0.55)] ${compactCards ? 'h-6 w-4 rounded-[0.28rem]' : 'h-8 w-[21px] rounded-[0.35rem]'}`}
                style={{
                  left: `${points[idx].x}%`,
                  top: `${points[idx].y}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                }}
                title={`${reading.slotLabels?.[idx] || `第 ${idx + 1} 张`}：${cardName}${card.isReversed ? '（逆位）' : '（正位）'}`}
              >
                <TarotCardImage
                  src={getCardImageUrl(cardData?.id || 'ar00')}
                  alt=""
                  name={cardName}
                  loading="eager"
                  fetchPriority="low"
                  className="h-full w-full rounded-[0.3rem] object-cover"
                />
                <span className="absolute -bottom-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white/88 px-0.5 text-[8px] font-medium leading-none text-forest-accent shadow-sm">
                  {idx + 1}
                </span>
              </div>
            );
          })}
          {reading.cards.length > visibleCards.length && (
            <span className="absolute bottom-1.5 right-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-forest-muted shadow-sm">
              +{reading.cards.length - visibleCards.length}
            </span>
          )}
          </div>
        </div>
      </div>
    );
  };

  const canShowDeleteAction = Boolean(onDelete && !reading.isExample && !hideDeleteAction);
  const hasCardActions = !isPublicView && (onTogglePublic || onEdit || canShowDeleteAction);
  const renderCardActions = (className: string) => {
    if (!hasCardActions) return null;

    return (
      <div className={className}>
        {onTogglePublic && !reading.isExample && (
          <button
            onClick={onTogglePublic}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors hover:bg-white/45"
            title={reading.isPublic ? '收回私人' : '公开到广场'}
            aria-label={reading.isPublic ? '收回私人' : '公开到广场'}
          >
            {reading.isPublic ? (
              <Lock size={16} className="text-forest-accent" />
            ) : (
              <Share2 size={16} className="text-forest-accent" />
            )}
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors hover:bg-white/45"
            title="编辑"
            aria-label="编辑手记"
          >
            <PencilLine size={16} className="text-forest-accent" />
          </button>
        )}
        {canShowDeleteAction && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors hover:bg-red-50/70"
            title="删除"
            aria-label="删除手记"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        )}
      </div>
    );
  };

  const listCardSummary = reading.cards
    .map((card) => {
        const cardData = TAROT_CARDS.find(c =>
          c.name === card.name || c.english === card.name || c.id === card.name
        );
      const name = cardData?.name || card.name;
      return `${name}${card.isReversed ? '逆' : '正'}`;
    })
    .join(' · ');

  if (isListView) {
    return (
      <motion.div
        data-highlighted-reading={isHighlighted ? 'true' : undefined}
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: isHighlighted ? [1, 1.01, 1] : 1,
        }}
        transition={{ duration: isHighlighted ? 0.55 : 0.18 }}
        className={`overflow-hidden rounded-[1.05rem] border bg-white/45 backdrop-blur-[2px] transition-all duration-300 ${
          isHighlighted
            ? 'border-forest-accent/45 ring-2 ring-forest-accent/12'
            : 'border-forest-accent/7'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (onViewDetails) {
              onViewDetails();
              return;
            }
            setIsExpanded(!isExpanded);
          }}
          className="grid min-h-[4.35rem] w-full grid-cols-[minmax(0,1fr)_2rem] gap-2 py-2 pl-12 pr-2.5 text-left transition-colors hover:bg-white/35"
          aria-label={`查看手记：${reading.question || '未命名问题'}`}
        >
          <span className="min-w-0 space-y-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-forest-ink">
                {reading.question || '未命名问题'}
              </span>
              {hasFeedback ? (
                <span className="shrink-0 rounded-full bg-forest-accent/8 px-1.5 py-0.5 text-[9px] font-medium text-forest-accent">
                  已复盘
                </span>
              ) : !reading.isExample ? (
                <span className="shrink-0 rounded-full bg-forest-pink/10 px-1.5 py-0.5 text-[9px] font-medium text-forest-pink">
                  待复盘
                </span>
              ) : null}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-[10px] leading-tight text-forest-muted">
              <span className="shrink-0">{displayDate}</span>
              <span className="text-forest-accent/25">·</span>
              <span className="truncate">{reading.spread}</span>
              <span className="text-forest-accent/25">·</span>
              <span className="shrink-0">{reading.cards.length}张牌</span>
              {reading.isForClient && (
                <>
                  <span className="text-forest-accent/25">·</span>
                  <span className="shrink-0 text-amber-700">{clientDisplayName}</span>
                </>
              )}
            </span>
            <span className="block truncate text-[11px] leading-tight text-forest-ink/62">
              {listCardSummary || '暂无牌面'}
            </span>
          </span>
          <span className="flex min-h-11 min-w-8 items-center justify-center self-center rounded-full text-forest-muted/80">
            <ChevronDown size={16} className="-rotate-90" />
          </span>
        </button>

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="删除手记"
          message="确定删除这条手记吗？此操作会同时移出阁中典籍。"
          confirmText="删除"
          destructive
          onConfirm={() => onDelete?.()}
          onClose={() => setShowDeleteConfirm(false)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      data-highlighted-reading={isHighlighted ? 'true' : undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isHighlighted ? [1, 1.015, 1] : 1,
      }}
      transition={{ duration: isHighlighted ? 0.7 : 0.25 }}
      onClick={handleMobileCardOpen}
      className={`bg-white/58 rounded-[1.1rem] border shadow-sm overflow-hidden transition-all duration-500 backdrop-blur-[2px] sm:rounded-[1.35rem] ${
        isHighlighted
          ? 'border-forest-accent/60 ring-4 ring-forest-accent/15 shadow-forest-accent/20'
          : 'border-forest-accent/8'
      } ${isListView ? 'rounded-[1.1rem]' : ''}`}
    >
      <div className={`${isListView ? 'p-3 pl-12 sm:p-3 sm:pl-12' : 'p-2.5 pl-11 sm:p-3.5 sm:pl-3.5'} ${onViewDetails ? 'sm:border-b' : 'border-b'} border-forest-accent/5`}>
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className={`${isListView ? 'mb-1.5' : 'mb-1 sm:mb-2'} flex flex-wrap items-center gap-1.5`}>
              <span className="text-[10px] text-forest-muted sm:text-xs">{displayDate}</span>
              {reading.isPublic && (
                <span className="px-1.5 py-0.5 bg-forest-accent/10 text-forest-accent text-[10px] rounded-full font-bold">
                  公开
                </span>
              )}
              {reading.isExample && (
                <span className="px-1.5 py-0.5 bg-forest-pink/10 text-forest-pink text-[10px] rounded-full font-bold">
                  示例
                </span>
              )}
              {reading.isAiProcessed && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded-full font-bold">
                  AI解读
                </span>
              )}
              {reading.isForClient && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full font-bold">
                  客户记录
                </span>
              )}
              {hasFeedback && (
                <span className="px-1.5 py-0.5 bg-forest-accent/10 text-forest-accent text-[10px] rounded-full font-bold inline-flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={10} strokeWidth={2.5} />
                  已复盘
                </span>
              )}
              {!hasFeedback && !reading.isExample && (
                <span className="px-1.5 py-0.5 bg-forest-pink/10 text-forest-pink text-[10px] rounded-full font-bold inline-flex items-center gap-1 shrink-0">
                  <Clock3 size={10} strokeWidth={2.5} />
                  待复盘
                </span>
              )}
            </div>
            <h3 className={`${isListView ? 'text-sm sm:text-base' : 'text-[0.98rem] sm:text-base'} font-semibold leading-snug text-forest-ink line-clamp-2`}>{reading.question}</h3>
            <div className={`${isListView ? 'mt-1' : 'mt-1 sm:mt-2'} flex flex-wrap items-center gap-1.5`}>
              <span className="text-[11px] text-forest-muted sm:text-xs">{reading.spread}</span>
              <span className="text-forest-accent/30">|</span>
              <span className="text-[11px] text-forest-muted sm:text-xs">{reading.cards.length}张牌</span>
              {reading.isForClient && (
                <>
                  <span className="text-forest-accent/30">|</span>
                  <span className="text-[11px] font-bold text-amber-700 sm:text-xs">{clientDisplayName}</span>
                </>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 sm:block">
            {renderCardActions(`flex shrink-0 items-center gap-0.5 ${isListView ? '-mr-1' : 'gap-1'}`)}
          </div>
          {!isListView && (
            <div className="flex w-[8.25rem] shrink-0 flex-col items-end gap-1 sm:hidden">
              {renderCardActions('flex shrink-0 items-center gap-0')}
              {renderMobileSpreadThumbnailPreview('w-full', 'h-[4.75rem]')}
            </div>
          )}
        </div>

        {displayAuthorName && displayAuthorName !== '研习阁主' && (
          <button
            type="button"
            onClick={() => {
              if (!reading.isAnonymous) onAuthorClick?.(displayAuthorName);
            }}
            disabled={reading.isAnonymous}
            className="mt-3 hidden items-center gap-2 text-xs text-forest-accent transition-colors hover:text-forest-accent/80 sm:flex"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-forest-accent to-forest-pink flex items-center justify-center text-white text-[10px] font-bold">
              {displayAuthorName.charAt(0)}
            </span>
            <span className="font-medium">{displayAuthorName}</span>
          </button>
        )}
      </div>

      <div className="hidden sm:block">
        {renderCards()}
      </div>

      {reading.category && (
        <div className="hidden items-center gap-2 border-t border-forest-accent/5 px-3.5 py-2 sm:flex">
          <span className="text-[10px] text-forest-muted">分类：</span>
          <span className="text-xs text-forest-accent font-medium">#{reading.category}</span>
        </div>
      )}

      {overviewText && (
        <div className="hidden border-t border-forest-accent/5 bg-forest-accent/5 px-3.5 py-3 sm:block">
          <p className="text-[10px] font-bold text-forest-accent mb-1">综合解读</p>
          <p className="text-xs text-forest-ink/80 leading-relaxed line-clamp-3">{overviewText}</p>
        </div>
      )}

      {!isListView && (
      <button
        onClick={() => {
          if (onViewDetails) {
            onViewDetails();
            return;
          }
          setIsExpanded(!isExpanded);
        }}
        className={`${onViewDetails ? 'hidden sm:flex' : 'flex'} min-h-11 w-full items-center justify-center gap-2 px-4 py-3 text-xs text-forest-muted hover:text-forest-accent hover:bg-forest-accent/5 transition-all`}
      >
        {onViewDetails ? <Eye size={14} /> : (isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        <span>{onViewDetails ? '查看详情' : (isExpanded ? '收起解读' : '查看解读')}</span>
      </button>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-forest-accent/5"
          >
            <div className="p-4 space-y-4">
              {hasCardInterpretationRows && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-forest-accent uppercase tracking-wider">逐牌解读</h4>
                  <div className="space-y-2">
                    {cardInterpretationRows.map((item, index) => (
                      <div key={`${item.card.name}-${index}`} className="rounded-xl bg-forest-accent/5 border border-forest-accent/5 p-3 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-forest-accent">
                          <span>{item.label}</span>
                          <span>·</span>
                          <span>{item.card.name}{item.card.isReversed ? '（逆位）' : '（正位）'}</span>
                        </div>
                        <p className="text-sm text-forest-ink leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {legacySingleCardText && !hasCardInterpretationRows && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-forest-accent uppercase tracking-wider">
                    {(reading.cards?.length || 0) <= 1 ? '单牌解读' : '整体解读'}
                  </h4>
                  <p className="text-sm text-forest-ink leading-relaxed">{legacySingleCardText}</p>
                </div>
              )}
              {reading.interpretation?.combination && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-forest-accent uppercase tracking-wider">组合解读</h4>
                  <p className="text-sm text-forest-ink leading-relaxed">{reading.interpretation.combination}</p>
                </div>
              )}
              {reading.interpretation?.summary && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-forest-accent uppercase tracking-wider">总结建议</h4>
                  <p className="text-sm text-forest-ink leading-relaxed">{reading.interpretation.summary}</p>
                </div>
              )}
              {influenceNotes.length > 0 && (
                <div className="space-y-3">
                  {influenceNotes.map(item => (
                    <div key={item.label} className="space-y-1.5 rounded-xl bg-forest-accent/5 border border-forest-accent/5 p-3">
                      <h4 className="text-xs font-bold text-forest-accent uppercase tracking-wider">{item.label}</h4>
                      <p className="text-sm text-forest-ink leading-relaxed">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {reading.keywords && reading.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reading.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-forest-accent/5 text-forest-accent text-xs rounded-full"
                      onClick={() => onTagClick?.(kw)}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {canReviewKeywords && (
                <div className="rounded-2xl border border-forest-accent/10 bg-forest-accent/5 p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-forest-accent flex items-center gap-1.5">
                        <Sparkles size={13} />
                        个人关键词
                      </h4>
                      <p className="mt-1 text-[10px] leading-relaxed text-forest-muted">
                        AI 整理会从这条手记中提取候选关键词，确认后才会写入你的个人牌义记忆。
                      </p>
                      {keywordNotice && (
                        <p className="mt-1 text-[10px] text-forest-muted">{keywordNotice}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractKeywords}
                      disabled={isExtractingKeywords}
                      className="min-h-11 px-3 py-2 rounded-xl bg-white border border-forest-accent/20 text-forest-accent text-xs font-bold flex items-center justify-center gap-2 hover:bg-forest-accent/10 disabled:opacity-60 transition-colors"
                    >
                      {isExtractingKeywords ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {reading.isAiProcessed ? '重新整理' : 'AI 整理'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showKeywordReview && keywordCandidates.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="space-y-3"
                      >
                        {Object.entries(groupedKeywordCandidates).map(([cardName, candidates]) => (
                          <div key={cardName} className="rounded-xl bg-white border border-forest-accent/10 p-3 space-y-2">
                            <p className="text-[10px] font-bold text-forest-ink">{cardName}</p>
                            <div className="flex flex-wrap gap-2">
                              {candidates.map(candidate => {
                                const selected = selectedKeywordIds.includes(candidate.id);
                                return (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    onClick={() => toggleKeywordCandidate(candidate.id)}
                                    className={`min-h-11 px-3 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                      selected
                                        ? 'bg-forest-accent text-white border-forest-accent shadow-sm'
                                        : 'bg-white text-forest-muted border-forest-accent/20 hover:border-forest-accent/40'
                                    }`}
                                  >
                                    {selected && <Check size={12} />}
                                    {candidate.keyword}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowKeywordReview(false)}
                            className="min-h-11 px-4 py-2 rounded-xl bg-white text-forest-muted border border-forest-accent/10 text-xs font-bold hover:text-forest-accent transition-colors"
                          >
                            稍后
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmKeywords}
                            className="min-h-11 px-4 py-2 rounded-xl bg-forest-accent text-white text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-forest-accent/90 transition-colors"
                          >
                            <Check size={14} />
                            纳入记忆
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除手记"
        message="确定删除这条手记吗？此操作会同时移出阁中典籍。"
        confirmText="删除"
        destructive
        onConfirm={() => onDelete?.()}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </motion.div>
  );
};
