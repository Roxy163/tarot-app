import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Layers, X, Plus, RotateCcw, Grid3X3, FolderOpen, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { SpreadDefinition, ReadingSlotData } from '../types';
import { DEFAULT_CUSTOM_SPREAD_NAME, LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import { DesignerSlot } from './DesignerSlot';
import { SpreadGridControls } from './SpreadGridControls';
import { FreeLayoutEditor } from './FreeLayoutEditor';

export type FreeLayoutSaveMode = 'original' | 'adaptive';

const useContainerWidth = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateWidth = () => setWidth(element.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};

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
  const { ref: designerPreviewRef, width: designerPreviewWidth } = useContainerWidth<HTMLDivElement>();

  useEffect(() => {
    setEditMode(layoutType === 'free' ? 'free' : 'grid');
  }, [layoutType]);

  const currentTemplate = LAYOUT_TEMPLATES[layoutType as keyof typeof LAYOUT_TEMPLATES] || LAYOUT_TEMPLATES['horizontal'];
  const itemClasses = currentTemplate.itemClasses;
  const designerSlotSizeClass = cardSlots.length > 3 ? 'w-16 sm:w-20' : 'w-20 sm:w-24';
  const designerGridGapClass = cardSlots.length > 3 ? 'gap-2 sm:gap-4' : 'gap-3 sm:gap-4';
  const designerBaseSlotWidth = cardSlots.length > 3 ? 64 : 80;
  const designerGap = cardSlots.length > 3 ? 8 : 12;
  const designerRawGridWidth = gridCols * designerBaseSlotWidth + Math.max(0, gridCols - 1) * designerGap;
  const designerScale = useMemo(() => {
    if (editMode !== 'grid' || designerPreviewWidth <= 0) return 1;
    return Math.min(1, designerPreviewWidth / Math.max(1, designerRawGridWidth + 8));
  }, [designerPreviewWidth, designerRawGridWidth, editMode]);
  
  const isOfficialSpread = OFFICIAL_SPREADS.some(s => s.name === currentSpread);
  const officialSpreadNames = new Set(OFFICIAL_SPREADS.map(spread => spread.name));
  const customSpreads = spreads.filter(spread => !officialSpreadNames.has(spread.name));
  const isCelticCross = layoutType === 'celtic' || currentSpread === '凯尔特十字牌阵';
  const saveButtonLabel = currentSpread && isEditingSession ? '保存修改' : '保存并使用';
  const editorStateLabel = currentSpread ? (isEditingSession ? '正在编辑' : '套用模板') : '空白创作';
  const canShowGridControls = Boolean(onUpdateGrid && onShiftSlots && onCenterSpread);
  const canDeleteCurrentSpread = Boolean(
    currentSpread
    && !isOfficialSpread
    && spreads.some(spread => spread.name === currentSpread),
  );

  const handleSlotClick = (col: number, row: number) => {
    onUpdateSlotPosition(col, row);
  };

  const handleTemplateChange = (spreadName: string) => {
    if (!spreadName) {
      onStartNewSession?.();
      onSetDesignActiveSlot(-1);
      return;
    }

    const selectedSpread = spreads.find(s => s.name === spreadName);
    if (selectedSpread) {
      onSelectSpread(selectedSpread);
    }
    onSetDesignActiveSlot(-1);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[520] bg-forest-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <motion.div 
        className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-forest-accent/10 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-forest-accent/10 text-forest-accent rounded-xl">
              <Layers size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-serif font-bold text-forest-ink">牌阵工作台</h2>
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-forest-muted">
                {editorStateLabel} · {editMode === 'free' ? '自由画布' : '网格模式'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveSpread}
              className="min-h-11 rounded-xl bg-forest-accent px-4 py-2 text-xs font-bold text-white shadow-lg shadow-forest-accent/20 transition-all hover:bg-forest-accent/90"
            >
              {saveButtonLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭工作台"
              className="min-h-11 min-w-11 p-2 hover:bg-forest-bg rounded-xl transition-colors"
            >
              <X size={20} className="text-forest-muted" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          <div className="grid gap-3 rounded-2xl border border-forest-accent/10 bg-forest-bg/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] sm:items-end">
            <div className="space-y-1">
              <label htmlFor="spread-template-select" className="text-[10px] font-bold uppercase tracking-wider text-forest-muted">
                模板
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                <select
                  id="spread-template-select"
                  value={currentSpread}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="min-h-11 w-full cursor-pointer appearance-none rounded-xl border border-forest-accent/10 bg-white py-3 pl-10 pr-4 text-sm text-forest-ink focus:ring-2 focus:ring-forest-accent/20"
                >
                  <option value="">空白创作，不套用模板</option>
                  <optgroup label="官方牌阵">
                    {OFFICIAL_SPREADS.map(spread => (
                      <option key={spread.name} value={spread.name}>{spread.name}</option>
                    ))}
                  </optgroup>
                  {customSpreads.length > 0 && (
                    <optgroup label={`自定义牌阵 (${customSpreads.length})`}>
                      {customSpreads.map(spread => (
                        <option key={spread.name} value={spread.name}>{spread.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="spread-name-input" className="text-[10px] font-bold uppercase tracking-wider text-forest-muted">
                名称
              </label>
              <input
                id="spread-name-input"
                type="text"
                value={newSpreadName}
                onChange={(e) => onUpdateNewSpreadName(e.target.value)}
                placeholder="牌阵名称..."
                className="min-h-11 w-full rounded-xl border border-forest-accent/10 bg-white px-4 py-3 text-sm text-forest-ink focus:ring-2 focus:ring-forest-accent/20"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                onUpdateNewSpreadName(DEFAULT_CUSTOM_SPREAD_NAME);
                onSetDesignActiveSlot(-1);
                onStartNewSession?.();
              }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest-accent/15 bg-white px-4 py-3 text-sm font-bold text-forest-accent transition-all hover:bg-forest-accent/5 sm:justify-start"
            >
              <Plus size={18} />
              新建空白
            </button>
          </div>

          <div className="rounded-2xl border border-forest-accent/10 bg-white p-3 shadow-sm shadow-forest-accent/5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center rounded-xl bg-forest-bg p-1">
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
                    className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      editMode === 'grid'
                        ? 'bg-white text-forest-accent shadow-sm'
                        : 'text-forest-muted hover:text-forest-accent'
                    }`}
                  >
                    <Grid3X3 size={14} />
                    <span>网格模式</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode('free');
                      onUpdateLayoutType('free');
                      onUpdateGrid?.(20, 12);
                    }}
                    className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                      editMode === 'free'
                        ? 'bg-white text-forest-accent shadow-sm'
                        : 'text-forest-muted hover:text-forest-accent'
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>自由画布</span>
                  </button>
                </div>

                <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-[10px] font-bold ${
                  editMode === 'free'
                    ? 'bg-forest-pink/10 text-forest-pink'
                    : 'bg-forest-accent/10 text-forest-accent'
                }`}>
                  {editMode === 'free' ? '自由摆放' : `${gridCols} 列 · ${gridRows} 行`}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-forest-muted transition-colors hover:bg-forest-bg hover:text-forest-accent"
                  >
                    <RotateCcw size={14} /> 撤销
                  </button>
                )}
                {isOfficialSpread && (
                  <button
                    type="button"
                    onClick={() => onRestoreDefaults(currentSpread)}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-forest-muted transition-colors hover:bg-amber-50 hover:text-amber-600"
                  >
                    <RefreshCw size={14} /> 恢复默认
                  </button>
                )}
                {canDeleteCurrentSpread && (
                  <button
                    type="button"
                    onClick={() => onDeleteSpread(currentSpread)}
                    aria-label={`删除牌阵 ${currentSpread}`}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                )}
              </div>
            </div>

            {editMode === 'grid' && canShowGridControls && (
              <div className="mt-3 border-t border-forest-accent/10 pt-3">
                <SpreadGridControls
                  gridCols={gridCols}
                  gridRows={gridRows}
                  onUpdateGrid={onUpdateGrid!}
                  onShiftSlots={onShiftSlots!}
                  onCenterSpread={onCenterSpread!}
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-forest-accent/10 bg-forest-bg/20 p-2 sm:p-3">
            <div ref={designerPreviewRef} className="flex w-full justify-center overflow-hidden pb-2">
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
                  className="mx-auto"
                  style={{
                    width: designerRawGridWidth * designerScale,
                    minHeight: gridRows * designerBaseSlotWidth * 1.75 * designerScale,
                  }}
                >
                <div
                  className={`grid ${designerGridGapClass} p-2 rounded-2xl border border-forest-accent/10 bg-white/70`}
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, max-content)`,
                    width: 'max-content',
                    transform: `scale(${designerScale})`,
                    transformOrigin: 'top center',
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
                              aria-label={`在第 ${row} 行第 ${col} 列创建位置`}
                              className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-forest-accent/10 transition-all hover:border-forest-accent/30 hover:bg-white/50"
                            >
                              <Plus size={14} className="text-forest-accent/30" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              )}
            </div>
          </div>

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
