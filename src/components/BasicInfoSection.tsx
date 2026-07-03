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

  return (
    <div className="space-y-6 mb-8">
      <div className="flex flex-col gap-4 sticky top-0 bg-white/80 backdrop-blur-md z-30 pb-4 border-b border-forest-accent/5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif text-forest-accent">{initialData ? '修改手记' : '抽牌手记'}</h2>
          <div className="flex items-center gap-3">
            {initialData && (
              <button type="button" onClick={onCancel} className="min-h-12 px-3 text-xs font-medium text-forest-muted hover:text-forest-accent transition-colors rounded-xl">取消修改</button>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-forest-accent/5 p-2 rounded-xl border border-forest-accent/5">
          <div className="flex items-center gap-2 text-sm font-medium text-forest-accent">
            <User size={16} />
            {isForClient ? '👤 为客户记录' : '👤 为自己记录'}
          </div>
          <button 
            type="button"
            onClick={onToggleClientMode}
            className="min-h-12 px-3 text-xs font-bold text-forest-accent hover:bg-forest-accent/5 rounded-xl flex items-center gap-1 transition-colors"
          >
            切换至{isForClient ? '个人' : '客户'}模式 →
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {!isDailyMode && (
          <div className="space-y-2">
            <input 
              required 
              className="w-full px-4 py-3 bg-forest-accent/5 border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all text-forest-ink placeholder:text-forest-muted/50" 
              placeholder="占卜的问题是什么？" 
              value={question} 
              onChange={e => onUpdateQuestion(e.target.value)} 
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-accent/40 pointer-events-none">
              <Calendar size={16} />
            </div>
            <input 
              type="date" 
              className="w-full pl-10 pr-4 py-3 bg-forest-accent/5 border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all text-forest-ink" 
              value={date} 
              onChange={e => onUpdateDate(e.target.value)} 
            />
          </div>

          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-accent/40 pointer-events-none">
              <Tag size={16} />
            </div>
            <input 
              className="w-full pl-10 pr-4 py-3 bg-forest-accent/5 border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all text-forest-ink placeholder:text-forest-muted/50" 
              placeholder="添加标签..." 
              value={category} 
              onChange={e => onUpdateCategory(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-forest-accent/5 p-2 rounded-xl border border-forest-accent/5">
            <div className="flex items-center gap-2 px-3 text-sm font-bold text-forest-accent whitespace-nowrap">
              <Layers size={14} />
              牌阵：
              {isSelectedCustomSpread && (
                <span className="rounded-full bg-forest-pink/10 px-2 py-0.5 text-[10px] text-forest-pink">
                  自定义
                </span>
              )}
            </div>
            <div className="flex-1 relative w-full">
              <select 
                className="min-h-12 w-full pl-4 pr-10 py-2 bg-white border border-forest-accent/5 rounded-lg focus:ring-2 focus:ring-forest-accent/20 appearance-none transition-all text-sm font-medium text-forest-ink"
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
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              <button 
                type="button" 
                onClick={onOpenSpreadManager}
                aria-label={`编辑当前牌阵 ${spread}`}
                className="min-h-12 flex flex-1 items-center justify-center gap-2 rounded-lg border border-forest-accent/10 bg-white px-4 py-2 text-xs font-bold text-forest-muted shadow-sm transition-all hover:border-forest-accent hover:text-forest-accent sm:flex-none"
                title="编辑当前牌阵"
              >
                <Layers size={14} />
                <span>编辑牌阵</span>
              </button>
              <button
                type="button"
                onClick={onCreateSpread}
                aria-label="新建自定义牌阵"
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-forest-accent/10 bg-white px-4 py-2 text-xs font-bold text-forest-accent shadow-sm transition-all hover:border-forest-accent hover:bg-forest-accent hover:text-white sm:flex-none"
                title="新建自定义牌阵"
              >
                <Plus size={14} />
                <span>新建</span>
              </button>
            </div>
          </div>

          {isMultiCard && (
            <div className="flex items-center justify-between gap-3 overflow-hidden bg-forest-accent/5 p-1 rounded-xl border border-forest-accent/5">
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-hide px-1 py-1">
                {cardSlots.map((slot, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSetActiveSlotIndex(i)}
                    className={`min-h-12 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeSlotIndex === i ? 'bg-forest-accent text-white shadow-sm' : 'text-forest-muted hover:bg-white hover:text-forest-accent'}`}
                  >
                    {i + 1}. {slot.label || `位置 ${i + 1}`}
                  </button>
                ))}
              </div>
              <button 
                type="button" 
                onClick={onAddSlot} 
                className="w-11 h-11 bg-white text-forest-accent rounded-lg border border-forest-accent/10 hover:bg-forest-accent hover:text-white transition-all shadow-sm shrink-0 flex items-center justify-center"
                title="添加位置"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
