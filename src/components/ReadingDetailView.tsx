import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, HelpCircle, Loader2, RotateCcw, Plus, FileText, Sparkles } from 'lucide-react';
import { AiInspirationMode, CardKeywordMemory, ReadingSlotData, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { getAnnotationByCardId } from '../constants/cardAnnotations';
import { CardNumerologyBadge } from './CardNumerologyBadge';
import { suggestAiInspiration } from '../services/geminiService';

interface ReadingDetailViewProps {
  activeSlotIndex: number;
  cardSlots: ReadingSlotData[];
  cardMetadata: TarotCardMetadata[];
  cardKeywordMemory?: CardKeywordMemory[];
  cardInterpretations: string[];
  question: string;
  spread: string;
  category?: string;
  combinationContext?: string;
  isLoggedIn: boolean;
  userId?: string;
  isMultiCard: boolean;
  isDailyMode: boolean;
  onToggleReverse: (idx: number, e: React.MouseEvent) => void;
  onSetCardInterpretations: (interps: string[]) => void;
  onSetActiveSlotIndex: (idx: number) => void;
  onSetShowPicker: (show: boolean) => void;
  onUpdateCardSlotsWithHistory: (slots: ReadingSlotData[]) => void;
}

export const ReadingDetailView: React.FC<ReadingDetailViewProps> = ({
  activeSlotIndex,
  cardSlots,
  cardMetadata,
  cardKeywordMemory = [],
  cardInterpretations,
  question,
  spread,
  category,
  combinationContext,
  isLoggedIn,
  userId,
  isMultiCard,
  isDailyMode,
  onToggleReverse,
  onSetCardInterpretations,
  onSetActiveSlotIndex,
  onSetShowPicker,
  onUpdateCardSlotsWithHistory
}) => {
  const [inspirationMode, setInspirationMode] = useState<AiInspirationMode>('angle');
  const [inspirationItems, setInspirationItems] = useState<string[]>([]);
  const [isInspirationLoading, setIsInspirationLoading] = useState(false);
  const [inspirationNotice, setInspirationNotice] = useState('');
  const currentSlot = cardSlots[activeSlotIndex];

  useEffect(() => {
    setInspirationItems([]);
    setInspirationNotice('');
  }, [activeSlotIndex, currentSlot?.name, currentSlot?.isReversed]);

  if (!currentSlot?.name) return null;

  const cardData = TAROT_CARDS.find(c => c.name === currentSlot.name);
  const officialAnnotation = cardData ? getAnnotationByCardId(cardData.id) : undefined;
  const currentMetadata = cardMetadata.find(m => m.name === currentSlot.name);
  const cardCorrespondence = {
    planet: officialAnnotation?.planet || currentMetadata?.astrology?.planet,
    zodiac: officialAnnotation?.zodiac || currentMetadata?.astrology?.zodiac,
    house: officialAnnotation?.house,
    element: officialAnnotation?.element || currentMetadata?.astrology?.element,
  };
  const personalKeywords = cardKeywordMemory
    .find(item => item.cardName === currentSlot.name)
    ?.keywords
    .slice(0, 8)
    .map(item => item.keyword) || [];
  const currentSlotLabel = currentSlot.label || `位置 ${activeSlotIndex + 1}`;
  const correspondenceBadgeClass = 'text-[9px] text-forest-muted bg-forest-bg px-1 rounded border border-forest-accent/5 font-bold';
  const cardAtmosphereHint = [
    cardCorrespondence.element,
    cardCorrespondence.planet || cardCorrespondence.zodiac,
  ].filter(Boolean).join(' / ');
  const cardKeywordHint = (officialAnnotation?.keywords || currentMetadata?.keywords || []).slice(0, 2).join(' / ');
  const inspirationModes: { id: AiInspirationMode; label: string; icon: React.ElementType }[] = [
    { id: 'angle', label: '切入点', icon: Sparkles },
    { id: 'questions', label: '自我提问', icon: HelpCircle },
    { id: 'shadow', label: '反向视角', icon: RotateCcw },
  ];

  const updateActiveInterpretation = (value: string) => {
    const newInterps = [...cardInterpretations];
    newInterps[activeSlotIndex] = value;
    onSetCardInterpretations(newInterps);
  };

  const handleAskInspiration = async (mode = inspirationMode) => {
    setInspirationMode(mode);
    setIsInspirationLoading(true);
    setInspirationNotice('');
    try {
      const suggestions = await suggestAiInspiration({
        cardName: currentSlot.name,
        isReversed: currentSlot.isReversed,
        slotLabel: currentSlotLabel,
        question,
        spread,
        category,
        currentInsight: cardInterpretations[activeSlotIndex] || '',
        combinationContext,
        personalKeywords,
        cardKeywords: officialAnnotation?.keywords || currentMetadata?.keywords,
        cardCorrespondences: [
          cardCorrespondence.planet && `行星: ${cardCorrespondence.planet}`,
          cardCorrespondence.zodiac && `星座: ${cardCorrespondence.zodiac}`,
          cardCorrespondence.house && `宫位: ${cardCorrespondence.house}`,
          cardCorrespondence.element && `元素: ${cardCorrespondence.element}`,
        ].filter(Boolean) as string[],
        cardMeaning: officialAnnotation?.uprightMeaning || currentMetadata?.meaning,
        reversedMeaning: officialAnnotation?.reversedMeaning || currentMetadata?.reversedMeaning,
        mode
      });
      setInspirationItems(suggestions);
      if (suggestions.length === 0) setInspirationNotice('暂时没有生成灵感，可以换个模式再试。');
    } catch (error) {
      console.error('Failed to load AI inspiration:', error);
      setInspirationNotice('灵感暂时没有回应，可以稍后再试。');
    } finally {
      setIsInspirationLoading(false);
    }
  };

  const adoptInspiration = (item: string) => {
    const current = cardInterpretations[activeSlotIndex] || '';
    updateActiveInterpretation(current ? `${current}\n${item}` : item);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={activeSlotIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="p-4 bg-forest-accent/5 rounded-2xl border border-forest-accent/10 relative group"
      >
        <div className="flex flex-col sm:flex-row gap-6">
          <div
            className="w-28 sm:w-36 aspect-[2/3.5] mx-auto sm:mx-0 rounded-2xl overflow-hidden shadow-md ring-4 ring-white bg-forest-bg relative flex-shrink-0 cursor-pointer group/card-image"
            onClick={(e) => onToggleReverse(activeSlotIndex, e)}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-80"
              style={{
                backgroundImage: 'radial-gradient(circle at 18% 16%, rgba(127, 172, 133, 0.18) 0 2px, transparent 2px), radial-gradient(circle at 82% 84%, rgba(127, 172, 133, 0.14) 0 2px, transparent 2px), linear-gradient(135deg, rgba(255,255,255,0.92), rgba(239,245,236,0.9))',
                backgroundSize: '18px 18px, 22px 22px, 100% 100%',
              }}
            />
            {cardKeywordHint && (
              <div className="absolute inset-x-3 top-3 z-0 text-center text-[9px] font-bold text-forest-accent/35 leading-tight">
                {cardKeywordHint}
              </div>
            )}
            {cardAtmosphereHint && (
              <div className="absolute inset-x-3 bottom-10 z-0 text-center text-[9px] font-bold text-forest-accent/35 leading-tight">
                {cardAtmosphereHint}
              </div>
            )}
            <img
              src={getCardImageUrl(cardData?.id || 'ar00')}
              alt={currentSlot.name}
              className={`relative z-10 w-full h-full object-contain object-center transition-transform duration-300 ${currentSlot.isReversed ? 'rotate-180' : ''}`}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 z-20 py-2 text-[10px] text-white font-bold bg-forest-accent/60 text-center opacity-0 group-hover/card-image:opacity-100 transition-opacity">
              点击翻转
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReverse(activeSlotIndex, e);
              }}
              className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-[10px] font-bold px-3 py-1 rounded-full shadow-sm hover:bg-white transition-colors"
            >
              {currentSlot.isReversed ? '逆位' : '正位'}
            </button>
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-serif font-bold text-forest-accent flex items-center gap-2">
                  {currentSlot.name}
                  <button 
                    type="button" 
                    onClick={(e) => onToggleReverse(activeSlotIndex, e)}
                    className={`text-xs font-sans px-2 py-0.5 rounded-full cursor-pointer hover:scale-110 active:scale-95 transition-all ${currentSlot.isReversed ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}
                  >
                    {currentSlot.isReversed ? '逆' : '正'}
                  </button>
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CardNumerologyBadge cardName={currentSlot.name} isLoggedIn={isLoggedIn} userId={userId} />
                  {(cardCorrespondence.planet || cardCorrespondence.zodiac || cardCorrespondence.house || cardCorrespondence.element) && (
                    <div className="flex flex-wrap gap-2">
                      {cardCorrespondence.planet && <span className={correspondenceBadgeClass}>行星: {cardCorrespondence.planet}</span>}
                      {cardCorrespondence.zodiac && <span className={correspondenceBadgeClass}>星座: {cardCorrespondence.zodiac}</span>}
                      {cardCorrespondence.house && <span className={correspondenceBadgeClass}>宫位: {cardCorrespondence.house}</span>}
                      {cardCorrespondence.element && <span className={correspondenceBadgeClass}>元素: {cardCorrespondence.element}</span>}
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                type="button" 
                onClick={() => {
                  const unused = TAROT_CARDS.filter(c => !cardSlots.some(s => s.name === c.name));
                  const random = unused[Math.floor(Math.random() * unused.length)];
                  const newSlots = [...cardSlots];
                  newSlots[activeSlotIndex] = { ...newSlots[activeSlotIndex], name: random.name };
                  onUpdateCardSlotsWithHistory(newSlots);
                }}
                className="p-2 bg-white text-forest-muted hover:text-forest-accent rounded-full border border-forest-accent/10 transition-all hover:rotate-180 duration-500 shadow-sm"
                title="随机换牌"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={(e) => onToggleReverse(activeSlotIndex, e)}
                  className="flex items-center gap-2 px-4 py-2 bg-forest-accent text-white rounded-xl text-xs font-bold shadow-md hover:bg-forest-accent/90 active:scale-95 transition-all"
                >
                  <RotateCcw size={14} /> 一键翻转正逆位
                </button>
                <button 
                  type="button" 
                  onClick={() => onSetShowPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-forest-accent border border-forest-accent/20 rounded-xl text-xs font-bold shadow-sm hover:bg-forest-accent/5 active:scale-95 transition-all"
                >
                  <Plus size={14} /> 重新选牌
                </button>
              </div>

              {isMultiCard && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-forest-muted uppercase tracking-wider">
                      <Plus size={12} />
                      <span>正在解读：{currentSlot.label || `位置 ${activeSlotIndex + 1}`}</span>
                    </div>
                    <span className="text-[9px] text-forest-muted opacity-60">点击下方标签快速切换</span>
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-hide bg-forest-accent/5 p-1 rounded-xl border border-forest-accent/5">
                    {cardSlots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSetActiveSlotIndex(i)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeSlotIndex === i ? 'bg-forest-accent text-white shadow-sm' : 'text-forest-muted hover:bg-white hover:text-forest-accent'}`}
                      >
                        <span className="opacity-60">{i + 1}.</span>
                        {slot.label || `位置 ${i + 1}`}
                        {cardInterpretations[i] && <div className={`w-1 h-1 rounded-full ${activeSlotIndex === i ? 'bg-white' : 'bg-forest-accent'}`} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative group">
                <div className="flex items-center gap-2 text-xs font-bold text-forest-muted uppercase tracking-wider mb-2">
                  <FileText size={14} />
                  灵见注疏
                </div>
                <textarea 
                  required
                  rows={4} 
                  className="w-full px-4 py-3 bg-white border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all text-sm shadow-inner" 
                  placeholder={isDailyMode ? "记录今天这张牌与你生活的对应..." : `记录关于“${currentSlot.label || `位置 ${activeSlotIndex + 1}`}”的直觉与洞察...`}
                  value={cardInterpretations[activeSlotIndex] || ''} 
                  onChange={e => updateActiveInterpretation(e.target.value)}
                />
              </div>

              <div className="rounded-2xl bg-white/70 border border-forest-accent/10 p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {inspirationModes.map(mode => {
                      const Icon = mode.icon;
                      const selected = inspirationMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => handleAskInspiration(mode.id)}
                          disabled={isInspirationLoading}
                          className={`min-h-11 px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            selected
                              ? 'bg-forest-accent text-white border-forest-accent shadow-sm'
                              : 'bg-white text-forest-muted border-forest-accent/10 hover:text-forest-accent hover:border-forest-accent/30'
                          }`}
                        >
                          <Icon size={14} />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAskInspiration()}
                    disabled={isInspirationLoading}
                    className="min-h-11 px-4 py-2 rounded-xl bg-forest-pink text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-forest-pink/90 disabled:opacity-60 transition-colors"
                  >
                    {isInspirationLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    AI 灵感
                  </button>
                </div>

                {personalKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {personalKeywords.slice(0, 5).map(keyword => (
                      <span key={keyword} className="text-[9px] px-2 py-0.5 rounded-full bg-forest-accent/5 text-forest-accent border border-forest-accent/10">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 text-[9px] text-forest-muted">
                  <span className="px-2 py-0.5 rounded-full bg-forest-accent/5 border border-forest-accent/10">依据: 系统牌义注解</span>
                  <span className="px-2 py-0.5 rounded-full bg-forest-accent/5 border border-forest-accent/10">正逆位含义</span>
                  <span className="px-2 py-0.5 rounded-full bg-forest-accent/5 border border-forest-accent/10">关键词与对应关系</span>
                  {personalKeywords.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-forest-accent/5 border border-forest-accent/10">个人高频词</span>
                  )}
                </div>

                <AnimatePresence>
                  {(inspirationItems.length > 0 || inspirationNotice) && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="space-y-2"
                    >
                      {inspirationNotice && (
                        <p className="text-[10px] text-forest-muted">{inspirationNotice}</p>
                      )}
                      {inspirationItems.map((item, index) => (
                        <div key={`${item}-${index}`} className="flex items-start gap-2 rounded-xl bg-white border border-forest-accent/10 p-3">
                          <p className="flex-1 text-xs text-forest-ink leading-relaxed">{item}</p>
                          <button
                            type="button"
                            onClick={() => adoptInspiration(item)}
                            className="min-h-11 px-3 py-2 rounded-xl bg-forest-accent/5 text-forest-accent text-[10px] font-bold flex items-center gap-1 hover:bg-forest-accent/10 transition-colors"
                          >
                            <Check size={12} />
                            采纳
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
