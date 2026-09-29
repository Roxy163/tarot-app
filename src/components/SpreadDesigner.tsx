import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Plus, RotateCcw, FolderOpen, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { SpreadDefinition, ReadingSlotData } from '../types';
import { OFFICIAL_SPREADS } from '../constants';
import { FreeLayoutEditor } from './FreeLayoutEditor';
import { PageView } from './PageView';
import { ConfirmDialog } from './ConfirmDialog';

export type FreeLayoutSaveMode = 'original' | 'adaptive';

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
  onSelectSpread: (spread: SpreadDefinition, options?: { useAsTemplate?: boolean }) => void;
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
  onRestoreDefaults: (name: string) => void;
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
  onSwapSlotIndex,
  onSetDesignActiveSlot,
  onRestoreDefaults,
  onStartNewSession,
  onClose,
  canUndo,
  onUndo,
  onUpdateSlots,
  freeLayoutSaveMode = 'original',
  onUpdateFreeLayoutSaveMode
}) => {

  const [selectedCustomSpreadNames, setSelectedCustomSpreadNames] = useState<string[]>([]);
  const [isMobileWorkbench, setIsMobileWorkbench] = useState(isMobileViewport);
  const [showCustomManager, setShowCustomManager] = useState(() => !isMobileViewport());
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const workspaceSnapshot = JSON.stringify({ currentSpread, cardSlots, newSpreadName, freeLayoutSaveMode });
  const initialWorkspace = useRef(workspaceSnapshot);
  const requestBack = () => {
    if (workspaceSnapshot !== initialWorkspace.current) setShowLeaveConfirm(true);
    else onClose?.();
  };

  useEffect(() => {
    const updateResponsiveState = () => {
      const nextIsMobile = isMobileViewport();
      setIsMobileWorkbench(nextIsMobile);

      if (!nextIsMobile) {
        setShowCustomManager(true);
      }
    };

    updateResponsiveState();
    window.addEventListener('resize', updateResponsiveState);
    return () => window.removeEventListener('resize', updateResponsiveState);
  }, []);

  const isOfficialSpread = OFFICIAL_SPREADS.some(s => s.name === currentSpread);
  const officialSpreadNames = useMemo(() => new Set(OFFICIAL_SPREADS.map(spread => spread.name)), []);
  const officialSpreads = useMemo(() => {
    const savedByName = new Map(spreads.map(spread => [spread.name, spread]));

    return OFFICIAL_SPREADS
      .map(spread => (savedByName.get(spread.name) || spread) as SpreadDefinition);
  }, [spreads]);
  const customSpreads = useMemo(
    () => spreads.filter(spread => !officialSpreadNames.has(spread.name)),
    [officialSpreadNames, spreads],
  );
  const saveButtonLabel = currentSpread && isEditingSession ? '保存修改' : '保存并使用';
  const editorStateLabel = currentSpread ? (isEditingSession ? '正在编辑' : '套用模板') : '空白创作';
  const areAllCustomSpreadsSelected = customSpreads.length > 0 && selectedCustomSpreadNames.length === customSpreads.length;
  const canDeleteSelectedCustomSpreads = Boolean(onDeleteSpreads && selectedCustomSpreadNames.length > 0);
  const canDeleteCurrentSpread = Boolean(
    currentSpread
    && isEditingSession
    && !isOfficialSpread
    && spreads.some(spread => spread.name === currentSpread),
  );

  useEffect(() => {
    setSelectedCustomSpreadNames(current => (
      current.filter(name => spreads.some(spread => spread.name === name && !officialSpreadNames.has(name)))
    ));
  }, [spreads, officialSpreadNames]);

  const toggleCustomSpreadSelection = (spreadName: string) => {
    setSelectedCustomSpreadNames(current => (
      current.includes(spreadName)
        ? current.filter(name => name !== spreadName)
        : [...current, spreadName]
    ));
  };

  const toggleAllCustomSpreadSelection = () => {
    setSelectedCustomSpreadNames(areAllCustomSpreadsSelected ? [] : customSpreads.map(spread => spread.name));
  };

  const handleTemplateChange = (spreadName: string) => {
    if (!spreadName) {
      onStartNewSession?.();
      onUpdateNewSpreadName('');
      onSetDesignActiveSlot(-1);
      return;
    }

    const selectedSpread = spreads.find(s => s.name === spreadName);
    if (selectedSpread) {
      onSelectSpread(selectedSpread, { useAsTemplate: !currentSpread });
      if (!newSpreadName.trim()) {
        onUpdateNewSpreadName(`${selectedSpread.name} 改造`);
      }
    }
    onSetDesignActiveSlot(-1);
  };

  return (
    <PageView isOpen onBack={requestBack} title="牌阵工作台" width="wide">
        <div className="sticky top-0 z-10 flex flex-col gap-1.5 border-b border-forest-accent/7 bg-white/72 px-2.5 py-1.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-forest-accent/7 p-1.5 text-forest-accent ring-1 ring-forest-accent/7">
              <Layers size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-serif text-base font-bold text-forest-ink sm:text-lg">布置你的牌阵</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-forest-muted">
                {editorStateLabel} · 自由画布
              </p>
            </div>
          </div>
          <div className="w-full space-y-1 sm:w-[min(360px,48%)]">
            <label htmlFor="spread-name-input" className="sr-only">
              牌阵名称
            </label>
            <div className="flex gap-1.5 sm:gap-2">
              <input
                id="spread-name-input"
                type="text"
                aria-label="名称"
                value={newSpreadName}
                onChange={(e) => onUpdateNewSpreadName(e.target.value)}
                placeholder="先给牌阵命名..."
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-forest-accent/8 bg-white/45 px-2.5 py-1.5 text-sm text-forest-ink outline-none focus:ring-2 focus:ring-forest-accent/15 sm:min-h-10"
              />
              <button
                type="button"
                onClick={onSaveSpread}
                className="min-h-11 rounded-lg bg-forest-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-forest-accent sm:min-h-10 sm:px-4"
              >
                {saveButtonLabel}
              </button>
            </div>
            {saveNotice && (
              <p className="text-[10px] font-semibold text-forest-pink">
                {saveNotice}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5 p-1.5 sm:space-y-3 sm:p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-forest-accent/7 bg-white/22 p-1.5">
            <div>
              <label htmlFor="spread-template-select" className="sr-only">
                基于已有改造
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-muted" size={15} />
                <select
                  id="spread-template-select"
                  value={currentSpread}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  aria-label="基于已有改造"
                  className="min-h-11 w-full cursor-pointer appearance-none rounded-lg border border-forest-accent/8 bg-white/52 py-1.5 pl-8 pr-2.5 text-sm text-forest-ink focus:ring-2 focus:ring-forest-accent/15 sm:min-h-10"
                >
                  <option value="">空白创作，不套用模板</option>
                  {officialSpreads.length > 0 && (
                  <optgroup label="官方牌阵">
                    {officialSpreads.map(spread => (
                      <option key={spread.name} value={spread.name}>{spread.name}</option>
                    ))}
                  </optgroup>
                  )}
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
              }}
              className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-forest-accent/8 bg-white/40 px-2.5 py-1.5 text-xs font-semibold text-forest-accent transition-all hover:bg-white/64 sm:min-h-10 sm:justify-start"
            >
              <Plus size={15} />
              <span className="sm:hidden">空白</span>
              <span className="hidden sm:inline">新建空白</span>
            </button>
          </div>

          {currentSpread && customSpreads.length > 0 && (
            isMobileWorkbench && !showCustomManager ? (
              <button
                type="button"
                onClick={() => setShowCustomManager(true)}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-forest-accent/8 bg-white/38 px-2.5 py-1.5 text-left text-xs font-semibold text-forest-accent"
              >
                <span>管理自建牌阵</span>
                <span className="rounded-full bg-forest-accent/10 px-2 py-1 text-[10px]">{customSpreads.length} 个</span>
              </button>
            ) : (
            <div className="rounded-xl border border-forest-accent/8 bg-white/30 p-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-forest-accent">自建牌阵管理</p>
                  <p className="text-[10px] text-forest-muted">勾选可批量删除，右侧按钮可删除单项。</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isMobileWorkbench && (
                    <button
                      type="button"
                      onClick={() => setShowCustomManager(false)}
                      className="min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-forest-muted transition-colors hover:bg-white/58 sm:min-h-10"
                    >
                      收起
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleAllCustomSpreadSelection}
                    className="min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-forest-muted transition-colors hover:bg-white/58 hover:text-forest-accent sm:min-h-10"
                  >
                    {areAllCustomSpreadsSelected ? '取消全选' : '全选'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSpreads?.(selectedCustomSpreadNames)}
                    disabled={!canDeleteSelectedCustomSpreads}
                    className={`min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:min-h-10 ${
                      !canDeleteSelectedCustomSpreads
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
                    <div
                      key={spread.name}
                      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? 'border-red-200 bg-red-50 text-red-600'
                          : 'border-forest-accent/10 bg-forest-bg/60 text-forest-ink hover:border-forest-accent/30'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCustomSpreadSelection(spread.name)}
                        className="flex min-h-11 min-w-0 items-center gap-2 rounded-md text-left sm:min-h-10"
                        aria-pressed={isSelected}
                        title="勾选用于批量删除"
                      >
                        <span className={`h-3 w-3 shrink-0 rounded-full border ${isSelected ? 'border-red-500 bg-red-500' : 'border-forest-accent/30 bg-white'}`} />
                        <span className="max-w-[9rem] truncate">{spread.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSpread(spread.name)}
                        aria-label={`删除自定义牌阵 ${spread.name}`}
                        title="删除自定义牌阵"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-100 sm:min-h-10 sm:min-w-10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            )
          )}

          {(canUndo || isOfficialSpread || canDeleteCurrentSpread) && (
          <div className="rounded-xl border border-forest-accent/8 bg-white/22 p-1 sm:p-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex min-h-9 items-center gap-1.5 px-1 text-[10px] font-semibold text-forest-muted">
                <Sparkles size={13} />
                <span>自由画布</span>
              </div>

              <div className="flex flex-wrap gap-1.5 justify-end">
                {canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-forest-muted transition-colors hover:bg-white/58 hover:text-forest-accent sm:min-h-10"
                  >
                    <RotateCcw size={14} /> 撤销
                  </button>
                )}
                {isOfficialSpread && (
                  <button
                    type="button"
                    onClick={() => onRestoreDefaults(currentSpread)}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-forest-muted transition-colors hover:bg-amber-50/70 hover:text-amber-600 sm:min-h-10"
                  >
                    <RefreshCw size={14} /> 恢复当前
                  </button>
                )}
                {canDeleteCurrentSpread && (
                  <button
                    type="button"
                    onClick={() => onDeleteSpread(currentSpread)}
                    aria-label={`删除牌阵 ${currentSpread}`}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50/80 sm:min-h-10"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                )}
              </div>
            </div>

          </div>
          )}

            <div className="rounded-xl border border-forest-accent/8 bg-white/18 p-1 sm:p-1.5">
              <div className="flex w-full justify-center overflow-hidden pb-2">
                <FreeLayoutEditor
                  cardSlots={cardSlots}
                  designActiveSlot={designActiveSlot}
                  onSetDesignActiveSlot={(idx) => onSetDesignActiveSlot(idx, true)}
                  onSwapSlotIndex={onSwapSlotIndex}
                  onUpdateSlots={(slots) => {
                    onUpdateSlots?.(slots);
                  }}
                />
              </div>
            </div>

          {onUpdateFreeLayoutSaveMode && (
            <div className="rounded-xl border border-forest-accent/10 bg-forest-accent/5 p-1.5">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-bold text-forest-accent">保存自由牌阵时</p>
                <div className="grid grid-cols-2 gap-1.5 sm:w-80">
                <button
                  type="button"
                  onClick={() => onUpdateFreeLayoutSaveMode('original')}
                  className={`min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:min-h-10 ${
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
                  className={`min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:min-h-10 ${
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

          <div className="border-t border-forest-accent/10 px-3 py-2 text-xs text-forest-muted sm:py-3">
            <span>位置数量：{cardSlots.length}</span>
          </div>
        </div>
      <ConfirmDialog isOpen={showLeaveConfirm} title="离开牌阵工作台" message="尚未保存的牌阵修改会撤回，原手记和摆牌会保留。" confirmText="放弃修改并返回" cancelText="继续编辑" onConfirm={() => onClose?.()} onClose={() => setShowLeaveConfirm(false)} />
    </PageView>
  );
};
