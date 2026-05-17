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
    <div className="flex items-center gap-2 px-2 py-0.5 bg-forest-accent/5 rounded-full border border-forest-accent/10">
      <span className="text-[9px] font-bold text-forest-muted uppercase">网格规模:</span>
      <div className="flex items-center gap-1 border-r border-forest-accent/10 pr-2">
         <button type="button" onClick={() => onUpdateGrid(Math.max(1, gridCols - 1), gridRows)} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors">-</button>
         <span className="text-[10px] font-mono min-w-[3ch] text-center font-bold text-forest-accent">{gridCols}列</span>
         <button type="button" onClick={() => onUpdateGrid(Math.min(12, gridCols + 1), gridRows)} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors">+</button>
      </div>
      <div className="flex items-center gap-1 border-r border-forest-accent/10 pr-2">
         <button type="button" onClick={() => onUpdateGrid(gridCols, Math.max(1, gridRows - 1))} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors">-</button>
         <span className="text-[10px] font-mono min-w-[3ch] text-center font-bold text-forest-accent">{gridRows}行</span>
         <button type="button" onClick={() => onUpdateGrid(gridCols, Math.min(12, gridRows + 1))} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors">+</button>
      </div>
      <div className="flex items-center gap-0.5 ml-1">
        <button type="button" onClick={() => onShiftSlots(-1, 0)} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors" title="向左平移"><ArrowLeft size={10} /></button>
        <button type="button" onClick={() => onShiftSlots(0, -1)} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors" title="向上平移"><ArrowUp size={10} /></button>
        <button type="button" onClick={() => onShiftSlots(0, 1)} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors" title="向下平移"><ArrowDown size={10} /></button>
        <button type="button" onClick={() => onShiftSlots(1, 0)} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors" title="向右平移"><ArrowRight size={10} /></button>
        <div className="w-px h-3 bg-forest-accent/10 mx-0.5" />
        <button type="button" onClick={onCenterSpread} className="w-5 h-5 flex items-center justify-center hover:bg-forest-accent/10 rounded-md transition-colors text-forest-accent" title="自动居中牌阵"><Maximize size={10} /></button>
      </div>
    </div>
  );
};
