import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, RotateCcw, Plus, FileText } from 'lucide-react';
import { ReadingSlotData, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { getAnnotationByCardId } from '../constants/cardAnnotations';
import { CardNumerologyBadge } from './CardNumerologyBadge';
import { TarotCardImage } from './TarotCardImage';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';

interface ReadingDetailViewProps {
  activeSlotIndex: number;
  cardSlots: ReadingSlotData[];
  cardMetadata: TarotCardMetadata[];
  cardInterpretations: string[];
  cardQuestions: string[];
  isLoggedIn: boolean;
  userId?: string;
  isMultiCard: boolean;
  isDailyMode: boolean;
  onToggleReverse: (idx: number, e: React.MouseEvent) => void;
  onSetCardInterpretations: (interps: string[]) => void;
  onSetCardQuestions: (questions: string[]) => void;
  onSetActiveSlotIndex: (idx: number) => void;
  onSetShowPicker: (show: boolean) => void;
  onUpdateCardSlotsWithHistory: (slots: ReadingSlotData[]) => void;
  hasInterpretationError?: boolean;
}

export const ReadingDetailView: React.FC<ReadingDetailViewProps> = ({
  activeSlotIndex,
  cardSlots,
  cardMetadata,
  cardInterpretations,
  cardQuestions,
  isLoggedIn,
  userId,
  isMultiCard,
  isDailyMode,
  onToggleReverse,
  onSetCardInterpretations,
  onSetCardQuestions,
  onSetActiveSlotIndex,
  onSetShowPicker,
  onUpdateCardSlotsWithHistory,
  hasInterpretationError = false
}) => {
  const currentSlot = cardSlots[activeSlotIndex];

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
  const currentSlotLabel = currentSlot.label || `位置 ${activeSlotIndex + 1}`;
  const correspondenceBadgeClass = 'text-[9px] text-forest-muted bg-forest-bg px-1 rounded border border-forest-accent/5 font-bold';
  const cardAtmosphereHint = [
    cardCorrespondence.element,
    cardCorrespondence.planet || cardCorrespondence.zodiac,
  ].filter(Boolean).join(' / ');
  const cardKeywordHint = (officialAnnotation?.keywords || currentMetadata?.keywords || []).slice(0, 2).join(' / ');
  const scrollFocusedFieldIntoView = (event: React.FocusEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = event.currentTarget;

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  };

  const updateActiveInterpretation = (value: string) => {
    const newInterps = [...cardInterpretations];
    newInterps[activeSlotIndex] = value;
    onSetCardInterpretations(newInterps);
  };

  const updateActiveQuestion = (value: string) => {
    const newQuestions = [...cardQuestions];
    newQuestions[activeSlotIndex] = value;
    onSetCardQuestions(newQuestions);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeSlotIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="relative rounded-2xl border border-forest-accent/10 bg-forest-accent/5 p-3 sm:p-4"
      >
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5">
          <div className="relative aspect-[2/3.5] w-full shrink-0 overflow-hidden rounded-xl bg-forest-bg shadow-sm ring-2 ring-white sm:rounded-2xl sm:shadow-md sm:ring-4">
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
            <TarotCardImage
              src={getCardImageUrl(cardData?.id || 'ar00')}
              alt={currentSlot.name}
              name={currentSlot.name}
              className={`relative z-10 w-full h-full object-contain object-center transition-transform duration-300 ${currentSlot.isReversed ? 'rotate-180' : ''}`}
            />
            <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
              {currentSlot.isReversed ? '逆位' : '正位'}
            </div>
          </div>

          <div className="min-w-0 space-y-2 sm:space-y-3">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-forest-muted sm:hidden">
                  {currentSlotLabel}
                </p>
                <h3 className="flex min-w-0 items-center gap-2 font-serif text-lg font-bold text-forest-accent sm:text-xl">
                  <span className="truncate">{currentSlot.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-xs ${currentSlot.isReversed ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    {currentSlot.isReversed ? '逆' : '正'}
                  </span>
                </h3>
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
                className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-forest-accent/10 bg-white px-3 text-forest-muted shadow-sm transition-all hover:text-forest-accent active:scale-95"
                title="随机换牌"
                aria-label="随机换牌"
              >
                <RotateCcw size={15} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <CardNumerologyBadge cardName={currentSlot.name} isLoggedIn={isLoggedIn} userId={userId} />
              {(cardCorrespondence.planet || cardCorrespondence.zodiac || cardCorrespondence.house || cardCorrespondence.element) && (
                <>
                  {cardCorrespondence.planet && <span className={correspondenceBadgeClass}>行星: {cardCorrespondence.planet}</span>}
                  {cardCorrespondence.zodiac && <span className={correspondenceBadgeClass}>星座: {cardCorrespondence.zodiac}</span>}
                  {cardCorrespondence.house && <span className={correspondenceBadgeClass}>宫位: {cardCorrespondence.house}</span>}
                  {cardCorrespondence.element && <span className={correspondenceBadgeClass}>元素: {cardCorrespondence.element}</span>}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                type="button"
                onClick={(e) => onToggleReverse(activeSlotIndex, e)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-accent px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-forest-accent/90 active:scale-95 sm:px-4"
              >
                <RotateCcw size={14} /> 正逆位
              </button>
              <button
                type="button"
                onClick={() => onSetShowPicker(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest-accent/20 bg-white px-3 py-2 text-xs font-bold text-forest-accent shadow-sm transition-all hover:bg-forest-accent/5 active:scale-95 sm:px-4"
              >
                <Plus size={14} /> 重新选牌
              </button>
            </div>
          </div>

          <div className="col-span-2 space-y-3 sm:col-span-1 sm:col-start-2">
            {isMultiCard && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-forest-muted">
                    <Plus size={12} />
                    <span>正在解读：{currentSlot.label || `位置 ${activeSlotIndex + 1}`}</span>
                  </div>
                  <span className="hidden text-[9px] text-forest-muted opacity-60 sm:inline">点击下方标签快速切换</span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-forest-accent/5 bg-forest-accent/5 p-1 custom-scrollbar-hide">
                  {cardSlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSetActiveSlotIndex(i)}
                      className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold whitespace-nowrap transition-all ${activeSlotIndex === i ? 'bg-forest-accent text-white shadow-sm' : 'text-forest-muted hover:bg-white hover:text-forest-accent'}`}
                    >
                      <span className="opacity-60">{i + 1}.</span>
                      {slot.label || `位置 ${i + 1}`}
                      {(cardInterpretations[i] || cardQuestions[i]) && <div className={`h-1 w-1 rounded-full ${activeSlotIndex === i ? 'bg-white' : 'bg-forest-accent'}`} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative group">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-forest-muted">
                <FileText size={14} />
                灵见注疏
              </div>
              <AutoResizeTextarea
                data-required-field="card-interpretation"
                aria-invalid={hasInterpretationError}
                minRows={1.5}
                maxRows={9}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm shadow-inner transition-all focus:ring-2 sm:px-4 sm:py-3 ${
                  hasInterpretationError
                    ? 'border-forest-pink/35 bg-forest-pink/6 ring-2 ring-forest-pink/10 focus:ring-forest-pink/15'
                    : 'border-forest-accent/10 bg-white focus:ring-forest-accent/20'
                }`}
                placeholder={isDailyMode ? "记录今天这张牌与你生活的对应..." : `记录关于“${currentSlot.label || `位置 ${activeSlotIndex + 1}`}”的直觉与洞察...`}
                value={cardInterpretations[activeSlotIndex] || ''}
                onFocus={scrollFocusedFieldIntoView}
                onChange={e => updateActiveInterpretation(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-forest-accent/8 bg-white/46 p-2.5 sm:p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-forest-accent">
                  <HelpCircle size={14} />
                  牌面疑问
                </div>
                <span className="hidden text-[10px] text-forest-muted sm:inline">
                  复盘时再回应
                </span>
              </div>
              <AutoResizeTextarea
                minRows={1.5}
                maxRows={6}
                className="w-full rounded-xl border border-forest-accent/8 bg-white/55 px-3 py-2 text-xs leading-relaxed text-forest-ink transition-all placeholder:text-forest-muted/70 focus:ring-2 focus:ring-forest-accent/15 sm:text-sm"
                aria-label={`牌面疑问：${currentSlotLabel}`}
                placeholder={`哪里还没想通？先写给“${currentSlotLabel}”留着。`}
                value={cardQuestions[activeSlotIndex] || ''}
                onFocus={scrollFocusedFieldIntoView}
                onChange={e => updateActiveQuestion(e.target.value)}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
