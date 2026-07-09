import React from 'react';
import { ChevronDown, Layers, Plus, User, Calendar, Tag } from 'lucide-react';
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
  onCancel
}) => {
  const officialSpreadNames = new Set(OFFICIAL_SPREADS.map(item => item.name));
  const officialSpreads = spreads.filter(item => officialSpreadNames.has(item.name));
  const customSpreads = spreads.filter(item => !officialSpreadNames.has(item.name));
  const isSelectedCustomSpread = customSpreads.some(item => item.name === spread);
  const scrollFocusedFieldIntoView = (event: React.FocusEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = event.currentTarget;

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  };

  return (
    <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
      <div className="sticky top-0 z-30 flex flex-col gap-1.5 border-b border-forest-accent/5 bg-white/85 pb-2 backdrop-blur-md sm:gap-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif text-forest-accent sm:text-2xl">{initialData ? '修改手记' : '抽牌手记'}</h2>
          <div className="flex items-center gap-3">
            {initialData && (
              <button type="button" onClick={onCancel} className="min-h-11 sm:min-h-10 px-3 text-xs font-medium text-forest-muted hover:text-forest-accent transition-colors rounded-xl">取消修改</button>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2 rounded-xl border border-forest-accent/5 bg-forest-accent/5 px-2.5 py-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-forest-accent">
            <User size={14} />
            {isForClient ? '👤 为客户记录' : '👤 为自己记录'}
          </div>
          <button 
            type="button"
            onClick={onToggleClientMode}
            className="min-h-11 sm:min-h-10 rounded-xl px-2.5 text-xs font-bold text-forest-accent transition-colors hover:bg-forest-accent/5"
          >
            切换至{isForClient ? '个人' : '客户'}模式 →
          </button>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {!isDailyMode && (
          <div>
            <input 
              required 
              className="w-full rounded-xl border border-forest-accent/5 bg-forest-accent/5 px-4 py-2.5 text-forest-ink transition-all placeholder:text-forest-muted/50 focus:ring-2 focus:ring-forest-accent/20"
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
              className="w-full rounded-xl border border-forest-accent/5 bg-forest-accent/5 py-2.5 pl-10 pr-4 text-forest-ink transition-all focus:ring-2 focus:ring-forest-accent/20"
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
              className="w-full rounded-xl border border-forest-accent/5 bg-forest-accent/5 py-2.5 pl-10 pr-4 text-forest-ink transition-all placeholder:text-forest-muted/50 focus:ring-2 focus:ring-forest-accent/20"
              placeholder="添加标签..." 
              value={category} 
              onFocus={scrollFocusedFieldIntoView}
              onChange={e => onUpdateCategory(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid gap-1.5 rounded-xl border border-forest-accent/5 bg-forest-accent/5 p-1.5 sm:grid-cols-[auto_minmax(12rem,22rem)_6.25rem] sm:items-start">
            <div className="flex min-h-11 items-center gap-1.5 px-1.5 text-xs font-bold text-forest-accent whitespace-nowrap sm:min-h-10 sm:text-sm">
                <Layers size={14} />
                牌阵：
                {isSelectedCustomSpread && (
                  <span className="rounded-full bg-forest-pink/10 px-2 py-0.5 text-[10px] text-forest-pink">
                    自定义
                  </span>
                )}
            </div>
            <div className="relative min-w-0">
              <select 
                className="min-h-11 w-full appearance-none rounded-lg border border-forest-accent/5 bg-white py-2 pl-3 pr-9 text-sm font-medium text-forest-ink transition-all focus:ring-2 focus:ring-forest-accent/20"
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
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-forest-accent/40"><ChevronDown size={14} /></div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
              <button 
                type="button" 
                onClick={onOpenSpreadManager}
                aria-label={`编辑当前牌阵 ${spread}`}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-forest-accent/10 bg-white px-3 py-2 text-xs font-bold text-forest-muted shadow-sm transition-all hover:border-forest-accent hover:text-forest-accent sm:min-h-10"
                title="编辑当前牌阵"
              >
                <Layers size={14} />
                <span>编辑</span>
              </button>
              <button
                type="button"
                onClick={onCreateSpread}
                aria-label="新建自定义牌阵"
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-forest-accent/10 bg-white px-3 py-2 text-xs font-bold text-forest-accent shadow-sm transition-all hover:border-forest-accent hover:bg-forest-accent hover:text-white sm:min-h-10"
                title="新建自定义牌阵"
              >
                <Plus size={14} />
                <span>新建</span>
              </button>
            </div>
          </div>

          {isMultiCard && (
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-forest-accent/5 bg-forest-accent/5 px-2.5 py-1.5 text-[11px] font-bold text-forest-muted sm:hidden">
                <span className="text-forest-accent">当前 {activeSlotIndex + 1}/{cardSlots.length}</span>
                <span className="min-w-0 truncate">{cardSlots[activeSlotIndex]?.label || `位置 ${activeSlotIndex + 1}`}</span>
              </div>
              <div className="hidden items-center justify-between gap-1 overflow-hidden rounded-xl border border-forest-accent/5 bg-forest-accent/5 p-0.5 sm:flex sm:gap-2 sm:p-1">
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto custom-scrollbar-hide px-0.5 py-0.5">
                  {cardSlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSetActiveSlotIndex(i)}
                      className={`min-h-11 sm:min-h-10 rounded-lg px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-all sm:px-2.5 sm:text-xs ${activeSlotIndex === i ? 'bg-forest-accent text-white shadow-sm' : 'text-forest-muted hover:bg-white hover:text-forest-accent'}`}
                    >
                      {i + 1}. {slot.label || `位置 ${i + 1}`}
                    </button>
                  ))}
                </div>
                {canAddSlot && (
                  <button
                    type="button"
                    onClick={onAddSlot}
                    className="flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-forest-accent/10 bg-white text-forest-accent shadow-sm transition-all hover:bg-forest-accent hover:text-white"
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
