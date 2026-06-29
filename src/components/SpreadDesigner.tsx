import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, X, Plus, RotateCcw, Grid3X3, Wand2, FolderOpen, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { SpreadDefinition, ReadingSlotData } from '../types';
import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import { DesignerSlot } from './DesignerSlot';
import { SpreadGridControls } from './SpreadGridControls';
import { FreeLayoutEditor } from './FreeLayoutEditor';

export type FreeLayoutSaveMode = 'original' | 'adaptive';

interface SpreadDesignerProps {
  spreads: SpreadDefinition[];
  currentSpread: string;
  layoutType: string;
  cardSlots: ReadingSlotData[];
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
  onSetDesignActiveSlot: (idx: number, fromSelect?: boolean) => void;
  onRemoveSlot: (idx: number) => void;
  onRestoreDefaults: (name?: string) => void;
  onUpdateGrid?: (cols: number, rows: number) => void;
  gridCols?: number;
  gridRows?: number;
  onStartNewSession?: () => void;
  onClose?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
  onUpdateSlots?: (slots: ReadingSlotData[]) => void;
  onShiftSlots?: (dx: number, dy: number) => void;
  onCenterSpread?: () => void;
  freeLayoutSaveMode?: FreeLayoutSaveMode;
  onUpdateFreeLayoutSaveMode?: (mode: FreeLayoutSaveMode) => void;
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
  onUpdateSlots,
  onShiftSlots,
  onCenterSpread,
  freeLayoutSaveMode = 'original',
  onUpdateFreeLayoutSaveMode
}) => {
  const [editMode, setEditMode] = useState<'grid' | 'free'>(layoutType === 'free' ? 'free' : 'grid');
  const [saveOptionsVisible, setSaveOptionsVisible] = useState(false);

  useEffect(() => {
    setEditMode(layoutType === 'free' ? 'free' : 'grid');
  }, [layoutType]);

  const currentTemplate = LAYOUT_TEMPLATES[layoutType as keyof typeof LAYOUT_TEMPLATES] || LAYOUT_TEMPLATES['horizontal'];
  const itemClasses = currentTemplate.itemClasses;
  const designerSlotSizeClass = cardSlots.length > 3 ? 'w-16 sm:w-20' : 'w-20 sm:w-24';
  const designerGridGapClass = cardSlots.length > 3 ? 'gap-2 sm:gap-4' : 'gap-3 sm:gap-4';
  
  const isOfficialSpread = OFFICIAL_SPREADS.some(s => s.name === currentSpread);
  const isCelticCross = layoutType === 'celtic' || currentSpread === '凯尔特十字牌阵';

  const handleSlotClick = (col: number, row: number) => {
    onUpdateSlotPosition(col, row);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-forest-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <motion.div 
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-forest-accent/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-forest-accent/10 text-forest-accent rounded-xl">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-forest-ink">牌阵工作台</h2>
              <p className="text-[10px] text-forest-muted font-medium uppercase tracking-wider">
                {currentSpread ? (isEditingSession ? '编辑牌阵' : '套用已有牌阵') : '空白创作牌阵'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveSpread}
              className="min-h-11 rounded-xl bg-forest-accent px-3 py-2 text-xs font-bold text-white shadow-lg shadow-forest-accent/20 transition-all hover:bg-forest-accent/90"
            >
              {currentSpread && isEditingSession ? '保存修改' : '保存并使用'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 p-2 hover:bg-forest-bg rounded-xl transition-colors"
            >
              <X size={20} className="text-forest-muted" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
              <select
                value={currentSpread}
                onChange={(e) => {
                  const selectedSpread = spreads.find(s => s.name === e.target.value);
                  if (selectedSpread) {
                    onSelectSpread(selectedSpread);
                  }
                  onSetDesignActiveSlot(-1);
                }}
                className="w-full pl-10 pr-4 py-3 bg-forest-bg border border-forest-accent/10 rounded-xl text-sm focus:ring-2 focus:ring-forest-accent/20 appearance-none cursor-pointer"
              >
                <option value="">空白创作，不套用模板</option>
                {OFFICIAL_SPREADS.map(spread => (
                  <option key={spread.name} value={spread.name}>{spread.name}</option>
                ))}
                <option disabled>--- 自定义 ---</option>
                {spreads.filter(s => !OFFICIAL_SPREADS.some(os => os.name === s.name)).map(spread => (
                  <option key={spread.name} value={spread.name}>{spread.name}</option>
                ))}
              </select>
            </div>
            
            <button
              type="button"
              onClick={() => {
                onUpdateNewSpreadName('我的新牌阵');
                onSetDesignActiveSlot(-1);
                onStartNewSession?.();
              }}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-forest-accent to-forest-pink text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all whitespace-nowrap"
            >
              <Plus size={18} />
              空白创作
            </button>
            
            <input
              type="text"
              value={newSpreadName}
              onChange={(e) => onUpdateNewSpreadName(e.target.value)}
              placeholder="牌阵名称..."
              className="w-48 px-4 py-3 bg-forest-bg border border-forest-accent/10 rounded-xl text-sm focus:ring-2 focus:ring-forest-accent/20"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center bg-forest-bg rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  setEditMode('grid');
                  if (layoutType === 'free') {
                    onUpdateLayoutType('custom');
                  }
                  if (gridCols > 10 || gridRows > 8) {
                    onUpdateGrid?.(Math.min(gridCols, 7), Math.min(gridRows, 7));
                  }
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  editMode === 'grid' 
                    ? 'bg-white text-forest-accent shadow-sm' 
                    : 'text-forest-muted hover:text-forest-accent'
                }`}
              >
                <Grid3X3 size={12} />
                <span>网格模式</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode('free');
                  onUpdateLayoutType('free');
                  onUpdateGrid?.(20, 12);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  editMode === 'free' 
                    ? 'bg-white text-forest-accent shadow-sm' 
                    : 'text-forest-muted hover:text-forest-accent'
                }`}
              >
                <Sparkles size={12} />
                <span>自由画布</span>
              </button>
            </div>

            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
              editMode === 'free' 
                ? 'bg-forest-pink/10 text-forest-pink' 
                : 'bg-forest-accent/10 text-forest-accent'
            }`}>
              {editMode === 'free' ? '自由摆放' : '网格布局'}
            </span>

            {editMode === 'grid' && (
              <SpreadGridControls
                gridCols={gridCols}
                gridRows={gridRows}
                onUpdateGrid={onUpdateGrid}
                onShiftSlots={onShiftSlots}
                onCenterSpread={onCenterSpread}
              />
            )}

            <div className="flex-1 flex justify-end gap-2">
              {canUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  className="px-3 py-1.5 text-xs text-forest-muted hover:text-forest-accent transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={12} /> 撤销
                </button>
              )}
              {isOfficialSpread && (
                <button
                  type="button"
                  onClick={() => onRestoreDefaults(currentSpread)}
                  className="px-3 py-1.5 text-xs text-forest-muted hover:text-amber-600 transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={12} /> 恢复默认
                </button>
              )}
              {!isOfficialSpread && spreads.some(s => s.name === newSpreadName) && (
                <button
                  type="button"
                  onClick={() => onDeleteSpread(newSpreadName)}
                  className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors rounded-lg flex items-center gap-1"
                >
                  <Trash2 size={12} /> 删除
                </button>
              )}
            </div>
          </div>

          <div className="flex w-full justify-start overflow-x-auto pb-2 sm:justify-center">
            {editMode === 'free' ? (
              <FreeLayoutEditor
                cardSlots={cardSlots}
                designActiveSlot={designActiveSlot}
                onSetDesignActiveSlot={(idx) => onSetDesignActiveSlot(idx, true)}
                onRemoveSlot={onRemoveSlot}
                onUpdateSlots={(slots) => {
                  onUpdateSlots?.(slots);
                }}
              />
            ) : (
              <div 
                className={`grid ${designerGridGapClass} p-2 rounded-2xl border border-forest-accent/10 bg-forest-bg/30`}
                style={{ 
                  gridTemplateColumns: `repeat(${gridCols}, max-content)`,
                  width: 'max-content'
                }}
              >
                {Array.from({ length: gridCols * gridRows }).map((_, i) => {
                  const row = Math.floor(i / gridCols) + 1;
                  const col = (i % gridCols) + 1;
                  const posStr = `col-start-${col} row-start-${row}`;
                  const slotIndices = cardSlots.map((slot, idx) => {
                    const slotPos = slot.position || (itemClasses[idx] || '');
                    return slotPos === posStr ? idx : -1;
                  }).filter(idx => idx !== -1);
                  const isCelticCenter = isCelticCross && posStr === 'col-start-2 row-start-2';
                  const hasSlots = slotIndices.length > 0;

                  return (
                    <div key={posStr} className={`relative aspect-[2/3.5] ${designerSlotSizeClass}`}>
                      <div className={`absolute inset-0 rounded-xl border-2 transition-all pointer-events-none ${
                        hasSlots 
                          ? designActiveSlot === slotIndices[0] ? 'border-forest-accent/40 bg-forest-accent/5' : 'border-forest-accent/10'
                          : 'border-transparent hover:border-forest-accent/20 hover:bg-forest-accent/5'
                      }`} />
                      
                      <div className="w-full h-full relative flex items-center justify-center">
                        {hasSlots ? (
                          slotIndices.map((idx: number, sIdx: number) => (
                            <DesignerSlot 
                              key={idx}
                              idx={idx}
                              isActive={designActiveSlot === idx}
                              slot={{...cardSlots[idx], isStacked: slotIndices.length > 1}}
                              isCelticCenter={isCelticCenter && slotIndices.length > 1}
                              stackIndex={sIdx}
                              onSetActive={(idx) => onSetDesignActiveSlot(idx, true)}
                              onUpdateLabel={onUpdateSlotLabel}
                              onSwapSlotIndex={onSwapSlotIndex}
                              onRemove={onRemoveSlot}
                            />
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSlotClick(col, row)}
                            className="w-full h-full rounded-lg border border-dashed border-forest-accent/10 hover:border-forest-accent/30 hover:bg-white/50 transition-all flex items-center justify-center"
                          >
                            <Plus size={14} className="text-forest-accent/30" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {editMode === 'grid' && (
            <div className="text-center">
              <p className="text-[9px] text-forest-muted">
                👆 网格模式：点击空白格子添加位置，点击已有位置移除或编辑
              </p>
            </div>
          )}

          {editMode === 'free' && onUpdateFreeLayoutSaveMode && (
            <div className="rounded-2xl border border-forest-accent/10 bg-forest-accent/5 p-3">
              <p className="mb-2 text-[10px] font-bold text-forest-accent">保存自由牌阵时</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateFreeLayoutSaveMode('original')}
                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    freeLayoutSaveMode === 'original'
                      ? 'bg-white text-forest-accent shadow-sm ring-1 ring-forest-accent/10'
                      : 'text-forest-muted hover:bg-white/60'
                  }`}
                >
                  保留原缩放
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateFreeLayoutSaveMode('adaptive')}
                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    freeLayoutSaveMode === 'adaptive'
                      ? 'bg-white text-forest-accent shadow-sm ring-1 ring-forest-accent/10'
                      : 'text-forest-muted hover:bg-white/60'
                  }`}
                >
                  自适应居中
                </button>
              </div>
            </div>
          )}

          <div className="-mx-6 -mb-6 rounded-b-[2rem] border-t border-forest-accent/10 bg-white/95 px-6 py-3 text-xs text-forest-muted backdrop-blur">
            <span>位置数量：{cardSlots.length}</span>
            {isCelticCross && <span className="ml-2 text-forest-accent">· 凯尔特十字模式</span>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
