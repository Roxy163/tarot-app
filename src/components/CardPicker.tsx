import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { cardMatchesSearch } from '../lib/cardSearch';
import { preloadTarotCardImages } from '../lib/tarotImagePreload';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { TarotCardImage } from './TarotCardImage';

interface CardPickerProps {
  onSelect: (card: typeof TAROT_CARDS[0], isReversed: boolean) => void;
  onClose: () => void;
  excludeCards?: string[];
  title?: string;
  description?: string;
  initialIsReversed?: boolean;
}

const CARD_PICKER_EAGER_COUNT = 18;
const CARD_PICKER_HIGH_PRIORITY_COUNT = 9;

export function CardPicker({
  onSelect,
  onClose,
  excludeCards = [],
  title = '选择塔罗牌',
  description,
}: CardPickerProps) {
  useBodyScrollLock(true);

  const [search, setSearch] = useState('');
  const shouldAutoFocus = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;
  const scrollSearchIntoView = (event: React.FocusEvent<HTMLInputElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = event.currentTarget;

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  };

  const filteredCards = TAROT_CARDS.filter(card => cardMatchesSearch(card, search));
  const firstVisibleCardIds = filteredCards
    .slice(0, CARD_PICKER_EAGER_COUNT)
    .map(card => card.id);
  const firstVisibleImageKey = firstVisibleCardIds.join('|');

  useEffect(() => {
    if (!firstVisibleCardIds.length) return;

    void preloadTarotCardImages(firstVisibleCardIds, {
      concurrency: 6,
      priority: 'high',
    });
  }, [firstVisibleImageKey]);

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-forest-accent/20 text-forest-accent font-bold">{part}</span>
      ) : (
        part
      )
    );
  };

  const modal = (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-forest-ink/18 p-0 backdrop-blur-[2px] overscroll-contain sm:items-center sm:p-4">
      <motion.div 
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.55rem] border border-forest-accent/8 bg-white/84 shadow-[0_24px_70px_-54px_rgba(62,58,54,0.68)] backdrop-blur-md sm:h-auto sm:max-h-[80vh] sm:rounded-[1.45rem]"
      >
        <div className="flex items-center justify-between border-b border-forest-accent/7 bg-white/55 p-3 sm:p-4">
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-semibold text-forest-accent">{title}</h3>
            {description && (
              <p className="mt-1 text-xs text-forest-muted leading-relaxed">{description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden max-w-[11rem] rounded-full border border-forest-accent/7 bg-white/42 px-3 py-2 text-[10px] leading-snug text-forest-muted sm:inline">
              先选牌，正逆位可回到卡片上单独切换。
            </span>
            <button onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/24 text-forest-muted transition-colors hover:bg-white/56 hover:text-forest-accent" aria-label="关闭选牌器">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="border-b border-forest-accent/5 p-3 sm:p-4">
          <input 
            autoFocus={shouldAutoFocus}
            type="search"
            inputMode="search"
            className="min-h-11 w-full rounded-xl border border-forest-accent/7 bg-white/46 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-accent/15"
            placeholder="搜索牌名、别称或英文..."
            value={search}
            onFocus={scrollSearchIntoView}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto overscroll-contain p-2.5 sm:grid-cols-4 sm:gap-3 sm:p-3.5 md:grid-cols-6">
          {filteredCards.map((card, index) => {
            const isExcluded = excludeCards.includes(card.name);
            return (
              <button
                key={card.id}
                disabled={isExcluded}
                onClick={() => onSelect(card, false)}
                className={`group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all sm:gap-2 sm:p-2.5 ${
                  isExcluded ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-forest-accent/5 active:scale-95'
                }`}
              >
                <div className="relative aspect-[2/3.5] w-full overflow-hidden rounded-lg border border-forest-accent/10 bg-forest-bg transition-all group-hover:border-forest-accent/30">
                  <TarotCardImage
                    src={getCardImageUrl(card.id)}
                    alt={card.name}
                    name={card.name}
                    loading={index < CARD_PICKER_EAGER_COUNT ? 'eager' : 'lazy'}
                    fetchPriority={index < CARD_PICKER_HIGH_PRIORITY_COUNT ? 'high' : 'auto'}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="w-full truncate text-center text-[9px] font-medium text-forest-ink sm:text-[10px]">
                  {highlightMatch(card.name, search)}
                  {isExcluded && <span className="block text-[8px] text-forest-accent mt-0.5">(已选)</span>}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
}
