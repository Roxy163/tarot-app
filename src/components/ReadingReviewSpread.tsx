import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Expand, Layers } from 'lucide-react';
import type { TarotReading } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { getReadingReviewLayout } from '../lib/readingReviewLayout';
import { TarotCardImage } from './TarotCardImage';
import { Modal } from './Modal';

export function ReadingReviewSpread({ reading }: { reading: TarotReading }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 280, height: window.innerHeight });
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [crossOnTop, setCrossOnTop] = useState(true);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth || 280, height: window.innerHeight });
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  const layout = getReadingReviewLayout(reading, size.width, size.height);
  const selectedCard = selected === null ? null : layout.cards[selected];
  const celtic = layout.official && reading.spread === '凯尔特十字牌阵';
  const hitArea = (card: typeof layout.cards[number]) => {
    const angle = card.rotation * Math.PI / 180;
    return { width: Math.max(44, Math.abs(Math.cos(angle) * card.width) + Math.abs(Math.sin(angle) * card.height)), height: Math.max(44, Math.abs(Math.sin(angle) * card.width) + Math.abs(Math.cos(angle) * card.height)) };
  };
  const hasOverlap = layout.cards.some((card, index) => layout.cards.slice(index + 1).some(other =>
    Math.abs(other.x - card.x) < (hitArea(card).width + hitArea(other).width) / 2
    && Math.abs(other.y - card.y) < (hitArea(card).height + hitArea(other).height) / 2));
  const select = (index: number) => { setSelected(index); if (celtic && index < 2) setCrossOnTop(index === 1); };
  const image = (index: number) => {
    const card = layout.cards[index].slot;
    const metadata = TAROT_CARDS.find(item => [item.name, item.english, item.id].includes(card.name));
    return <TarotCardImage src={getCardImageUrl(metadata?.id || 'ar00')} alt={`${card.name}（${card.isReversed ? '逆位' : '正位'}）`} name={card.name} loading="eager" className={`h-full w-full object-contain ${card.isReversed ? 'rotate-180' : ''}`} />;
  };
  return <div ref={viewport} className="space-y-3">
    <div className="flex min-h-11 items-center justify-between gap-2">
      <h3 className="font-serif text-sm font-bold text-forest-accent">原牌阵</h3>
      <span className="text-xs text-forest-muted">点选牌面查看解读</span>
    </div>
    <div data-review-spread className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
      {layout.cards.map((card, index) => <motion.button key={index} type="button"
        aria-label={`${index + 1}. ${card.slot.label}：${card.slot.name || '待选牌'}${card.slot.name ? `（${card.slot.isReversed ? '逆位' : '正位'}）` : ''}`}
        aria-pressed={selected === index} onClick={() => select(index)}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.025 }}
        className="absolute flex min-h-11 min-w-11 items-center justify-center rounded outline-offset-2 focus-visible:outline-2 focus-visible:outline-forest-accent"
        style={{ left: card.x, top: card.y, ...hitArea(card), transform: 'translate(-50%, -50%)', zIndex: celtic && index < 2 ? (index === (crossOnTop ? 1 : 0) ? 30 : 20) : index + 1 }}>
        <span data-review-card-face className={`relative block shrink-0 overflow-hidden rounded border bg-forest-bg ${selected === index ? 'border-forest-accent ring-2 ring-forest-accent/25' : 'border-forest-accent/15'}`} style={{ width: card.width, height: card.height, transform: `rotate(${card.rotation}deg)` }}>
          {card.slot.name ? image(index) : <span className="flex h-full items-center justify-center px-0.5 text-center text-[8px] text-forest-muted">{card.slot.label}</span>}
          <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b bg-forest-ink/65 px-1 text-[8px] text-white">{index + 1}</span>
        </span>
      </motion.button>)}
    </div>
    {celtic && <button type="button" aria-label="切换交叉牌层级" onClick={() => { setCrossOnTop(previous => !previous); setSelected(crossOnTop ? 0 : 1); }} className="flex min-h-11 items-center gap-1.5 text-xs text-forest-accent"><Layers size={15} />查看交叉{crossOnTop ? '下层' : '上层'}牌</button>}
    {hasOverlap && <div className="space-y-1">
      {!celtic && <p className="text-xs text-forest-muted">牌位较密，可用下方编号查看每张牌；原来的叠放保持不变。</p>}
      <div className="flex flex-wrap gap-1" aria-label="按牌位查看">{layout.cards.map((card, index) => <button key={index} type="button" onClick={() => select(index)} aria-label={`查看第 ${index + 1} 张：${card.slot.label}`} aria-pressed={selected === index} className={`min-h-11 min-w-11 rounded-lg px-2 text-xs ${selected === index ? 'bg-forest-accent/10 text-forest-accent' : 'text-forest-muted hover:bg-forest-accent/5'}`}>{index + 1}</button>)}</div>
    </div>}
    <AnimatePresence mode="wait">{selectedCard && selected !== null && <motion.article key={selected} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 border-t border-forest-accent/8 pt-3" aria-label="选中牌位的解读">
      {selectedCard.slot.name && <button type="button" onClick={() => setZoom(true)} aria-label={`放大${selectedCard.slot.name}牌面`} className="relative h-28 w-16 shrink-0 rounded-lg">{image(selected)}<Expand size={14} className="absolute bottom-0 right-0 rounded bg-white/90 text-forest-accent" /></button>}
      <div className="min-w-0 space-y-2">
        <h4 className="font-serif text-sm font-bold text-forest-accent">{selectedCard.slot.label} · {selectedCard.slot.name || '待选牌'}{selectedCard.slot.name ? `（${selectedCard.slot.isReversed ? '逆位' : '正位'}）` : ''}</h4>
        {reading.cardInterpretations?.[selected]?.trim() && <p className="whitespace-pre-wrap break-words text-sm">{reading.cardInterpretations[selected]}</p>}
        {reading.cardQuestions?.[selected]?.trim() && <p className="whitespace-pre-wrap break-words text-xs text-forest-muted">疑问：{reading.cardQuestions[selected]}</p>}
      </div>
    </motion.article>}</AnimatePresence>
    {createPortal(<Modal isOpen={zoom && Boolean(selectedCard)} onClose={() => setZoom(false)} title={selectedCard ? `${selectedCard.slot.name} · ${selectedCard.slot.isReversed ? '逆位' : '正位'}` : '牌面'}><div className="mx-auto aspect-[2/3.5] h-[min(58dvh,420px)] max-w-full">{selectedCard && selected !== null && image(selected)}</div></Modal>, document.body)}
  </div>;
}
