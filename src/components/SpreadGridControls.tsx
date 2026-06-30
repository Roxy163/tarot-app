import React from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, ArrowRight, Maximize } from 'lucide-react';

interface SpreadGridControlsProps {
  gridCols: number;
  gridRows: number;
  onUpdateGrid: (cols: number, rows: number) => void;
  onShiftSlots: (dx: number, dy: number) => void;
  onCenterSpread: () => void;
}

export const SpreadGridControls: React.FC<SpreadGridControlsProps> = ({
  gridCols,
  gridRows,
  onUpdateGrid,
  onShiftSlots,
  onCenterSpread
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-forest-accent/10 bg-forest-accent/5 p-2">
      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-forest-muted">网格规模</span>
      <div className="flex items-center gap-1 rounded-xl bg-white px-1 py-0.5">
         <button type="button" onClick={() => onUpdateGrid(Math.max(1, gridCols - 1), gridRows)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-bold text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent">-</button>
         <span className="min-w-[4ch] text-center font-mono text-[11px] font-bold text-forest-accent">{gridCols}列</span>
         <button type="button" onClick={() => onUpdateGrid(Math.min(12, gridCols + 1), gridRows)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-bold text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent">+</button>
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-white px-1 py-0.5">
         <button type="button" onClick={() => onUpdateGrid(gridCols, Math.max(1, gridRows - 1))} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-bold text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent">-</button>
         <span className="min-w-[4ch] text-center font-mono text-[11px] font-bold text-forest-accent">{gridRows}行</span>
         <button type="button" onClick={() => onUpdateGrid(gridCols, Math.min(12, gridRows + 1))} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-bold text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent">+</button>
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-white px-1 py-0.5">
        <button type="button" onClick={() => onShiftSlots(-1, 0)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent" title="向左平移"><ArrowLeft size={14} /></button>
        <button type="button" onClick={() => onShiftSlots(0, -1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent" title="向上平移"><ArrowUp size={14} /></button>
        <button type="button" onClick={() => onShiftSlots(0, 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent" title="向下平移"><ArrowDown size={14} /></button>
        <button type="button" onClick={() => onShiftSlots(1, 0)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent" title="向右平移"><ArrowRight size={14} /></button>
        <div className="mx-0.5 h-5 w-px bg-forest-accent/10" />
        <button type="button" onClick={onCenterSpread} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-forest-accent transition-colors hover:bg-forest-accent/10" title="自动居中牌阵"><Maximize size={14} /></button>
      </div>
    </div>
  );
};
