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

  const baseClasses = `rounded-lg transition-all flex flex-col items-center justify-between p-2 shadow-sm select-none cursor-pointer`;
  const activeClasses = `bg-gradient-to-br from-forest-accent to-forest-pink text-white ring-2 ring-white shadow-xl z-30 scale-105`;
  const inactiveClasses = `bg-white text-forest-accent border-2 border-forest-accent/10 hover:border-forest-accent/40 hover:shadow-md`;
  
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
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex items-center justify-center w-full">
        <span className={`text-center font-black ${isCelticCenter ? 'text-[10px]' : 'text-lg'} ${isActive ? 'text-white' : 'text-forest-ink'}`}>
          {idx + 1}
        </span>
      </div>
      
      <input 
        className={`w-full px-1 py-1 font-bold text-center bg-transparent border-none focus:ring-0 transition-all rounded ${
          isCelticCenter ? 'text-[8px]' : 'text-xs'
        } ${isActive ? 'text-white placeholder:text-white/50 bg-white/10' : 'text-forest-ink/70 placeholder:text-forest-ink/30 bg-forest-accent/5'}`}
        placeholder="位置标签"
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
          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all z-50 hover:scale-110"
        >
          <X size={10} />
        </button>
      )}
    </motion.div>
  );
};
