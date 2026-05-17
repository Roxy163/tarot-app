import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface DesignerSlotProps {
  idx: number;
  isActive: boolean;
  slot: any;
  isCelticCenter: boolean;
  stackIndex: number;
  onSetActive: (idx: number) => void;
  onUpdateLabel: (idx: number, label: string) => void;
  onSwapSlotIndex: (oldIdx: number, newIdx: number) => void;
  onRemove: (idx: number) => void;
}

export const DesignerSlot: React.FC<DesignerSlotProps> = ({ 
  idx, isActive, slot, isCelticCenter, stackIndex,
  onSetActive, onUpdateLabel, onSwapSlotIndex, onRemove
}) => {
  const [localIdx, setLocalIdx] = React.useState((idx + 1).toString());

  React.useEffect(() => {
    setLocalIdx((idx + 1).toString());
  }, [idx]);

  const baseClasses = `rounded-md transition-all flex flex-col items-center justify-between p-1 shadow-sm select-none cursor-pointer`;
  const activeClasses = `bg-forest-accent text-white ring-2 ring-white shadow-xl z-30 scale-105`;
  const inactiveClasses = `bg-white text-forest-accent border border-forest-accent/20 hover:border-forest-accent/40`;
  
  const isSecondary = stackIndex > 0;
  const isRotated = slot.isRotated || (isCelticCenter && stackIndex === 1);
  const zIndex = isActive ? 50 : (stackIndex * 10 + 10);
  
  const positionClasses = isCelticCenter 
    ? (isRotated ? 'absolute inset-0 rotate-90 translate-y-1' : 'relative w-full h-full')
    : (isSecondary ? 'absolute inset-0 translate-x-1 translate-y-1' : 'relative w-full h-full');

  return (
    <motion.div 
      layout
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`${baseClasses} ${positionClasses} ${isActive ? activeClasses : inactiveClasses}`}
      style={{ zIndex }}
      onClick={(e) => {
        e.stopPropagation();
        onSetActive(idx);
      }}
    >
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="flex items-center gap-1">
          <input 
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={`w-6 text-center font-black bg-transparent border-none focus:ring-0 p-0 ${isCelticCenter ? 'text-[10px]' : 'text-[12px]'} ${isActive ? 'text-white' : 'text-forest-ink'}`}
            value={localIdx}
            onChange={(e) => {
              const val = e.target.value;
              setLocalIdx(val);
              const num = parseInt(val);
              if (!isNaN(num) && num > 0) {
                onSwapSlotIndex(idx, num - 1);
              }
            }}
            onBlur={() => {
              setLocalIdx((idx + 1).toString());
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
        {!isCelticCenter && !isSecondary && slot?.isStacked && (
          <div className={`text-[8px] font-black mt-0.5 ${isActive ? 'text-white/90' : 'text-forest-accent/80'}`}>叠放</div>
        )}
      </div>
      <input 
        className={`w-full px-0.5 py-0 font-bold text-center bg-transparent border-none focus:ring-0 transition-all ${
          isCelticCenter ? 'text-[8px]' : 'text-[9px]'
        } ${isActive ? 'text-white placeholder:text-white/50' : 'text-forest-ink/70 placeholder:text-forest-ink/30'}`}
        placeholder="位置"
        value={slot?.label || ''}
        onClick={e => e.stopPropagation()}
        onChange={e => onUpdateLabel(idx, e.target.value)}
      />
      {isActive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(idx);
          }}
          className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors z-50"
        >
          <X size={8} />
        </button>
      )}
    </motion.div>
  );
};
