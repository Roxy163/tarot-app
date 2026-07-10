import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Layers, X, Plus, RotateCcw, Grid3X3, FolderOpen, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { SpreadDefinition, ReadingSlotData } from '../types';
import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS } from '../constants';
import { DesignerSlot } from './DesignerSlot';
import { SpreadGridControls } from './SpreadGridControls';
import { FreeLayoutEditor } from './FreeLayoutEditor';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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

const isMobileViewport = () => (
  typeof window !== 'undefined' && window.innerWidth < 640
);

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
  onDeleteSpreads?: (names: string[]) => void;
  onSaveSpread: () => void;
  onUpdateNewSpreadName: (name: string) => void;
  saveNotice?: string;
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
  onDeleteSpreads,
  onSaveSpread,
  onUpdateNewSpreadName,
  saveNotice,
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
  useBodyScrollLock(true);

  const [editMode, setEditMode] = useState<'grid' | 'free'>(layoutType === 'free' ? 'free' : 'grid');
  const [selectedCustomSpreadNames, setSelectedCustomSpreadNames] = useState<string[]>([]);
  const [isMobileWorkbench, setIsMobileWorkbench] = useState(isMobileViewport);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(() => !isMobileViewport());
  const [showCustomManager, setShowCustomManager] = useState(() => !isMobileViewport());
  const { ref: designerPreviewRef, width: designerPreviewWidth } = useContainerWidth<HTMLDivElement>();
  const longPressDeleteTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    setEditMode(layoutType === 'free' ? 'free' : 'grid');
  }, [layoutType]);

  useEffect(() => {
    const updateResponsiveState = () => {
      const nextIsMobile = isMobileViewport();
      setIsMobileWorkbench(nextIsMobile);

      if (!nextIsMobile) {
        setIsWorkspaceOpen(true);
        setShowCustomManager(true);
      }
    };

    updateResponsiveState();
    window.addEventListener('resize', updateResponsiveState);
    return () => window.removeEventListener('resize', updateResponsiveState);
  }, []);

  useEffect(() => () => {
    if (longPressDeleteTimerRef.current) {
      window.clearTimeout(longPressDeleteTimerRef.current);
    }
  }, []);

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
  const officialSpreadNames = useMemo(() => new Set(OFFICIAL_SPREADS.map(spread => spread.name)), []);
  const customSpreads = useMemo(
    () => spreads.filter(spread => !officialSpreadNames.has(spread.name)),
    [officialSpreadNames, spreads],
  );
  const isCelticCross = layoutType === 'celtic' || currentSpread === '凯尔特十字牌阵';
  const saveButtonLabel = currentSpread && isEditingSession ? '保存修改' : '保存并使用';
  const editorStateLabel = currentSpread ? (isEditingSession ? '正在编辑' : '套用模板') : '空白创作';
  const canShowGridControls = Boolean(onUpdateGrid && onShiftSlots && onCenterSpread);
  const canDeleteCurrentSpread = Boolean(
    currentSpread
    && !isOfficialSpread
    && spreads.some(spread => spread.name === currentSpread),
  );

  useEffect(() => {
    setSelectedCustomSpreadNames(current => (
      current.filter(name => spreads.some(spread => spread.name === name && !officialSpreadNames.has(name)))
    ));
  }, [spreads, officialSpreadNames]);

  const clearLongPressDelete = () => {
    if (!longPressDeleteTimerRef.current) return;

    window.clearTimeout(longPressDeleteTimerRef.current);
    longPressDeleteTimerRef.current = null;
  };

  const startLongPressDelete = (spreadName: string) => {
    clearLongPressDelete();
    longPressTriggeredRef.current = false;
    longPressDeleteTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onDeleteSpread(spreadName);
      longPressDeleteTimerRef.current = null;
      if (window.navigator.vibrate) {
        window.navigator.vibrate(35);
      }
    }, 650);
  };

  const toggleCustomSpreadSelection = (spreadName: string) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    setSelectedCustomSpreadNames(current => (
      current.includes(spreadName)
        ? current.filter(name => name !== spreadName)
        : [...current, spreadName]
    ));
  };

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
    if (isMobileWorkbench) {
      setIsWorkspaceOpen(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[520] flex items-start justify-center bg-forest-ink/40 p-2 backdrop-blur-sm overscroll-contain sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <motion.div 
        className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-[1.5rem] bg-white shadow-2xl sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-forest-accent/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-forest-accent/10 p-2 text-forest-accent">
              <Layers size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-serif font-bold text-forest-ink sm:text-lg">牌阵工作台</h2>
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-forest-muted">
                {editorStateLabel} · {editMode === 'free' ? '自由画布' : '网格模式'}
              </p>
            </div>
          </div>
          <div className="w-full space-y-1 sm:w-[min(360px,48%)]">
            <label htmlFor="spread-name-input" className="text-[9px] font-bold uppercase tracking-wider text-forest-muted">
              牌阵名称
            </label>
            <div className="flex gap-2">
              <input
                id="spread-name-input"
                type="text"
                aria-label="名称"
                value={newSpreadName}
                onChange={(e) => onUpdateNewSpreadName(e.target.value)}
                placeholder="先给牌阵命名..."
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-forest-accent/10 bg-forest-bg/60 px-3 py-2 text-sm text-forest-ink focus:ring-2 focus:ring-forest-accent/20 sm:min-h-10"
              />
              <button
                type="button"
                onClick={onSaveSpread}
                className="min-h-11 rounded-xl bg-forest-accent px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-forest-accent/20 transition-all hover:bg-forest-accent/90 sm:min-h-10 sm:px-4"
              >
                {saveButtonLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭工作台"
                className="min-h-11 min-w-11 rounded-xl p-2 transition-colors hover:bg-forest-bg sm:min-h-10 sm:min-w-10"
              >
                <X size={20} className="text-forest-muted" />
              </button>
            </div>
            <p className={`text-[10px] ${saveNotice ? 'font-bold text-forest-pink' : 'text-forest-muted'}`}>
              {saveNotice || '保存前先命名，保存后也能回来编辑改名。'}
            </p>
          </div>
        </div>

        <div className="space-y-2.5 p-2.5 sm:space-y-4 sm:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-2xl border border-forest-accent/10 bg-forest-bg/40 p-2">
            <div className="space-y-0.5">
              <label htmlFor="spread-template-select" className="text-[9px] font-bold uppercase tracking-wider text-forest-muted">
                模板
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                <select
                  id="spread-template-select"
                  value={currentSpread}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="min-h-11 sm:min-h-10 w-full cursor-pointer appearance-none rounded-xl border border-forest-accent/10 bg-white py-2 pl-10 pr-3 text-sm text-forest-ink focus:ring-2 focus:ring-forest-accent/20"
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

            <button
              type="button"
              aria-label="新建空白"
              onClick={() => {
                onUpdateNewSpreadName('');
                onSetDesignActiveSlot(-1);
                onStartNewSession?.();
                if (isMobileWorkbench) {
                  setIsWorkspaceOpen(false);
                }
              }}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-forest-accent/15 bg-white px-3 py-2 text-xs font-bold text-forest-accent transition-all hover:bg-forest-accent/5 sm:min-h-10 sm:justify-start sm:text-sm"
            >
              <Plus size={16} />
              <span className="sm:hidden">空白</span>
              <span className="hidden sm:inline">新建空白</span>
            </button>
          </div>

          {customSpreads.length > 0 && (
            isMobileWorkbench && !showCustomManager ? (
              <button
                type="button"
                onClick={() => setShowCustomManager(true)}
                className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-forest-accent/10 bg-white px-3 py-2 text-left text-xs font-bold text-forest-accent shadow-sm shadow-forest-accent/5"
              >
                <span>管理自建牌阵</span>
                <span className="rounded-full bg-forest-accent/10 px-2 py-1 text-[10px]">{customSpreads.length} 个</span>
              </button>
            ) : (
            <div className="rounded-2xl border border-forest-accent/10 bg-white p-2.5 shadow-sm shadow-forest-accent/5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-forest-accent">自建牌阵管理</p>
                  <p className="text-[10px] text-forest-muted">点选可批量删除，长按单项也可删除。</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isMobileWorkbench && (
                    <button
                      type="button"
                      onClick={() => setShowCustomManager(false)}
                      className="min-h-11 rounded-xl px-3 py-2 text-xs font-bold text-forest-muted transition-colors hover:bg-forest-bg sm:min-h-10"
                    >
                      收起
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteSpreads?.(selectedCustomSpreadNames)}
                    disabled={selectedCustomSpreadNames.length === 0}
                    className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:min-h-10 ${
                      selectedCustomSpreadNames.length === 0
                        ? 'cursor-not-allowed bg-gray-100 text-gray-300'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    删除选中 {selectedCustomSpreadNames.length > 0 ? selectedCustomSpreadNames.length : ''}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto custom-scrollbar-hide pb-1">
                {customSpreads.map(spread => {
                  const isSelected = selectedCustomSpreadNames.includes(spread.name);

                  return (
                    <button
                      key={spread.name}
                      type="button"
                      onClick={() => toggleCustomSpreadSelection(spread.name)}
                      onPointerDown={() => startLongPressDelete(spread.name)}
                      onPointerUp={clearLongPressDelete}
                      onPointerLeave={clearLongPressDelete}
                      onPointerCancel={clearLongPressDelete}
                      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                        isSelected
                          ? 'border-red-200 bg-red-50 text-red-600'
                          : 'border-forest-accent/10 bg-forest-bg/60 text-forest-ink hover:border-forest-accent/30'
                      }`}
                      aria-pressed={isSelected}
                      title="点选用于批量删除，长按可删除"
                    >
                      <span className={`h-3 w-3 rounded-full border ${isSelected ? 'border-red-500 bg-red-500' : 'border-forest-accent/30 bg-white'}`} />
                      <span>{spread.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            )
          )}

          <div className="rounded-2xl border border-forest-accent/10 bg-white p-2 shadow-sm shadow-forest-accent/5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl bg-forest-bg p-0.5">
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
                    className={`flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      editMode === 'grid'
                        ? 'bg-white text-forest-accent shadow-sm'
                        : 'text-forest-muted hover:text-forest-accent'
                    }`}
                  >
                    <Grid3X3 size={13} />
                    <span>网格模式</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode('free');
                      onUpdateLayoutType('free');
                      onUpdateGrid?.(20, 12);
                    }}
                    className={`flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      editMode === 'free'
                        ? 'bg-white text-forest-accent shadow-sm'
                        : 'text-forest-muted hover:text-forest-accent'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>自由画布</span>
                  </button>
                </div>

                <span className={`inline-flex min-h-8 items-center rounded-full px-2.5 text-[10px] font-bold ${
                  editMode === 'free'
                    ? 'bg-forest-pink/10 text-forest-pink'
                    : 'bg-forest-accent/10 text-forest-accent'
                }`}>
                  {editMode === 'free' ? '自由摆放' : `${gridCols} 列 · ${gridRows} 行`}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-forest-muted transition-colors hover:bg-forest-bg hover:text-forest-accent"
                  >
                    <RotateCcw size={14} /> 撤销
                  </button>
                )}
                {isOfficialSpread && (
                  <button
                    type="button"
                    onClick={() => onRestoreDefaults(currentSpread)}
                    className="flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-forest-muted transition-colors hover:bg-amber-50 hover:text-amber-600"
                  >
                    <RefreshCw size={14} /> 恢复默认
                  </button>
                )}
                {canDeleteCurrentSpread && (
                  <button
                    type="button"
                    onClick={() => onDeleteSpread(currentSpread)}
                    aria-label={`删除牌阵 ${currentSpread}`}
                    className="flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                )}
              </div>
            </div>

            {editMode === 'grid' && canShowGridControls && (
              <div className="mt-2 border-t border-forest-accent/10 pt-2">
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

          {isMobileWorkbench && !isWorkspaceOpen ? (
            <div
              className="rounded-2xl border border-forest-accent/10 bg-forest-bg/40 p-3 shadow-sm shadow-forest-accent/5"
              data-testid="spread-workbench-mobile-setup"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-2 text-forest-accent shadow-sm">
                  {editMode === 'free' ? <Sparkles size={18} /> : <Grid3X3 size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm font-bold text-forest-ink">
                    {editMode === 'free' ? '自由摆放' : '网格编辑'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                    {newSpreadName.trim() || currentSpread || '未命名牌阵'} · {cardSlots.length} 个位置
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkspaceOpen(true)}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest-accent px-4 py-2 text-sm font-bold text-white shadow-lg shadow-forest-accent/15 transition-all active:scale-[0.98]"
              >
                {editMode === 'free' ? '开始摆放' : '开始编辑'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-forest-accent/10 bg-forest-bg/20 p-2">
              <div ref={designerPreviewRef} className="flex w-full justify-center overflow-hidden pb-2">
                {editMode === 'free' ? (
                  <FreeLayoutEditor
                    cardSlots={cardSlots}
                    designActiveSlot={designActiveSlot}
                    onSetDesignActiveSlot={(idx) => onSetDesignActiveSlot(idx, true)}
                    onRemoveSlot={onRemoveSlot}
                    onSwapSlotIndex={onSwapSlotIndex}
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
                                  totalSlots={cardSlots.length}
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
          )}

          {editMode === 'free' && onUpdateFreeLayoutSaveMode && (!isMobileWorkbench || isWorkspaceOpen) && (
            <div className="rounded-2xl border border-forest-accent/10 bg-forest-accent/5 p-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-bold text-forest-accent">保存自由牌阵时</p>
                <div className="grid grid-cols-2 gap-1.5 sm:w-80">
                <button
                  type="button"
                  onClick={() => onUpdateFreeLayoutSaveMode('original')}
                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:min-h-10 ${
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
                  className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:min-h-10 ${
                    freeLayoutSaveMode === 'adaptive'
                      ? 'bg-white text-forest-accent shadow-sm ring-1 ring-forest-accent/10'
                      : 'text-forest-muted hover:bg-white/60'
                  }`}
                >
                  自适应居中
                </button>
                </div>
              </div>
            </div>
          )}

          <div className="-mx-2.5 -mb-2.5 rounded-b-[1.5rem] border-t border-forest-accent/10 bg-white/95 px-4 py-2.5 text-xs text-forest-muted backdrop-blur sm:-mx-4 sm:-mb-4 sm:rounded-b-[2rem] sm:px-6 sm:py-3">
            <span>位置数量：{cardSlots.length}</span>
            {isCelticCross && <span className="ml-2 text-forest-accent">· 凯尔特十字模式</span>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
