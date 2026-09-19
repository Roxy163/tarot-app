import { Bookmark, ChevronRight, Heart, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { formatReadingDateTime } from '../lib/dateFormat';
import type { TarotReading } from '../types';
import { TarotCardImage } from './TarotCardImage';

interface PublicReadingCardProps {
  reading: TarotReading;
  collected: boolean;
  liked: boolean;
  likeCount?: number;
  likePending: boolean;
  onOpen: () => void;
  onLike: () => void;
  onCollect: () => void;
  onMore: () => void;
  onAuthor: (author: string) => void;
}

export function PublicReadingCard({ reading, collected, liked, likeCount, likePending, onOpen, onLike, onCollect, onMore, onAuthor }: PublicReadingCardProps) {
  const author = reading.isAnonymous ? '匿名研习者' : reading.authorName || '研习者';
  const preview = reading.interpretation?.combination?.trim() || reading.interpretation?.summary?.trim()
    || reading.cardInterpretations?.find(text => text?.trim()) || reading.interpretation?.singleCard?.trim();
  const cards = (reading.cards || []).filter(card => card.name?.trim());
  const actionClass = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] transition-colors hover:bg-forest-accent/5';
  return <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 rounded-2xl border border-forest-accent/8 bg-white/45 px-3 pt-1.5">
    <div className="flex min-h-11 items-center gap-2 text-[10px] text-forest-muted">
      <button type="button" onClick={() => !reading.isAnonymous && onAuthor(author)} disabled={reading.isAnonymous} className="flex min-h-11 min-w-11 max-w-[45%] items-center gap-1.5 text-forest-accent disabled:text-forest-muted">
        <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-accent/10 text-[9px]">{author.charAt(0)}</span>
        <span className="truncate">{author}</span>
      </button>
      <span className="ml-auto truncate">{formatReadingDateTime(reading.readingDate || reading.date)}</span>
    </div>
    <button type="button" onClick={onOpen} aria-label={`查看手记：${reading.question || '未命名手记'}`} className="flex min-h-20 w-full gap-3 pb-2 text-left">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-forest-ink">{reading.question || '未命名手记'}</h3>
        {preview && <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-forest-muted">{preview}</p>}
        <p className="mt-1.5 truncate text-[10px] text-forest-muted/80">{reading.spread} · {cards.length} 张牌</p>
      </div>
      <span aria-hidden="true" className="flex w-16 shrink-0 items-start justify-end -space-x-5 pt-1">
        {cards.slice(0, 3).map((card, index) => {
          const definition = TAROT_CARDS.find(item => [item.id, item.name, item.english].includes(card.name));
          return <span key={index} className={`h-[4.2rem] w-10 shrink-0 overflow-hidden rounded-md border border-white bg-forest-bg shadow-sm ${card.isReversed ? 'rotate-180' : ''}`}>
            <TarotCardImage src={getCardImageUrl(definition?.id || 'ar00')} name={card.name} alt="" className="h-full w-full object-cover" />
          </span>;
        })}
      </span>
    </button>
    <div className="flex items-center gap-1 border-t border-forest-accent/6 text-forest-muted">
      <button type="button" onClick={onLike} disabled={likePending} aria-label={liked ? '取消点赞' : '点赞'} aria-pressed={liked} className={`${actionClass} ${liked ? 'text-forest-pink' : ''} disabled:opacity-50`}>
        <Heart size={15} fill={liked ? 'currentColor' : 'none'} /><span>{likeCount || (liked ? '已赞' : '赞')}</span>
      </button>
      <button type="button" onClick={onCollect} aria-label={collected ? '取消收藏' : '收藏研习'} aria-pressed={collected} className={`${actionClass} ${collected ? 'text-forest-accent' : ''}`}>
        <Bookmark size={14} fill={collected ? 'currentColor' : 'none'} /><span>{collected ? '已收藏' : '收藏'}</span>
      </button>
      <button type="button" onClick={onOpen} className={`${actionClass} ml-auto text-forest-accent`}>全文<ChevronRight size={13} /></button>
      <button type="button" onClick={onMore} aria-label="更多案例操作" className={actionClass}><MoreHorizontal size={16} /></button>
    </div>
  </motion.article>;
}
