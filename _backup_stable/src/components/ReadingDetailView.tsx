import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Plus, FileText, ChevronDown } from 'lucide-react';
import { ReadingSlotData, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { CardNumerologyBadge } from './CardNumerologyBadge';

interface ReadingDetailViewProps {
  activeSlotIndex: number;
  cardSlots: ReadingSlotData[];
  cardMetadata: TarotCardMetadata[];
  cardInterpretations: string[];
  isLoggedIn: boolean;
  userId?: string;
  isMultiCard: boolean;
  isDailyMode: boolean;
  showCompReading: boolean;
  compReadingValue: string;
  onToggleReverse: (idx: number, e: React.MouseEvent) => void;
  onSetCardInterpretations: (interps: string[]) => void;
  onSetActiveSlotIndex: (idx: number) => void;
  onSetShowPicker: (show: boolean) => void;
  onUpdateCardSlotsWithHistory: (slots: ReadingSlotData[]) => void;
  onToggleShowCompReading: () => void;
  onSetCompReadingValue: (val: string) => void;
}

export const ReadingDetailView: React.FC<ReadingDetailViewProps> = ({
  activeSlotIndex,
  cardSlots,
  cardMetadata,
  cardInterpretations,
  isLoggedIn,
  userId,
  isMultiCard,
  isDailyMode,
  showCompReading,
  compReadingValue,
  onToggleReverse,
  onSetCardInterpretations,
  onSetActiveSlotIndex,
  onSetShowPicker,
  onUpdateCardSlotsWithHistory,
  onToggleShowCompReading,
  onSetCompReadingValue
}) => {
  const currentSlot = cardSlots[activeSlotIndex];
  if (!currentSlot?.name) return null;

  const cardData = TAROT_CARDS.find(c => c.name === currentSlot.name);

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
            className="w-24 sm:w-32 aspect-[2/3.5] rounded-xl overflow-hidden shadow-md ring-4 ring-white relative flex-shrink-0 cursor-pointer group/card-image" 
            onClick={(e) => onToggleReverse(activeSlotIndex, e)}
          >
            <img 
              src={getCardImageUrl(cardData?.id || 'ar00')} 
              alt={currentSlot.name} 
              className={`w-full h-full object-cover transition-transform ${currentSlot.isReversed ? 'rotate-180' : ''}`} 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 py-2 text-[10px] text-white font-bold bg-forest-accent/60 text-center opacity-0 group-hover/card-image:opacity-100 transition-opacity">
              点击翻转
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReverse(activeSlotIndex, e);
              }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-[10px] font-bold px-3 py-1 rounded-full shadow-sm hover:bg-white transition-colors"
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
                  {(() => {
                    const metadata = cardMetadata.find(m => m.name === currentSlot.name);
                    if (!metadata?.astrology) return null;
                    return (
                      <div className="flex gap-2 text-[10px] text-forest-muted">
                        {metadata.astrology.planet && <span className="bg-white px-2 py-0.5 rounded-md border border-forest-accent/5">行星: {metadata.astrology.planet}</span>}
                        {metadata.astrology.zodiac && <span className="bg-white px-2 py-0.5 rounded-md border border-forest-accent/5">星座: {metadata.astrology.zodiac}</span>}
                        {metadata.astrology.element && <span className="bg-white px-2 py-0.5 rounded-md border border-forest-accent/5">元素: {metadata.astrology.element}</span>}
                      </div>
                    );
                  })()}
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
                  placeholder={isDailyMode ? "记录今日运势感悟..." : `记录关于“${currentSlot.label || `位置 ${activeSlotIndex + 1}`}”的直觉与洞察...`} 
                  value={cardInterpretations[activeSlotIndex] || ''} 
                  onChange={e => {
                    const newInterps = [...cardInterpretations];
                    newInterps[activeSlotIndex] = e.target.value;
                    onSetCardInterpretations(newInterps);
                  }} 
                />
              </div>
            </div>

            {isMultiCard && (
              <div className="bg-white/50 p-3 rounded-xl border border-forest-accent/5">
                <button 
                  type="button"
                  onClick={onToggleShowCompReading}
                  className="w-full flex items-center justify-between text-[10px] font-bold text-forest-muted hover:text-forest-accent transition-colors"
                >
                  <span className="flex items-center gap-1.5"><FileText size={12} /> 📝 综合解读（可选）</span>
                  <ChevronDown size={12} className={`transition-transform ${showCompReading ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showCompReading && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-2">
                      <textarea 
                        rows={2} 
                        className="w-full px-3 py-2 bg-white border border-forest-accent/5 rounded-lg text-[11px] focus:ring-1 focus:ring-forest-accent/20" 
                        placeholder="对所有单牌的整体感悟..." 
                        value={compReadingValue} 
                        onChange={e => onSetCompReadingValue(e.target.value)} 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
