import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, CheckCircle2, PencilLine, Sparkles, X } from 'lucide-react';
import { TarotReading } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { TarotCardImage } from './TarotCardImage';

interface ReadingDetailModalProps {
  reading: TarotReading | null;
  onClose: () => void;
  onEdit: (reading: TarotReading) => void;
}

export const ReadingDetailModal: React.FC<ReadingDetailModalProps> = ({
  reading,
  onClose,
  onEdit,
}) => {
  useBodyScrollLock(Boolean(reading));

  if (!reading) return null;

  const overviewText = (
    reading.interpretation?.combination?.trim() ||
    reading.interpretation?.summary?.trim() ||
    reading.interpretation?.singleCard?.trim() ||
    ''
  );
  const feedbackText = reading.userFeedback?.trim();
  const clientDisplayName = reading.clientName?.trim() || '未命名客户';
  const cardRows = (reading.cards || []).map((card, index) => {
    const cardData = TAROT_CARDS.find(item => (
      item.name === card.name ||
      item.english === card.name ||
      item.id === card.name
    ));

    return {
      card,
      cardData,
      label: reading.slotLabels?.[index] || `第 ${index + 1} 张`,
      note: reading.cardInterpretations?.[index]?.trim() || '',
    };
  });

  const influenceNotes = [
    { label: '灵数影响', value: reading.interpretation?.numerologyInfluence },
    { label: '行星星座影响', value: reading.interpretation?.astrologyInfluence },
    { label: '宫位影响', value: reading.interpretation?.houseInfluence },
    { label: '元素影响', value: reading.interpretation?.elementInfluence },
  ].filter(item => item.value?.trim());

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 overscroll-contain sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-forest-text/25 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-forest-border overflow-hidden"
        >
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-forest-accent/10 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-forest-accent/10 text-forest-accent text-[10px] font-bold inline-flex items-center gap-1">
                  <BookOpen size={11} />
                  阅读模式
                </span>
                {feedbackText && (
                  <span className="px-2 py-0.5 rounded-full bg-forest-accent/10 text-forest-accent text-[10px] font-bold inline-flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    已复盘
                  </span>
                )}
                {reading.isForClient && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                    客户记录
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-forest-ink line-clamp-2">{reading.question}</h2>
              <p className="text-xs text-forest-muted">
                {reading.date} · {reading.spread} · {reading.cards.length}张牌
                {reading.isForClient ? ` · 客户：${clientDisplayName}` : ' · 给自己记录'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(reading)}
                className="min-h-10 px-3 rounded-xl bg-forest-accent text-white text-xs font-bold flex items-center gap-1.5 hover:bg-forest-accent/90 transition-colors"
                title="切换到编辑模式"
              >
                <PencilLine size={14} />
                编辑
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl border border-forest-accent/10 text-forest-muted flex items-center justify-center hover:text-forest-accent hover:bg-forest-accent/5 transition-colors"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain max-h-[calc(92vh-88px)] p-4 sm:p-6 space-y-5">
            {reading.isForClient && (
              <section className="rounded-2xl bg-amber-50 border border-amber-100 p-4 space-y-2">
                <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">客户档案</h3>
                <p className="text-sm text-forest-ink">
                  这是一条给 <span className="font-bold text-amber-700">{clientDisplayName}</span> 的记录，可在典籍中按客户昵称筛选回看。
                </p>
                {reading.clientFeedback?.trim() && (
                  <p className="text-sm text-forest-ink/80 leading-relaxed whitespace-pre-wrap">
                    客户反馈：{reading.clientFeedback}
                  </p>
                )}
              </section>
            )}

            {overviewText && (
              <section className="rounded-2xl bg-forest-accent/5 border border-forest-accent/10 p-4 space-y-2">
                <h3 className="text-xs font-bold text-forest-accent uppercase tracking-wider">综合解读</h3>
                <p className="text-sm text-forest-ink leading-relaxed whitespace-pre-wrap">{overviewText}</p>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-forest-accent">
                <Sparkles size={15} />
                <h3 className="text-xs font-bold uppercase tracking-wider">逐牌解读</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {cardRows.map((item, index) => {
                  const fallbackSingle = cardRows.length === 1 ? reading.interpretation?.singleCard?.trim() : '';
                  const note = item.note || fallbackSingle;

                  return (
                    <article key={`${item.card.name}-${index}`} className="rounded-2xl border border-forest-accent/10 bg-white p-3 sm:p-4 flex gap-3">
                      <div className={`w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden border border-forest-accent/10 shadow-sm shrink-0 bg-forest-bg ${item.card.isReversed ? 'rotate-180' : ''}`}>
                        <TarotCardImage
                          src={getCardImageUrl(item.cardData?.id || 'ar00')}
                          alt={item.card.name}
                          name={item.card.name}
                          className="w-full h-full object-contain bg-white"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest-accent/10 text-forest-accent font-bold">
                            {item.label}
                          </span>
                          <span className="text-sm font-bold text-forest-ink">
                            {item.cardData?.name || item.card.name}
                          </span>
                          <span className="text-[10px] text-forest-muted">
                            {item.card.isReversed ? '逆位' : '正位'}
                          </span>
                        </div>
                        <p className="text-sm text-forest-ink/85 leading-relaxed whitespace-pre-wrap">
                          {note || '还没有填写这张牌的解读。'}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {reading.interpretation?.summary?.trim() && reading.interpretation.summary.trim() !== overviewText && (
              <section className="rounded-2xl bg-forest-bg/40 border border-forest-accent/10 p-4 space-y-2">
                <h3 className="text-xs font-bold text-forest-accent uppercase tracking-wider">总结建议</h3>
                <p className="text-sm text-forest-ink leading-relaxed whitespace-pre-wrap">{reading.interpretation.summary}</p>
              </section>
            )}

            {influenceNotes.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-forest-accent uppercase tracking-wider">补充解读视角</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {influenceNotes.map(item => (
                    <div key={item.label} className="rounded-2xl bg-forest-accent/5 border border-forest-accent/10 p-4 space-y-1.5">
                      <h4 className="text-xs font-bold text-forest-accent">{item.label}</h4>
                      <p className="text-sm text-forest-ink/85 leading-relaxed whitespace-pre-wrap">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {feedbackText && (
              <section className="rounded-2xl bg-forest-bg/40 border border-forest-accent/10 p-4 space-y-2">
                <h3 className="text-xs font-bold text-forest-accent uppercase tracking-wider">复盘记录</h3>
                <p className="text-sm text-forest-ink leading-relaxed whitespace-pre-wrap">{feedbackText}</p>
              </section>
            )}

            {reading.keywords && reading.keywords.length > 0 && (
              <section className="flex flex-wrap gap-2">
                {reading.keywords.map((keyword, index) => (
                  <span key={`${keyword}-${index}`} className="px-2.5 py-1 rounded-full bg-forest-accent/5 text-forest-accent text-xs font-medium">
                    #{keyword}
                  </span>
                ))}
              </section>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
