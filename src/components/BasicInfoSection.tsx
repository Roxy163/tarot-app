import React from 'react';
import { ChevronDown, Layers, Plus, Trash2, Calendar, Tag } from 'lucide-react';
import { SpreadDefinition } from '../types';
import { OFFICIAL_SPREADS } from '../constants';

interface BasicInfoSectionProps {
  question: string;
  onUpdateQuestion: (q: string) => void;
  category: string;
  onUpdateCategory: (c: string) => void;
  date: string;
  onUpdateDate: (d: string) => void;
  spread: string;
  spreads: SpreadDefinition[];
  onSelectSpread: (s: SpreadDefinition) => void;
  onOpenSpreadManager: () => void;
  onCreateSpread: () => void;
  onDeleteSpread?: (name: string) => void;
  isMultiCard: boolean;
  activeSlotIndex: number;
  onSetActiveSlotIndex: (idx: number) => void;
  cardSlots: { label?: string }[];
  onAddSlot: () => void;
  canAddSlot?: boolean;
  isDailyMode: boolean;
  isForClient: boolean;
  onToggleClientMode: () => void;
  initialData?: any;
  onCancel?: () => void;
  highlightedRequiredField?: 'question' | 'spread' | null;
  quickThemeSlot?: React.ReactNode;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  question,
  onUpdateQuestion,
  category,
  onUpdateCategory,
  date,
  onUpdateDate,
  spread,
  spreads,
  onSelectSpread,
  onOpenSpreadManager,
  onCreateSpread,
  onDeleteSpread,
  isMultiCard,
  activeSlotIndex,
  onSetActiveSlotIndex,
  cardSlots,
  onAddSlot,
  canAddSlot = true,
  isDailyMode,
  isForClient,
  onToggleClientMode,
  initialData,
  onCancel,
  highlightedRequiredField = null,
  quickThemeSlot,
}) => {
  const officialSpreadNames = new Set(OFFICIAL_SPREADS.map(item => item.name));
  const officialSpreads = spreads.filter(item => officialSpreadNames.has(item.name));
  const customSpreads = spreads.filter(item => !officialSpreadNames.has(item.name));
  const isSelectedCustomSpread = customSpreads.some(item => item.name === spread);
  const selectSelfMode = () => {
    if (isForClient) onToggleClientMode();
  };
  const selectClientMode = () => {
    if (!isForClient) onToggleClientMode();
  };
  const scrollFocusedFieldIntoView = (event: React.FocusEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = event.currentTarget;

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  };

  return (
    <div className="mb-2.5 space-y-2 sm:mb-4 sm:space-y-3">
      <div className="sticky top-0 z-30 flex flex-col gap-1 border-b border-forest-accent/7 bg-white/58 pb-1.5 backdrop-blur-md sm:gap-2 sm:pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-base font-semibold text-forest-accent sm:text-2xl">{initialData ? '修改手记' : '抽牌手记'}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {initialData && (
              <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-2 text-xs font-medium text-forest-muted transition-colors hover:text-forest-accent sm:min-h-10 sm:px-3">取消修改</button>
            )}
            <div
              role="group"
              aria-label="记录对象"
              className="grid h-11 w-[132px] grid-cols-2 rounded-full border border-forest-accent/8 bg-white/42 p-1 shadow-[0_8px_20px_rgba(124,169,130,0.08)] sm:h-10 sm:w-[126px]"
            >
              <button
                type="button"
                onClick={selectSelfMode}
                aria-pressed={!isForClient}
                className={`flex h-full items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-all sm:text-xs ${
                  !isForClient
                    ? 'bg-forest-accent/90 text-white shadow-sm'
                    : 'text-forest-muted hover:bg-white/55 hover:text-forest-accent'
                }`}
              >
                自己
              </button>
              <button
                type="button"
                onClick={selectClientMode}
                aria-pressed={isForClient}
                className={`flex h-full items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-all sm:text-xs ${
                  isForClient
                    ? 'bg-forest-accent/90 text-white shadow-sm'
                    : 'text-forest-muted hover:bg-white/55 hover:text-forest-accent'
                }`}
              >
                客户
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 sm:space-y-4">
        {!isDailyMode && (
          <div>
            <input
              data-required-field="question"
              aria-invalid={highlightedRequiredField === 'question'}
              className={`min-h-11 w-full rounded-xl border px-3 py-2 text-sm text-forest-ink transition-all placeholder:text-forest-muted/50 focus:ring-2 sm:px-4 sm:py-2.5 sm:text-base ${
                highlightedRequiredField === 'question'
                  ? 'border-forest-pink/35 bg-forest-pink/6 ring-2 ring-forest-pink/10 focus:ring-forest-pink/15'
                  : 'border-forest-accent/8 bg-white/42 focus:ring-forest-accent/15'
              }`}
              placeholder="占卜的问题是什么？" 
              value={question} 
              onFocus={scrollFocusedFieldIntoView}
              onChange={e => onUpdateQuestion(e.target.value)} 
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-2.5">
          <div className="relative min-w-0 sm:flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-accent/40 pointer-events-none">
              <Calendar size={16} />
            </div>
            <input 
              type="date" 
              className="min-h-11 w-full rounded-xl border border-forest-accent/8 bg-white/42 py-2 pl-9 pr-2 text-sm text-forest-ink transition-all focus:ring-2 focus:ring-forest-accent/15 sm:py-2.5 sm:pl-10 sm:pr-4 sm:text-base"
              value={date} 
              onFocus={scrollFocusedFieldIntoView}
              onChange={e => onUpdateDate(e.target.value)} 
            />
          </div>

          <div className="relative min-w-0 sm:flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-accent/40 pointer-events-none">
              <Tag size={16} />
            </div>
            <input 
              className="min-h-11 w-full rounded-xl border border-forest-accent/8 bg-white/42 py-2 pl-9 pr-2 text-sm text-forest-ink transition-all placeholder:text-forest-muted/50 focus:ring-2 focus:ring-forest-accent/15 sm:py-2.5 sm:pl-10 sm:pr-4 sm:text-base"
              placeholder="添加标签..." 
              value={category} 
              onFocus={scrollFocusedFieldIntoView}
              onChange={e => onUpdateCategory(e.target.value)} 
            />
          </div>
        </div>

        {quickThemeSlot}

        <div className="space-y-1.5 sm:space-y-2">
          <div
            data-testid="spread-control-bar"
            className="rounded-xl border border-forest-accent/7 bg-white/22 p-1"
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 sm:flex sm:gap-2">
              <div className="flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap px-1 text-[11px] font-semibold text-forest-accent sm:min-h-10 sm:px-1.5 sm:text-sm">
                  <Layers size={14} />
                  <span className="sr-only">牌阵：</span>
                  <span aria-hidden="true" className="hidden min-[360px]:inline">牌阵</span>
                  {isSelectedCustomSpread && (
                    <span className="hidden rounded-full bg-forest-pink/10 px-2 py-0.5 text-[10px] text-forest-pink min-[430px]:inline">
                      自定义
                    </span>
                  )}
              </div>
              <div className="relative min-w-0 sm:flex-1">
                <select
                  data-required-field="spread"
                  aria-invalid={highlightedRequiredField === 'spread'}
                  className={`min-h-11 w-full appearance-none rounded-lg border py-2 pl-2.5 pr-7 text-sm font-medium text-forest-ink transition-all focus:ring-2 sm:min-h-10 sm:pl-3 sm:pr-9 ${
                    highlightedRequiredField === 'spread'
                      ? 'border-forest-pink/35 bg-forest-pink/6 ring-2 ring-forest-pink/10 focus:ring-forest-pink/15'
                      : 'border-forest-accent/7 bg-white/50 focus:ring-forest-accent/15'
                  }`}
                  value={spread}
                  onChange={(e) => {
                    const spreadDef = spreads.find(s => s.name === e.target.value);
                    if (spreadDef) onSelectSpread(spreadDef);
                  }}
                >
                  <optgroup label="官方牌阵">
                    {officialSpreads.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </optgroup>
                  {customSpreads.length > 0 && (
                    <optgroup label={`自定义牌阵 (${customSpreads.length})`}>
                      {customSpreads.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </optgroup>
                  )}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-forest-accent/40 sm:right-3"><ChevronDown size={14} /></div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={onOpenSpreadManager}
                  aria-label={`编辑当前牌阵 ${spread}`}
                  className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-forest-accent/7 bg-white/36 px-2 text-xs font-medium text-forest-muted transition-all hover:border-forest-accent/20 hover:bg-white/60 hover:text-forest-accent sm:min-h-10 sm:min-w-[4.5rem] sm:px-2.5"
                  title="编辑当前牌阵"
                >
                  <Layers size={14} />
                  <span className={isSelectedCustomSpread ? 'sr-only sm:not-sr-only' : 'hidden min-[380px]:inline'}>编辑</span>
                </button>
                <button
                  type="button"
                  onClick={onCreateSpread}
                  aria-label="新建自定义牌阵"
                  className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-forest-accent/7 bg-white/36 px-2 text-xs font-medium text-forest-accent transition-all hover:border-forest-accent/20 hover:bg-white/60 sm:min-h-10 sm:min-w-[4.5rem] sm:px-2.5"
                  title="新建自定义牌阵"
                >
                  <Plus size={14} />
                  <span className={isSelectedCustomSpread ? 'sr-only sm:not-sr-only' : 'hidden min-[380px]:inline'}>新建</span>
                </button>
                {isSelectedCustomSpread && (
                  <button
                    type="button"
                    onClick={() => onDeleteSpread?.(spread)}
                    aria-label={`删除当前自定义牌阵 ${spread}`}
                    className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50/55 px-2 text-xs font-medium text-red-500 transition-all hover:border-red-200 hover:bg-red-50 sm:min-h-10 sm:min-w-[4.5rem] sm:px-2.5"
                    title="删除当前自定义牌阵"
                  >
                    <Trash2 size={14} />
                    <span className="sr-only sm:not-sr-only">删除</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {isMultiCard && (
            <>
              <div
                data-testid="mobile-slot-quick-nav"
                className="rounded-xl border border-forest-accent/7 bg-white/22 p-1 sm:hidden"
              >
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-hide">
                  {cardSlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSetActiveSlotIndex(i)}
                      aria-label={`跳到第 ${i + 1} 个位置：${slot.label || `位置 ${i + 1}`}`}
                      className={`min-h-11 shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
                        activeSlotIndex === i
                          ? 'bg-forest-accent/92 text-white'
                          : 'bg-white/42 text-forest-muted hover:bg-white/66 hover:text-forest-accent'
                      }`}
                    >
                      {i + 1} {slot.label || `位置 ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hidden items-center justify-between gap-1 overflow-hidden rounded-xl border border-forest-accent/7 bg-white/22 p-0.5 sm:flex sm:gap-2 sm:p-1">
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto custom-scrollbar-hide px-0.5 py-0.5">
                  {cardSlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSetActiveSlotIndex(i)}
                      className={`min-h-11 rounded-lg px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-all sm:min-h-10 sm:px-2.5 sm:text-xs ${activeSlotIndex === i ? 'bg-forest-accent/90 text-white' : 'text-forest-muted hover:bg-white/56 hover:text-forest-accent'}`}
                    >
                      {i + 1}. {slot.label || `位置 ${i + 1}`}
                    </button>
                  ))}
                </div>
                {canAddSlot && (
                  <button
                    type="button"
                    onClick={onAddSlot}
                    className="flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-forest-accent/8 bg-white/42 text-forest-accent transition-all hover:bg-white/66"
                    title="添加位置"
                    aria-label="添加自定义位置"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
