import React from 'react';
import { ChevronDown, Layers, Plus, User, Calendar, Tag, Mail } from 'lucide-react';
import { SpreadDefinition } from '../types';

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
  onOpenEmailModal?: () => void;
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
  isMultiCard,
  activeSlotIndex,
  onSetActiveSlotIndex,
  cardSlots,
  onAddSlot,
  isDailyMode,
  isForClient,
  onToggleClientMode,
  initialData,
  onCancel,
  onOpenEmailModal
}) => {
  return (
    <div className="space-y-6 mb-8">
      <div className="flex flex-col gap-4 sticky top-0 bg-white/80 backdrop-blur-md z-30 pb-4 border-b border-forest-accent/5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif text-forest-accent">{initialData ? '修改手记' : '抽牌手记'}</h2>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onOpenEmailModal}
              className="flex items-center gap-2 px-3 py-1.5 bg-white text-forest-muted hover:text-forest-accent border border-forest-accent/10 rounded-full text-xs font-bold transition-all shadow-sm group"
              title="发送至邮箱"
            >
              <Mail size={14} className="group-hover:scale-110 transition-transform" />
              <span>邮件分享</span>
            </button>
            {initialData && (
              <button type="button" onClick={onCancel} className="text-xs font-medium text-forest-muted hover:text-forest-accent transition-colors">取消修改</button>
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
            className="text-xs font-bold text-forest-accent hover:underline flex items-center gap-1"
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
            </div>
            <div className="flex-1 relative w-full">
              <select 
                className="w-full pl-4 pr-10 py-2 bg-white border border-forest-accent/5 rounded-lg focus:ring-2 focus:ring-forest-accent/20 appearance-none transition-all text-sm font-medium text-forest-ink"
                value={spread}
                onChange={(e) => {
                  const spreadDef = spreads.find(s => s.name === e.target.value);
                  if (spreadDef) onSelectSpread(spreadDef);
                }}
              >
                {spreads.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-forest-accent/40"><ChevronDown size={14} /></div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button" 
                onClick={onOpenSpreadManager}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-forest-accent/10 rounded-lg text-xs font-bold text-forest-muted hover:text-forest-accent hover:border-forest-accent transition-all shadow-sm shrink-0"
                title="管理已有牌阵或创作新牌阵"
              >
                <Layers size={14} />
                <span>牌阵工作台</span>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeSlotIndex === i ? 'bg-forest-accent text-white shadow-sm' : 'text-forest-muted hover:bg-white hover:text-forest-accent'}`}
                  >
                    {i + 1}. {slot.label || `位置 ${i + 1}`}
                  </button>
                ))}
              </div>
              <button 
                type="button" 
                onClick={onAddSlot} 
                className="p-1.5 bg-white text-forest-accent rounded-lg border border-forest-accent/10 hover:bg-forest-accent hover:text-white transition-all shadow-sm shrink-0"
                title="添加牌位"
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
