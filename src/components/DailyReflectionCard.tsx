import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand } from 'lucide-react';
import { DailyFortune } from '../types';
import { getCardImageUrl, TAROT_CARDS } from '../constants';
import { TarotCardImage } from './TarotCardImage';
import { Modal } from './Modal';

export function DailyReflectionCard({ fortune, description }: { fortune: DailyFortune; description: string }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const card = TAROT_CARDS.find(item => item.name === fortune.cardName);
  const direction = fortune.isReversed ? '逆位' : '正位';
  const image = (large = false) => (
    <TarotCardImage
      src={getCardImageUrl(card?.id || 'ar00')}
      alt={`${fortune.cardName} · ${direction}`}
      name={fortune.cardName}
      loading="eager"
      className={`${large ? 'h-full w-full' : 'h-20 w-14'} rounded-lg object-contain ${fortune.isReversed ? 'rotate-180' : ''}`}
    />
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setIsPreviewOpen(true)} aria-label={`放大${fortune.cardName}牌面`} title="放大牌面" className="relative min-h-11 min-w-11 shrink-0 rounded-lg border border-forest-accent/12 bg-white/50 p-1">
          {image()}
          <Expand size={12} className="absolute bottom-1 right-1 rounded bg-white/85 text-forest-accent" />
        </button>
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-bold text-forest-ink">{fortune.cardName} · {direction}</h3>
          <p className="mt-1 text-xs leading-relaxed text-forest-muted">{description}</p>
        </div>
      </div>
      {createPortal(<Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title={`${fortune.cardName} · ${direction}`}>
        <div className="mx-auto aspect-[2/3] h-[min(58dvh,420px)] max-w-full">{image(true)}</div>
      </Modal>, document.body)}
    </>
  );
}
