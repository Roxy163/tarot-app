import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RefreshCw, Copy, Share2, ChevronDown, ChevronUp, BookOpen, ExternalLink, Trash2, Lock } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl, LAYOUT_TEMPLATES } from '../constants';

interface ReadingCardProps {
  reading: TarotReading;
  cardMetadata: TarotCardMetadata[];
  onEdit?: () => void;
  onTagClick?: (tag: string) => void;
  activeTags?: string[];
  onAuthorClick?: (author: string) => void;
  onProcessAi?: (id: string) => void;
  isMini?: boolean;
  onTogglePublic?: () => void;
  isPublicView?: boolean;
  onDelete?: () => void;
}

export const ReadingCard: React.FC<ReadingCardProps> = ({
  reading,
  cardMetadata,
  onEdit,
  onTagClick,
  activeTags,
  onAuthorClick,
  onProcessAi,
  isMini = false,
  onTogglePublic,
  isPublicView = false,
  onDelete
}) => {
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPosition = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, 0.5), 2));
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSystemShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '塔罗研习阁',
          text: `【塔罗研习阁】分享占卜案例：\n问题：${reading.question}\n牌阵：${reading.spread}\n\n来自于塔罗研习阁`,
          url: window.location.href
        });
      } catch (err) {
        copyToClipboard(window.location.href);
      }
    }
  };

  const renderCards = () => {
    const layout = reading.layoutType ? (LAYOUT_TEMPLATES[reading.layoutType] || LAYOUT_TEMPLATES.horizontal) : null;
    const isCeltic = reading.layoutType === 'celtic-cross' || reading.spread === '凯尔特十字牌阵';
    const isYearly = reading.layoutType === 'yearly' || reading.spread === '年运十二宫牌阵';

    return (
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl bg-forest-bg/50 border border-forest-accent/10"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <motion.div
          className="relative"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          <div className={`${reading.layoutType ? layout?.class : 'flex flex-wrap justify-center gap-2 p-4'} ${isYearly ? 'h-[280px] sm:h-[360px]' : ''}`}>
            {reading.cards.map((card, idx) => {
              const cardData = TAROT_CARDS.find(c =>
                c.name === card.name ||
                c.english === card.name ||
                c.id === card.name
              );
              const posClass = reading.slotPositions?.[idx] || layout?.itemClasses[idx] || '';
              const label = reading.slotLabels?.[idx];

              const isRotated = reading.rotatedSlots?.includes(idx) || (isCeltic && idx === 1);
              
              if (isCeltic && idx === 1) {
                return (
                  <div
                    key={idx}
                    className={`flex flex-col items-center gap-1 ${posClass} relative cursor-pointer group/card`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCardIdx(selectedCardIdx === idx ? null : idx);
                    }}
                  >
                    <div className="relative w-16 h-24 sm:w-20 sm:h-30">
                      <div className={`absolute inset-0 rounded-lg overflow-hidden border-2 border-forest-accent/10 shadow-sm ${card.isReversed ? 'rotate-180' : ''}`}>
                        <img
                          src={getCardImageUrl(cardData?.id || 'ar00')}
                          alt={card.name}
                          className="w-full h-full object-contain bg-white"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-forest-text/70 text-white text-[8px] py-0.5 text-center font-sans">
                          {cardData?.name || card.name}
                        </div>
                      </div>
                      <div className={`absolute inset-0 rounded-lg overflow-hidden border-2 rotate-90 transition-all ${selectedCardIdx === idx ? 'border-forest-accent ring-4 ring-forest-accent/10 scale-110 z-30' : 'border-forest-accent/10'} shadow-sm ${card.isReversed ? 'rotate-180' : ''}`}>
                        {reading.showSlotNumbers !== false && (
                          <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/60 text-white text-[8px] px-1.5 py-0.5 rounded-sm z-20 font-black">
                            {idx + 1}
                          </div>
                        )}
                        <img
                          src={getCardImageUrl(cardData?.id || 'ar00')}
                          alt={card.name}
                          className="w-full h-full object-contain bg-white"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-forest-text/70 text-white text-[8px] py-0.5 text-center font-sans">
                          {cardData?.name || card.name}
                        </div>
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
                    <img
                      src={getCardImageUrl(cardData?.id || 'ar00')}
                      alt={card.name}
                      className="w-full h-full object-contain bg-white"
                      referrerPolicy="no-referrer"
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

        <div className="absolute top-2 right-2 flex gap-1.5 z-40">
          <button
            className="card-zoom-handler p-1.5 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setScale(prev => Math.min(prev + 0.2, 2)); }}
            title="放大"
          >
            <ZoomIn size={14} className="text-forest-accent" />
          </button>
          <button
            className="card-zoom-handler p-1.5 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setScale(prev => Math.max(prev - 0.2, 0.5)); }}
            title="缩小"
          >
            <ZoomOut size={14} className="text-forest-accent" />
          </button>
          <button
            className="card-zoom-handler p-1.5 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors"
            onClick={(e) => { e.stopPropagation(); resetView(); }}
            title="重置"
          >
            <RefreshCw size={14} className="text-forest-accent" />
          </button>
        </div>
      </div>
    );
  };

  if (isMini) {
    const layout = reading.layoutType ? (LAYOUT_TEMPLATES[reading.layoutType] || LAYOUT_TEMPLATES.horizontal) : null;
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
              <img
                src={getCardImageUrl(cardData?.id || 'ar00')}
                alt={card.name}
                className="w-full h-full object-contain bg-forest-bg"
                referrerPolicy="no-referrer"
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-forest-accent/10 shadow-lg overflow-hidden"
    >
      <div className="p-4 border-b border-forest-accent/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-forest-muted">{reading.date}</span>
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
            </div>
            <h3 className="text-base font-bold text-forest-ink line-clamp-2">{reading.question}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-forest-muted">{reading.spread}</span>
              <span className="text-forest-accent/30">|</span>
              <span className="text-xs text-forest-muted">{reading.cards.length}张牌</span>
            </div>
          </div>
          {!isPublicView && (onTogglePublic || onEdit || onDelete) && (
            <div className="flex items-center gap-1 shrink-0">
              {onTogglePublic && !reading.isExample && (
                <button
                  onClick={onTogglePublic}
                  className="p-2 hover:bg-forest-accent/5 rounded-lg transition-colors"
                  title={reading.isPublic ? '收回私人' : '公开到广场'}
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
                  className="p-2 hover:bg-forest-accent/5 rounded-lg transition-colors"
                  title="编辑"
                >
                  <BookOpen size={16} className="text-forest-accent" />
                </button>
              )}
              {onDelete && !reading.isExample && (
                <button
                  onClick={() => {
                    if (window.confirm('确定删除这条手记吗？')) onDelete();
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              )}
            </div>
          )}
        </div>

        {reading.authorName && reading.authorName !== '研习阁主' && (
          <button
            onClick={() => onAuthorClick?.(reading.authorName)}
            className="mt-3 flex items-center gap-2 text-xs text-forest-accent hover:text-forest-accent/80 transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-forest-accent to-forest-pink flex items-center justify-center text-white text-[10px] font-bold">
              {reading.authorName.charAt(0)}
            </span>
            <span className="font-medium">{reading.authorName}</span>
          </button>
        )}
      </div>

      {renderCards()}

      {reading.category && (
        <div className="px-4 py-2 border-t border-forest-accent/5 flex items-center gap-2">
          <span className="text-[10px] text-forest-muted">分类：</span>
          <span className="text-xs text-forest-accent font-medium">#{reading.category}</span>
        </div>
      )}

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-center gap-2 text-xs text-forest-muted hover:text-forest-accent hover:bg-forest-accent/5 transition-all"
      >
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span>{isExpanded ? '收起解读' : '查看解读'}</span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-forest-accent/5"
          >
            <div className="p-4 space-y-4">
              {reading.interpretation?.singleCard && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-forest-accent uppercase tracking-wider">单牌解读</h4>
                  <p className="text-sm text-forest-ink leading-relaxed">{reading.interpretation.singleCard}</p>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => copyToClipboard(`【塔罗研习阁】分享占卜案例：\n问题：${reading.question}\n牌阵：${reading.spread}\n\n来自于塔罗研习阁\n链接：${window.location.href}`)}
            className="flex flex-col items-center gap-2 p-3 bg-forest-accent/5 rounded-xl hover:bg-forest-accent/10 transition-all border border-forest-border"
          >
            <Copy size={18} className="text-forest-accent" />
            <span className="text-xs font-medium text-forest-accent">复制文案</span>
          </button>
          {navigator.share ? (
            <button
              onClick={handleSystemShare}
              className="flex flex-col items-center gap-2 p-3 bg-forest-accent/5 rounded-xl hover:bg-forest-accent/10 transition-all border border-forest-border"
            >
              <Share2 size={18} className="text-forest-accent" />
              <span className="text-xs font-medium text-forest-accent">分享</span>
            </button>
          ) : (
            <button
              onClick={() => copyToClipboard(window.location.href)}
              className="flex flex-col items-center gap-2 p-3 bg-forest-accent/5 rounded-xl hover:bg-forest-accent/10 transition-all border border-forest-border"
            >
              <ExternalLink size={18} className="text-forest-accent" />
              <span className="text-xs font-medium text-forest-accent">复制链接</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};