import React from 'react';
import { motion } from 'motion/react';
import { Layers, X, Plus, RotateCcw } from 'lucide-react';
import { SpreadDefinition } from '../types';
import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import { DesignerSlot } from './DesignerSlot';
import { SpreadGridControls } from './SpreadGridControls';

interface SpreadDesignerProps {
  spreads: SpreadDefinition[];
  currentSpread: string;
  layoutType: string;
  cardSlots: any[];
  designActiveSlot: number;
  newSpreadName: string;
  isEditingSession?: boolean;
  onSelectSpread: (spread: SpreadDefinition) => void;
  onDeleteSpread: (name: string) => void;
  onSaveSpread: () => void;
  onUpdateNewSpreadName: (name: string) => void;
  onUpdateLayoutType: (layout: string) => void;
  onUpdateSlotPosition: (col: number, row: number) => void;
  onSwapSlotIndex: (oldIdx: number, newIdx: number) => void;
  onUpdateSlotLabel: (idx: number, label: string) => void;
  onSetDesignActiveSlot: (idx: number) => void;
  onRemoveSlot: (idx: number) => void;
  onRestoreDefaults: (name?: string) => void;
  onUpdateGrid?: (cols: number, rows: number) => void;
  gridCols?: number;
  gridRows?: number;
  onStartNewSession?: () => void;
  onClose?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
  onShiftSlots?: (dx: number, dy: number) => void;
  onCenterSpread?: () => void;
}

export const SpreadDesigner: React.FC<SpreadDesignerProps> = ({
  spreads,
  currentSpread,
  layoutType,
  cardSlots,
  designActiveSlot,
  newSpreadName,
  isEditingSession,
  onSelectSpread,
  onDeleteSpread,
  onSaveSpread,
  onUpdateNewSpreadName,
  onUpdateLayoutType,
  onUpdateSlotPosition,
  onSwapSlotIndex,
  onUpdateSlotLabel,
  onSetDesignActiveSlot,
  onRemoveSlot,
  onRestoreDefaults,
  onUpdateGrid,
  gridCols = 5,
  gridRows = 5,
  onStartNewSession,
  onClose,
  canUndo,
  onUndo,
  onShiftSlots,
  onCenterSpread
}) => {
  const [longPressTimer, setLongPressTimer] = React.useState<NodeJS.Timeout | null>(null);
  const [isLongPressActive, setIsLongPressActive] = React.useState(false);
  const [saveOptionsVisible, setSaveOptionsVisible] = React.useState(false);

  const handleLongPressStart = (index: number) => {
    setIsLongPressActive(false);
    const timer = setTimeout(() => {
      onRemoveSlot(index);
      setIsLongPressActive(true);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      setLongPressTimer(null);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleSlotClick = (col: number, row: number) => {
    if (isLongPressActive) {
      setIsLongPressActive(false);
      return;
    }
    onUpdateSlotPosition(col, row);
  };

  const isOfficial = OFFICIAL_SPREADS.some(os => os.name === currentSpread);
  
  return (
    <div className="p-4 bg-forest-bg rounded-2xl border border-forest-accent/20 overflow-hidden space-y-4 shadow-lg ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-forest-accent/10 pb-3">
        <div className="flex items-center gap-2">
          {isEditingSession ? (
            <div className="flex items-center gap-2 bg-forest-accent/10 text-forest-accent px-3 py-1 rounded-full border border-forest-accent/20">
              <Plus size={14} className="animate-pulse" />
              <span className="text-xs font-bold">正在创作新牌阵</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-forest-muted px-1">
              <Layers size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">牌阵库管理</span>
            </div>
          )}
        </div>
        <button 
          type="button" 
          onClick={onClose}
          className="p-1.5 hover:bg-forest-accent/5 rounded-full text-forest-muted transition-colors"
          title="退出编辑器"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-forest-muted uppercase tracking-wider font-bold">
            快速载入备选牌阵
          </p>
          <div className="flex items-center gap-2">
            {isOfficial && (
              <button
                type="button"
                onClick={() => onRestoreDefaults(currentSpread)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] bg-white text-forest-muted border border-dashed border-forest-accent/20 hover:border-forest-accent/40 hover:text-forest-accent transition-all"
                title={`恢复“${currentSpread}”到官方默认状态`}
              >
                <RotateCcw size={10} />
                <span>还原当前官方</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onRestoreDefaults()}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] bg-forest-accent/5 text-forest-accent border border-forest-accent/10 hover:bg-forest-accent/10 transition-all"
              title="恢复全部官方牌阵到初始状态"
            >
              <RotateCcw size={10} />
              <span>还原全部官方</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {spreads.map(s => {
            const isActive = currentSpread === s.name;
            return (
              <div 
                key={s.name} 
                className={`flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full text-[10px] transition-all cursor-pointer border ${
                  isActive 
                    ? 'bg-forest-accent text-white border-forest-accent shadow-md scale-105' 
                    : 'bg-white text-forest-ink border-forest-accent/10 hover:border-forest-accent/30 hover:bg-forest-bg'
                }`}
                onClick={() => onSelectSpread(s)}
              >
                <span className="font-medium">{s.name}</span>
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSpread(s.name);
                  }}
                  className={`p-0.5 rounded-full transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-red-50 text-forest-muted hover:text-red-500'}`}
                  title="删除此牌阵"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
          <button 
            type="button" 
            onClick={onStartNewSession}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] bg-white text-forest-accent border border-dashed border-forest-accent/40 hover:bg-forest-accent/5 hover:border-forest-accent transition-all"
          >
            <Plus size={12} />
            <span>开始新创作</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5 pt-1.5 border-t border-forest-accent/5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-forest-muted uppercase tracking-wider font-bold">编辑器画布</p>
        </div>
        <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <input 
                  className="w-full px-3 py-1.5 text-xs bg-white border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20"
                  placeholder={isOfficial ? `${currentSpread} (自定义)` : "新牌阵名称..."}
                  value={newSpreadName}
                  onChange={e => onUpdateNewSpreadName(e.target.value)}
                />
              </div>
              <div className="w-32">
                <select 
                  className="w-full px-3 py-1.5 text-xs bg-white border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 appearance-none"
                  value={layoutType}
                  onChange={e => onUpdateLayoutType(e.target.value)}
                >
                  {Object.entries(LAYOUT_TEMPLATES).map(([key, template]) => (
                    <option key={key} value={key}>{template.name}</option>
                  ))}
                </select>
              </div>
              {canUndo && (
                <button 
                  type="button"
                  onClick={onUndo}
                  className="p-1.5 bg-white border border-forest-accent/20 text-forest-accent rounded-lg hover:bg-forest-accent/5 transition-colors flex items-center gap-1 text-xs"
                  title="撤回上一步"
                >
                  <RotateCcw size={14} />
                  <span>撤回</span>
                </button>
              )}
              <button 
                type="button"
                onClick={() => {
                   onSaveSpread();
                   setSaveOptionsVisible(true);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                  isOfficial && !newSpreadName 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : 'bg-forest-accent hover:bg-forest-accent/90 text-white'
                }`}
              >
                {isOfficial && !newSpreadName ? '自定义此牌阵' : '保存牌阵'}
              </button>
            </div>

          {saveOptionsVisible && (
            <div className="bg-forest-accent/5 border border-forest-accent/20 p-3 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                <span className="text-[11px] font-bold text-forest-accent">牌阵已保存！</span>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setSaveOptionsVisible(false)}
                  className="px-3 py-1 text-[10px] bg-white text-forest-muted rounded border border-forest-accent/10 hover:text-forest-accent transition-colors"
                >
                  留在编辑器
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setSaveOptionsVisible(false);
                    if (onClose) onClose();
                  }}
                  className="px-3 py-1 text-[10px] bg-forest-accent text-white rounded hover:bg-forest-accent/90 transition-colors font-bold"
                >
                  应用并退出
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-3 rounded-2xl border border-forest-accent/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-forest-accent/5 pb-1.5">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-forest-accent">可视化牌阵编辑器</p>
                <div className="flex items-center gap-4">
                  <p className="text-[9px] text-forest-muted">正在构建自定义布局</p>
                  <SpreadGridControls 
                    gridCols={gridCols}
                    gridRows={gridRows}
                    onUpdateGrid={onUpdateGrid || (() => {})}
                    onShiftSlots={onShiftSlots || (() => {})}
                    onCenterSpread={onCenterSpread || (() => {})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center py-1 overflow-x-auto">
              <div 
                className="grid gap-2 p-2 bg-forest-bg/50 rounded-2xl border border-forest-accent/10 relative transition-all duration-500"
                style={{ 
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  width: `max-content`,
                  minWidth: `${Math.min(100, gridCols * 50)}px`
                }}
              >
                {Array.from({ length: gridCols * gridRows }).map((_, i) => {
                  const row = Math.floor(i / gridCols) + 1;
                  const col = (i % gridCols) + 1;
                  const posStr = `col-start-${col} row-start-${row}`;
                  const slotIndices = cardSlots.map((s, idx) => s.position === posStr ? idx : -1).filter(idx => idx !== -1);
                  const isCelticCenter = (layoutType === 'celtic' || currentSpread === '凯尔特十字牌阵') && posStr === 'col-start-2 row-start-2';
                  
                  const hasSlots = slotIndices.length > 0;
                  const isActive = slotIndices.includes(designActiveSlot);

                  return (
                    <div key={posStr} className={`relative group aspect-[2/3] w-12 sm:w-14 ${isCelticCenter ? 'z-20' : 'z-10'}`}>
                      <div className={`absolute inset-0 -m-1 rounded-xl border-2 transition-all pointer-events-none ${
                        hasSlots 
                          ? isActive ? 'border-forest-accent/40 bg-forest-accent/5' : 'border-forest-accent/10'
                          : 'border-transparent group-hover:border-forest-accent/20 group-hover:bg-forest-accent/5'
                      }`} />
                      
                      <div className="w-full h-full relative flex items-center justify-center">
                        {hasSlots ? (
                          slotIndices.map((idx, i) => (
                            <DesignerSlot 
                              key={idx}
                              idx={idx}
                              isActive={idx === designActiveSlot}
                              slot={{...cardSlots[idx], isStacked: slotIndices.length > 1}}
                              isCelticCenter={isCelticCenter}
                              stackIndex={i}
                              onSetActive={onSetDesignActiveSlot}
                              onUpdateLabel={onUpdateSlotLabel}
                              onSwapSlotIndex={onSwapSlotIndex}
                              onRemove={onRemoveSlot}
                            />
                          ))
                        ) : (
                          <div
                            onClick={() => handleSlotClick(col, row)}
                            className="w-full h-full rounded-lg transition-all flex items-center justify-center bg-white/40 border border-dashed border-forest-accent/10 hover:bg-white hover:border-forest-accent/30 cursor-pointer"
                          >
                            <Plus size={16} className="text-forest-accent/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pt-2 text-center">
              <p className="text-[9px] text-forest-muted">
                提示：点击空白处直接添加，点击已有牌移除。点击数字编号可手动调整顺序。
              </p>
            </div>
          </div>
        </div>
        <p className="text-[8px] text-forest-muted">提示：选择“自由网格”或“十字布局”等网格布局后，可以精确设置每张牌的行列位置。</p>
      </div>
    </div>
  );
}
