import React, { useState } from 'react';
import { Calendar, User, UserCheck, Share2, MessageSquare, Sparkles, Tag, Trash2, ChevronDown, ChevronUp, Eye, Layers, Lock, Unlock, Copy, ExternalLink, Download, X, Edit3 } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl, LAYOUT_TEMPLATES } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

interface ReadingCardProps {
  reading: TarotReading;
  onTogglePublic?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onTagClick?: (tag: string) => void;
  onAuthorClick?: (authorName: string) => void;
  onProcessAi?: (id: string) => void;
  isPublicView?: boolean;
  activeTags?: string[];
  cardMetadata?: TarotCardMetadata[];
}

export const ReadingCard: React.FC<ReadingCardProps> = ({ 
  reading, 
  onTogglePublic, 
  onDelete, 
  onEdit, 
  onTagClick, 
  onAuthorClick, 
  onProcessAi,
  isPublicView, 
  activeTags = [],
  cardMetadata = TAROT_CARDS
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSlotNumbers, setShowSlotNumbers] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleShare = () => {
    console.log("Share button clicked for reading:", reading.id);
    setShowShareModal(true);
  };

  const handleSystemShare = async () => {
    const shareText = `【塔罗研习阁】分享占卜案例：\n问题：${reading.question}\n牌阵：${reading.spread}\n\n来自于塔罗研习阁 - 邀请您开启智慧之旅，点击链接进入网页或下载App探索更多。`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '塔罗研习阁 - 占卜案例分享',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error("System share failed:", err);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const renderTags = (showCards = true) => (
    <div className="flex flex-wrap gap-1.5 items-center">
      {showCards && reading.cards.map((card, idx) => {
        const isActive = activeTags.includes(card.name);
        return (
          <span 
            key={`card-${idx}`}
            className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all whitespace-nowrap ${isActive ? 'bg-forest-accent text-white shadow-sm' : 'bg-forest-bg text-forest-text/70 hover:bg-forest-accent/10 hover:text-forest-accent'}`}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(card.name);
            }}
          >
            {card.name}
          </span>
        );
      })}
      {reading.keywords.map(tag => {
        const isActive = activeTags.includes(tag);
        // Clean tag if it contains "研习分类："
        const cleanTag = tag.replace('研习分类：', '').replace('塔罗', '');
        if (!cleanTag) return null;
        
        return (
          <span 
            key={`tag-${tag}`} 
            className={`text-[9px] px-2 py-0.5 rounded-full cursor-pointer transition-all font-medium whitespace-nowrap ${isActive ? 'bg-forest-accent text-white shadow-sm' : 'bg-forest-accent/5 text-forest-accent/70 hover:bg-forest-accent/10 hover:text-forest-accent'}`}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(tag);
            }}
          >
            #{cleanTag}
          </span>
        );
      })}
      {reading.category && (
        <span 
          className={`text-[9px] px-2 py-0.5 rounded-full cursor-pointer transition-all font-medium whitespace-nowrap ${activeTags.includes(reading.category) ? 'bg-forest-accent text-white shadow-sm' : 'bg-forest-accent/5 text-forest-accent/70 hover:bg-forest-accent/10 hover:text-forest-accent'}`}
          onClick={(e) => {
            e.stopPropagation();
            onTagClick?.(reading.category!);
          }}
        >
          #{reading.category}
        </span>
      )}
    </div>
  );

  const renderCards = (isMini = false) => {
    const layout = reading.layoutType ? (LAYOUT_TEMPLATES[reading.layoutType] || LAYOUT_TEMPLATES.horizontal) : null;
    const isCeltic = reading.layoutType === 'celtic-cross' || reading.spread === '凯尔特十字牌阵';

    const content = (
      <div className={`${reading.layoutType ? layout?.class : 'flex flex-wrap gap-4'}`}>
        {reading.cards.map((card, idx) => {
          const cardData = TAROT_CARDS.find(c => 
            c.name === card.name || 
            c.english === card.name || 
            c.id === card.name
          );
          const posClass = reading.slotPositions?.[idx] || layout?.itemClasses[idx] || '';
          const label = reading.slotLabels?.[idx];
          
          // Special handling for Celtic Cross center cards or custom rotated slots
          const isRotated = reading.rotatedSlots?.includes(idx) || (isCeltic && idx === 1);
          const celticCrossedClasses = isRotated ? 'absolute inset-0 rotate-90 z-20 translate-y-1' : '';

          return (
            <div 
              key={idx} 
              className={`flex flex-col items-center gap-1.5 ${posClass} ${isRotated ? 'relative' : ''} cursor-pointer group/card`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCardIdx(selectedCardIdx === idx ? null : idx);
              }}
            >
              <div className={`relative ${isMini ? 'w-12 h-18' : 'w-16 h-24'} rounded-lg overflow-hidden border-2 transition-all ${selectedCardIdx === idx ? 'border-forest-accent ring-4 ring-forest-accent/10 scale-105' : 'border-forest-accent/10 group-hover/card:border-forest-accent/30'} shadow-sm ${card.isReversed ? 'rotate-180' : ''} ${celticCrossedClasses}`}>
                {showSlotNumbers && !isMini && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/40 text-white text-[8px] px-1 rounded-sm z-20 font-black">
                    {idx + 1}
                  </div>
                )}
                <img 
                  src={getCardImageUrl(cardData?.id || 'ar00')} 
                  alt={card.name}
                  className="w-full h-full object-contain bg-forest-bg"
                  referrerPolicy="no-referrer"
                />
                {!isMini && (
                  <div className="absolute inset-x-0 bottom-0 bg-forest-text/60 text-white text-[7px] py-0.5 text-center font-sans">
                    {cardData?.name || card.name}
                  </div>
                )}
              </div>
              {!isMini && label && (
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded leading-tight transition-colors ${selectedCardIdx === idx ? 'bg-forest-accent text-white' : 'text-forest-accent bg-forest-accent/5'}`}>
                  {label}
                </span>
              )}
              {!isMini && card.isReversed && !label && <span className="text-[9px] text-red-500">逆位</span>}
            </div>
          );
        })}
      </div>
    );

    if (isMini) {
      return (
        <div className="w-full flex-1 overflow-hidden relative rounded-[2rem] bg-forest-bg/40 p-4 border-2 border-forest-border/40 group-hover/viz:bg-forest-bg/60 transition-all duration-500 min-h-[220px] flex items-center justify-center">
          <div className="scale-[1.6] sm:scale-[1.8] transform-gpu transition-all duration-700 group-hover/viz:scale-[1.7] group-hover/viz:rotate-2">
            {content}
          </div>
        </div>
      );
    }

    return <div className="mb-6">{content}</div>;
  };

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`bg-white rounded-[2rem] border border-forest-accent/10 hover:border-forest-accent/30 transition-all overflow-hidden cursor-pointer active:scale-[0.99] group/card-main ${isExpanded ? 'p-6 sm:p-8 shadow-2xl' : 'p-5 shadow-sm hover:shadow-lg'}`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] text-forest-muted mb-2 font-bold uppercase tracking-wider opacity-60">
            <Calendar size={10} className="shrink-0" />
            <span>
              {reading.readingDate ? new Date(reading.readingDate).toLocaleString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
              }) : new Date(reading.date).toLocaleDateString()}
            </span>
            {isPublicView && (
              <>
                <span className="mx-1 opacity-20">|</span>
                <User size={10} className="shrink-0" />
                <span className="truncate">
                  {reading.isAnonymous ? '匿名研习者' : reading.authorName || '神秘人'}
                </span>
              </>
            )}
            {reading.isForClient && !isPublicView && (
              <>
                <span className="mx-1 opacity-20">|</span>
                <span className="text-forest-accent font-black">客户: {reading.clientName}</span>
              </>
            )}
          </div>
          <h3 className={`${isExpanded ? 'text-2xl sm:text-3xl font-bold' : 'text-lg'} font-serif text-forest-ink leading-tight transition-all`}>
            {reading.question}
            {reading.isExample && (
              <span className="ml-3 px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[9px] font-black uppercase tracking-tighter">案例</span>
            )}
          </h3>
          
          {!isExpanded && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-forest-ink/60 font-medium">
              {reading.cards.map((card, idx) => (
                <React.Fragment key={idx}>
                  <span>
                    {card.name}{card.isReversed ? ' (逆位)' : ''}
                  </span>
                  {idx < reading.cards.length - 1 && <span className="opacity-20 mx-0.5">·</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0 bg-forest-bg/50 p-1.5 rounded-2xl border border-forest-border shadow-inner">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="p-2 rounded-xl text-forest-muted hover:text-forest-accent hover:bg-white transition-all"
            title="分享"
          >
            <Share2 size={16} />
          </button>
          {!isPublicView && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="p-2 rounded-xl text-forest-muted hover:text-forest-accent hover:bg-white transition-all shadow-sm shadow-transparent hover:shadow-black/5"
              title="编辑"
            >
              <Edit3 size={16} />
            </button>
          )}
          <div 
            className="p-2 rounded-xl text-forest-accent transition-transform group-hover/card-main:translate-y-0.5"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {isExpanded && !reading.isAiProcessed && !reading.skipAi && onProcessAi && (
        <div className="mt-4 p-4 bg-forest-accent/5 rounded-2xl border border-dashed border-forest-accent/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-accent/10 flex items-center justify-center text-forest-accent">
              <Sparkles size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-forest-text">AI 深度解析</p>
              <p className="text-xs text-forest-muted">基于您的心得，自动识别牌面并提取关键词</p>
            </div>
          </div>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              setIsAiLoading(true);
              await onProcessAi(reading.id);
              setIsAiLoading(false);
            }}
            disabled={isAiLoading}
            className="w-full sm:w-auto px-6 py-2 bg-forest-pink text-white rounded-xl text-sm font-bold shadow-lg shadow-forest-pink/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isAiLoading ? '解析中...' : '立即解析'}
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in zoom-in-95 duration-200">
          <span className="text-xs text-red-500 font-medium">确定要删除这条记录吗？</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              className="flex-1 sm:flex-none px-3 py-1 text-[10px] bg-white text-forest-muted rounded border border-forest-border hover:bg-forest-bg"
            >
              取消
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
                setShowDeleteConfirm(false);
              }}
              className="flex-1 sm:flex-none px-3 py-1 text-[10px] bg-red-500 text-white rounded hover:bg-red-600"
            >
              确认删除
            </button>
          </div>
        </div>
      )}

      {!isExpanded && (
        <div className="mt-8 flex flex-col gap-6">
          <div className="relative p-2 sm:p-4 bg-forest-bg/10 rounded-[3rem] border-2 border-forest-accent/5 border-dashed overflow-hidden flex flex-col items-center justify-center min-h-[260px] group/viz">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover/viz:opacity-100 transition-opacity duration-700" />
            
            {renderCards(true)}
            
            <div className="absolute bottom-4 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-[10px] text-forest-accent font-black tracking-widest uppercase opacity-0 group-hover/viz:opacity-100 transition-all transform translate-y-2 group-hover/viz:translate-y-0">
              点击展开详情
            </div>
          </div>
          
          <div className="pt-6 border-t border-forest-accent/5">
            {renderTags(false)}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-5 w-1 bg-forest-accent rounded-full" />
            <h4 className="text-lg font-serif font-bold text-forest-ink">灵见手帖</h4>
          </div>
          {/* Cards Visuals */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] font-black text-forest-accent uppercase tracking-widest flex items-center gap-1.5">
              <Layers size={14} /> 灵见位阶
            </span>
            <span className="text-[10px] text-forest-muted/60 flex items-center gap-1 font-medium"><Sparkles size={10} /> 点击牌面查看单牌解读</span>
          </div>
          <div className="p-6 sm:p-10 bg-forest-bg/30 rounded-[2.5rem] border-2 border-forest-border border-dashed mb-8 relative overflow-hidden group/visuals">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/visuals:opacity-100 transition-opacity" />
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              {renderCards(false)}
            </div>
          </div>

          <AnimatePresence>
            {selectedCardIdx !== null && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-forest-accent/5 rounded-2xl border border-forest-accent/10 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-forest-accent" />
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-forest-accent uppercase tracking-wider">
                      {reading.slotLabels?.[selectedCardIdx] || `位置 ${selectedCardIdx + 1}`} · {reading.cards[selectedCardIdx].name}{reading.cards[selectedCardIdx].isReversed ? ' (逆位)' : ' (正位)'}
                    </span>
                    {(() => {
                      const metadata = cardMetadata.find(m => m.name === reading.cards[selectedCardIdx].name);
                      if (!metadata?.astrology) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {metadata.astrology.planet && <span className="text-[9px] px-1.5 py-0.5 bg-forest-bg rounded border border-forest-border text-forest-muted">行星: {metadata.astrology.planet}</span>}
                          {metadata.astrology.zodiac && <span className="text-[9px] px-1.5 py-0.5 bg-forest-bg rounded border border-forest-border text-forest-muted">星座: {metadata.astrology.zodiac}</span>}
                          {metadata.astrology.element && <span className="text-[9px] px-1.5 py-0.5 bg-forest-bg rounded border border-forest-border text-forest-muted">元素: {metadata.astrology.element}</span>}
                          {metadata.astrology.house && <span className="text-[9px] px-1.5 py-0.5 bg-forest-bg rounded border border-forest-border text-forest-muted">宫位: {metadata.astrology.house}</span>}
                        </div>
                      );
                    })()}
                  </div>
                  <button onClick={() => setSelectedCardIdx(null)} className="text-forest-muted hover:text-forest-accent transition-colors">
                    <X size={12} />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-forest-text/90 leading-relaxed italic">
                  {reading.cardInterpretations?.[selectedCardIdx] || '暂无针对此牌的独立解读。'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4 text-sm text-forest-text/80 leading-relaxed">
            <div>
              <span className="font-serif font-bold block text-forest-accent mb-1">单牌解读</span>
              <p className="text-xs sm:text-sm">{reading.interpretation.singleCard}</p>
            </div>
            <div>
              <span className="font-serif font-bold block text-forest-accent mb-1">组合解读</span>
              <p className="text-xs sm:text-sm">{reading.interpretation.combination}</p>
            </div>
            
            {reading.clientFeedback && !isPublicView && (
              <div className="mt-4 p-3 bg-forest-bg rounded-lg border-l-4 border-forest-accent/30 italic">
                <span className="flex items-center gap-2 text-xs text-forest-muted mb-1 font-sans not-italic">
                  <MessageSquare size={12} /> 客户反馈
                </span>
                <p className="text-xs sm:text-sm">"{reading.clientFeedback}"</p>
              </div>
            )}

            {reading.userFeedback && !isPublicView && (
              <div className="mt-4 p-3 bg-forest-accent/5 rounded-lg border-l-4 border-forest-accent/50 italic">
                <span className="flex items-center gap-2 text-xs text-forest-muted mb-1 font-sans not-italic">
                  <Sparkles size={12} /> 我的反馈/复盘
                </span>
                <p className="text-xs sm:text-sm">"{reading.userFeedback}"</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-forest-border">
            {renderTags(false)}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-serif text-forest-accent flex items-center gap-2">
                  <Share2 size={20} /> 分享占卜案例
                </h3>
                <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-forest-bg rounded-full transition-colors">
                  <X size={20} className="text-forest-muted" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-forest-bg rounded-2xl border border-forest-border space-y-2">
                  <p className="text-xs text-forest-muted font-bold uppercase tracking-wider">分享文案</p>
                  <p className="text-sm text-forest-text/80 leading-relaxed">
                    【塔罗研习阁】分享占卜案例：<br/>
                    问题：{reading.question}<br/>
                    牌阵：{reading.spread}<br/><br/>
                    来自于塔罗研习阁 - 邀请您开启智慧之旅，点击链接进入网页或下载App探索更多。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => copyToClipboard(`【塔罗研习阁】分享占卜案例：\n问题：${reading.question}\n牌阵：${reading.spread}\n\n来自于塔罗研习阁 - 邀请您开启智慧之旅，点击链接进入网页或下载App探索更多。\n链接：${window.location.href}`)}
                    className="flex flex-col items-center gap-2 p-4 bg-forest-accent/5 rounded-2xl hover:bg-forest-accent/10 transition-all border border-forest-border"
                  >
                    <Copy size={20} className="text-forest-accent" />
                    <span className="text-xs font-medium text-forest-accent">{copySuccess ? '已复制' : '复制文案'}</span>
                  </button>
                  {navigator.share ? (
                    <button 
                      onClick={handleSystemShare}
                      className="flex flex-col items-center gap-2 p-4 bg-forest-accent/5 rounded-2xl hover:bg-forest-accent/10 transition-all border border-forest-border"
                    >
                      <Share2 size={20} className="text-forest-accent" />
                      <span className="text-xs font-medium text-forest-accent">系统分享</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => copyToClipboard(window.location.href)}
                      className="flex flex-col items-center gap-2 p-4 bg-forest-accent/5 rounded-2xl hover:bg-forest-accent/10 transition-all border border-forest-border"
                    >
                      <ExternalLink size={20} className="text-forest-accent" />
                      <span className="text-xs font-medium text-forest-accent">复制链接</span>
                    </button>
                  )}
                </div>

                <div className="p-4 bg-forest-accent/5 rounded-2xl border border-dashed border-forest-accent/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Download size={20} className="text-forest-accent" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-forest-accent">下载官方 App</p>
                      <p className="text-[10px] text-forest-muted">随时随地开启智慧之旅</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-forest-accent text-white text-[10px] rounded-full font-bold">去下载</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
