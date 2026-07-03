import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, BookOpen, PenLine, Save, X } from 'lucide-react';
import { DailyFortune } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';

interface DailyFortuneArchiveModalProps {
  fortunes: DailyFortune[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateReflection: (id: string, reflection: string) => void;
}

const getCardData = (cardName: string) => TAROT_CARDS.find(card => card.name === cardName);

const getSourceLabel = (source?: DailyFortune['source']) => (
  source === 'physical-draw' ? '现实抽牌' : '系统抽牌'
);

export const DailyFortuneArchiveModal: React.FC<DailyFortuneArchiveModalProps> = ({
  fortunes,
  isOpen,
  onClose,
  onUpdateReflection,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(fortunes[0]?.id || null);
  const [editingFortune, setEditingFortune] = useState<DailyFortune | null>(null);
  const [reflectionText, setReflectionText] = useState('');

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthCount = fortunes.filter(fortune => fortune.date.startsWith(currentMonth)).length;
  const topCard = Object.entries(
    fortunes.reduce<Record<string, number>>((acc, fortune) => {
      acc[fortune.cardName] = (acc[fortune.cardName] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] || '待积累';

  const stats = useMemo(() => ([
    ['已归档', fortunes.length, '天'],
    ['本月', monthCount, '天'],
    ['常见牌', topCard, ''],
  ]), [fortunes.length, monthCount, topCard]);

  const openEdit = (fortune: DailyFortune) => {
    setEditingFortune(fortune);
    setReflectionText(fortune.reflection || '');
  };

  const closeEdit = () => {
    setEditingFortune(null);
    setReflectionText('');
  };

  const saveEdit = () => {
    if (!editingFortune) return;
    onUpdateReflection(editingFortune.id, reflectionText.trim());
    closeEdit();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-x-0 top-0 bottom-20 z-[90] flex items-end justify-center bg-forest-ink/30 p-0 backdrop-blur-sm sm:inset-0 sm:z-[900] sm:items-center sm:p-6">
            <motion.div
              role="dialog"
              aria-label="日运复盘"
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.98 }}
              className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-forest-accent/15 bg-forest-bg shadow-2xl sm:rounded-[2rem]"
            >
              <div className="border-b border-forest-accent/10 bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-forest-accent">
                      <Archive size={18} />
                      <h3 className="font-serif text-xl font-bold text-forest-ink">日运复盘</h3>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                      回看每天的一张牌，把单牌含义和真实生活慢慢对应起来。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-forest-muted hover:bg-forest-accent/10 hover:text-forest-accent"
                    aria-label="关闭日运复盘"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {stats.map(([label, value, suffix]) => (
                    <div key={label} className="min-w-0 rounded-2xl border border-forest-accent/10 bg-white/70 p-3">
                      <p className="text-[10px] font-bold text-forest-muted">{label}</p>
                      <p className="mt-1 truncate font-serif text-lg font-bold text-forest-accent">
                        {value}
                        <span className="ml-0.5 text-[10px] font-sans text-forest-muted">{suffix}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {fortunes.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-forest-accent/20 bg-white/60 px-6 py-14 text-center">
                    <Archive size={32} className="text-forest-accent/40" />
                    <div>
                      <p className="font-serif text-lg font-bold text-forest-ink">归档第一张日运牌</p>
                      <p className="mt-1 text-xs text-forest-muted">抽牌或录入现实牌后，就能在这里形成你的日运档案。</p>
                    </div>
                  </div>
                ) : fortunes.map(fortune => {
                  const card = getCardData(fortune.cardName);
                  const expanded = expandedId === fortune.id;

                  return (
                    <div key={fortune.id} className="overflow-hidden rounded-3xl border border-forest-accent/10 bg-white/90 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : fortune.id)}
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <div className={`h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-forest-accent/15 bg-forest-bg shadow-sm ${fortune.isReversed ? 'rotate-180' : ''}`}>
                          <img
                            src={getCardImageUrl(card?.id || 'ar00')}
                            alt={fortune.cardName}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-serif text-lg font-bold text-forest-ink">{fortune.cardName}</p>
                            <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[10px] font-bold text-forest-accent">
                              {fortune.isReversed ? '逆位' : '正位'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-forest-muted">{fortune.date} · {getSourceLabel(fortune.source)}</p>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-forest-text/70">
                            {fortune.reflection || '还没有补写今天的对应。'}
                          </p>
                        </div>
                      </button>

                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-forest-accent/10 px-4 pb-4 pt-3"
                          >
                            <p className="text-xs leading-relaxed text-forest-text/80">{fortune.interpretation}</p>
                            <div className="mt-3 rounded-2xl bg-forest-bg/70 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest-accent">今日对应</p>
                              <p className="mt-1 text-sm leading-relaxed text-forest-ink">
                                {fortune.reflection || '还没有记录。可以晚上回来写下今天发生了什么。'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEdit(fortune)}
                              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-accent/10 px-4 text-xs font-bold text-forest-accent hover:bg-forest-accent/15"
                            >
                              <PenLine size={14} />
                              补写今日对应
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {editingFortune && (
              <div className="fixed inset-0 z-[960] flex items-center justify-center bg-forest-ink/30 p-4 backdrop-blur-sm">
                <motion.div
                  role="dialog"
                  aria-label="补写日运对应"
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  className="w-full max-w-md rounded-[2rem] border border-forest-accent/15 bg-white p-5 shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-accent">补写日运</p>
                      <h3 className="mt-1 font-serif text-xl font-bold text-forest-ink">
                        {editingFortune.cardName} · {editingFortune.isReversed ? '逆位' : '正位'}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                        复盘今天真实发生了什么，看看它和这张牌的关键词、画面或正逆位哪里对应。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-muted hover:bg-forest-accent/10 hover:text-forest-accent"
                      aria-label="关闭补写日运对应"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <textarea
                    value={reflectionText}
                    onChange={(event) => setReflectionText(event.target.value)}
                    aria-label="日运补写内容"
                    placeholder="写下今天发生了什么？它和这张牌的关键词、画面或正逆位有什么对应？"
                    className="mt-4 min-h-32 w-full resize-none rounded-2xl border border-forest-accent/15 bg-forest-bg/60 p-4 text-sm leading-relaxed text-forest-ink outline-none transition-all placeholder:text-forest-muted/70 focus:border-forest-accent/40 focus:ring-2 focus:ring-forest-accent/15"
                  />

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="min-h-11 flex-1 rounded-xl px-4 text-xs font-bold text-forest-muted hover:bg-forest-accent/5 hover:text-forest-ink"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-forest-accent px-4 text-xs font-bold text-white hover:bg-forest-accent/90"
                    >
                      <Save size={14} />
                      保存补写
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};
