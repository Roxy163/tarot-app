import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RefreshCw, Copy, Share2, ChevronDown, ChevronUp, BookOpen, ExternalLink, Trash2, Lock, Sparkles, Check, Loader2 } from 'lucide-react';
import { ReadingKeywordCandidate, TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl, LAYOUT_TEMPLATES } from '../constants';

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
}

export const ReadingCard: React.FC<ReadingCardProps> = ({
  reading,
  cardMetadata,
  onEdit,
  onTagClick,
  activeTags,
  onAuthorClick,
  onProcessAi,
  onExtractKeywordCandidates,
  onConfirmKeywordCandidates,
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
  const [keywordCandidates, setKeywordCandidates] = useState<ReadingKeywordCandidate[]>([]);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [showKeywordReview, setShowKeywordReview] = useState(false);
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  const [keywordNotice, setKeywordNotice] = useState('');
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

  const canReviewKeywords = !isPublicView && !reading.isExample && !!onExtractKeywordCandidates && !!onConfirmKeywordCandidates;

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

              {canReviewKeywords && (
                <div className="rounded-2xl border border-forest-accent/10 bg-forest-accent/5 p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-forest-accent flex items-center gap-1.5">
                        <Sparkles size={13} />
                        个人关键词
                      </h4>
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
