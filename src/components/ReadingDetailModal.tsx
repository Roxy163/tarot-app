import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, CheckCircle2, PencilLine, Sparkles, X } from 'lucide-react';
import { TarotReading } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { TarotCardImage } from './TarotCardImage';
import { MysticWatermark } from './MysticWatermark';
import { formatReadingDateTime } from '../lib/dateFormat';

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
  const aiReferenceText = reading.aiAnswer?.trim();
  const aiReferenceModeLabel = reading.aiAnswerMode === 'consultant' ? '咨询解牌' : '导师复盘';
  const clientDisplayName = reading.clientName?.trim() || '未命名客户';
  const displayDate = formatReadingDateTime(reading.readingDate || reading.date);
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
      question: reading.cardQuestions?.[index]?.trim() || '',
    };
  });

  const influenceNotes = [
    { label: '灵数影响', value: reading.interpretation?.numerologyInfluence },
    { label: '行星星座影响', value: reading.interpretation?.astrologyInfluence },
    { label: '宫位影响', value: reading.interpretation?.houseInfluence },
    { label: '元素影响', value: reading.interpretation?.elementInfluence },
  ].filter(item => item.value?.trim());
  const notedCardCount = cardRows.filter(item => item.note).length;
  const learningLoopItems = [
    { label: '问题', value: reading.category || '未分类', done: Boolean(reading.question.trim()) },
    { label: '牌面', value: `${reading.cards.length} 张 · ${reading.spread}`, done: reading.cards.length > 0 },
    { label: '逐牌注疏', value: `${notedCardCount}/${reading.cards.length}`, done: notedCardCount >= reading.cards.length && reading.cards.length > 0 },
    { label: '复盘验证', value: feedbackText ? '已补写' : '待回看', done: Boolean(feedbackText) },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-2.5 overscroll-contain sm:p-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-forest-text/14 backdrop-blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[1.5rem] border border-forest-accent/7 bg-white/76 shadow-[0_22px_70px_-56px_rgba(62,58,54,0.66)] backdrop-blur-md"
        >
          <MysticWatermark variant="book" className="-right-8 -top-10 h-44 w-44 text-forest-accent opacity-[0.035]" />
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-forest-accent/7 bg-white/64 px-3.5 py-3 backdrop-blur-md sm:px-5">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-accent/8 px-2 py-0.5 text-[10px] font-semibold text-forest-accent">
                  <BookOpen size={11} />
                  阅读模式
                </span>
                {feedbackText && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-accent/8 px-2 py-0.5 text-[10px] font-semibold text-forest-accent">
                    <CheckCircle2 size={11} />
                    已复盘
                  </span>
                )}
                {aiReferenceText && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-accent/8 px-2 py-0.5 text-[10px] font-semibold text-forest-accent">
                    <Sparkles size={11} />
                    AI参照
                  </span>
                )}
                {reading.isForClient && (
                  <span className="rounded-full bg-amber-100/75 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    客户记录
                  </span>
                )}
              </div>
              <h2 className="line-clamp-2 text-base font-semibold text-forest-ink sm:text-xl">{reading.question}</h2>
              <p className="text-xs text-forest-muted">
                {displayDate} · {reading.spread} · {reading.cards.length}张牌
                {reading.isForClient ? ` · 客户：${clientDisplayName}` : ' · 给自己记录'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(reading)}
                className="flex min-h-10 items-center gap-1.5 rounded-xl bg-forest-accent/88 px-3 text-xs font-medium text-white transition-colors hover:bg-forest-accent"
                title="切换到编辑模式"
              >
                <PencilLine size={14} />
                编辑
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-forest-accent/7 bg-white/30 text-forest-muted transition-colors hover:bg-white/56 hover:text-forest-accent"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(92vh-76px)] space-y-3.5 overflow-y-auto overscroll-contain p-3 sm:p-4">
            {reading.isForClient && (
              <section className="space-y-2 rounded-2xl border border-amber-100/60 bg-amber-50/48 p-3.5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-amber-700">客户档案</h3>
                <p className="text-sm text-forest-ink">
                  这是一条给 <span className="font-semibold text-amber-700">{clientDisplayName}</span> 的记录，可在典籍中按客户昵称筛选回看。
                </p>
                {reading.clientFeedback?.trim() && (
                  <p className="text-sm text-forest-ink/80 leading-relaxed whitespace-pre-wrap">
                    客户反馈：{reading.clientFeedback}
                  </p>
                )}
              </section>
            )}

              <section className="rounded-[1.25rem] border border-forest-accent/7 bg-white/24 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest-accent">学习闭环</p>
                  <h3 className="mt-1 font-serif text-base font-semibold text-forest-ink">这次抽牌留下了什么证据</h3>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${
                  feedbackText
                    ? 'bg-forest-accent/92 text-white'
                    : 'bg-forest-pink/10 text-forest-pink'
                }`}>
                  {feedbackText ? '已复盘' : '待复盘'}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {learningLoopItems.map(item => (
                  <div key={item.label} className="rounded-xl border border-forest-accent/7 bg-white/34 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-forest-muted">
                      {item.done ? <CheckCircle2 size={13} className="text-forest-accent" /> : <PencilLine size={13} className="text-forest-pink" />}
                      {item.label}
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-forest-ink">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {overviewText && (
              <section className="space-y-2 rounded-2xl border border-forest-accent/7 bg-white/24 p-3.5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-forest-accent">综合解读</h3>
                <p className="text-sm text-forest-ink leading-relaxed whitespace-pre-wrap">{overviewText}</p>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-forest-accent">
                <Sparkles size={15} />
                <h3 className="text-xs font-medium uppercase tracking-wider">逐牌解读</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {cardRows.map((item, index) => {
                  const fallbackSingle = cardRows.length === 1 ? reading.interpretation?.singleCard?.trim() : '';
                  const note = item.note || fallbackSingle;

                  return (
                    <article key={`${item.card.name}-${index}`} className="flex gap-3 rounded-2xl border border-forest-accent/7 bg-white/36 p-3">
                      <div className={`w-16 h-24 sm:w-20 sm:h-30 rounded-xl overflow-hidden border border-forest-accent/8 shadow-sm shrink-0 bg-forest-bg ${item.card.isReversed ? 'rotate-180' : ''}`}>
                        <TarotCardImage
                          src={getCardImageUrl(item.cardData?.id || 'ar00')}
                          alt={item.card.name}
                          name={item.card.name}
                          className="w-full h-full object-contain bg-white"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-medium text-forest-accent">
                            {item.label}
                          </span>
                          <span className="text-sm font-semibold text-forest-ink">
                            {item.cardData?.name || item.card.name}
                          </span>
                          <span className="text-[10px] text-forest-muted">
                            {item.card.isReversed ? '逆位' : '正位'}
                          </span>
                        </div>
                        <p className="text-sm text-forest-ink/85 leading-relaxed whitespace-pre-wrap">
                          {note || '还没有填写这张牌的解读。'}
                        </p>
                        {item.question && (
                          <p className="rounded-xl bg-forest-accent/5 px-2.5 py-2 text-xs leading-relaxed text-forest-muted">
                            <span className="font-medium text-forest-accent">牌面疑问：</span>
                            {item.question}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {reading.interpretation?.summary?.trim() && reading.interpretation.summary.trim() !== overviewText && (
              <section className="space-y-2 rounded-2xl border border-forest-accent/7 bg-white/24 p-3.5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-forest-accent">总结建议</h3>
                <p className="text-sm text-forest-ink leading-relaxed whitespace-pre-wrap">{reading.interpretation.summary}</p>
              </section>
            )}

            {aiReferenceText && (
              <section className="space-y-2 rounded-2xl border border-forest-accent/7 bg-white/24 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-forest-accent">AI参照</h3>
                  <span className="rounded-full bg-forest-accent/8 px-2 py-0.5 text-[10px] font-semibold text-forest-muted">
                    {aiReferenceModeLabel}
                  </span>
                </div>
                <p className="text-sm text-forest-ink leading-relaxed whitespace-pre-wrap">{aiReferenceText}</p>
              </section>
            )}

            {influenceNotes.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-forest-accent">补充解读视角</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {influenceNotes.map(item => (
                    <div key={item.label} className="space-y-1.5 rounded-2xl border border-forest-accent/7 bg-white/24 p-3.5">
                      <h4 className="text-xs font-medium text-forest-accent">{item.label}</h4>
                      <p className="text-sm text-forest-ink/85 leading-relaxed whitespace-pre-wrap">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {feedbackText && (
              <section className="space-y-2 rounded-2xl border border-forest-accent/7 bg-white/24 p-3.5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-forest-accent">复盘记录</h3>
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
