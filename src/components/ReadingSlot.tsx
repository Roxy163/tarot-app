import React from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { ReadingSlotData } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { TarotCardImage } from './TarotCardImage';

interface ReadingSlotProps {
  slot: ReadingSlotData;
  index: number;
  isActive: boolean;
  isCelticCenter: boolean;
  stackIndex: number;
  isSmall?: boolean;
  showSlotNumbers: boolean;
  onSlotClick: (idx: number) => void;
  onLongPressStart: (idx: number) => void;
  onLongPressEnd: () => void;
  onRemove: (idx: number, e: React.MouseEvent) => void;
  allowRemove?: boolean;
  onCycle?: (idx: number, e: React.MouseEvent) => void;
}

export const ReadingSlot: React.FC<ReadingSlotProps> = ({
  slot, index, isActive, isCelticCenter, stackIndex, isSmall, showSlotNumbers,
  onSlotClick, onLongPressStart, onLongPressEnd, onRemove, allowRemove = true, onCycle
}) => {
  const cardData = TAROT_CARDS.find(c => 
    c.name === slot.name || 
    c.english === slot.name || 
    c.id === slot.name
  );
  
  // Enforce: 1st card (stackIndex 0) is vertical, 2nd card (stackIndex 1) is horizontal in center
  const isRotated = slot.isRotated || (isCelticCenter && stackIndex === 1);
  
  const baseClasses = `aspect-[2/3.5] bg-forest-bg rounded-xl border-2 border-dashed border-forest-accent/20 flex flex-col items-center justify-center p-1 transition-all hover:border-forest-accent/60 hover:bg-forest-accent/5 hover:scale-105 hover:shadow-lg select-none cursor-pointer`;
  const activeClasses = `border-forest-accent/40 bg-forest-accent/5 ring-4 ring-forest-accent/10 z-40`;
  const sizeClasses = isSmall ? 'w-16 sm:w-20' : 'w-20 sm:w-24';
  
  // Stacking order: stackIndex 0 is bottom, 1 is top
  const zIndex = isActive ? 50 : (stackIndex * 10 + 10);
  
  const positionClasses = isCelticCenter
    ? (isRotated ? 'absolute inset-0 flex items-center justify-center rotate-90' : 'relative w-full h-full')
    : (stackIndex > 0 ? 'absolute inset-0 translate-x-1 translate-y-1' : 'relative w-full h-full');

  return (
    <div className={`${positionClasses} group transition-all`} style={{ zIndex }}>
      <button 
        type="button" 
        onPointerDown={() => onLongPressStart(index)}
        onPointerUp={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        onClick={(e) => {
          e.stopPropagation();
          onSlotClick(index);
        }} 
        className={`${baseClasses} ${isActive ? activeClasses : ''} ${sizeClasses}`}
      >
        {slot.name ? (
          <div className={`w-full h-full relative rounded-lg overflow-hidden pointer-events-none ${slot.isReversed ? 'rotate-180' : ''}`}>
            {showSlotNumbers && (
              <span className="absolute top-1 left-1/2 -translate-x-1/2 bg-forest-text/40 text-white text-[8px] px-1 rounded-sm z-20 font-black">
                {index + 1}
              </span>
            )}
            <TarotCardImage src={getCardImageUrl(cardData?.id || 'ar00')} alt={slot.name} name={slot.name} className="w-full h-full object-contain bg-forest-bg" />
            <div className="absolute inset-x-0 bottom-0 bg-forest-text/60 text-white text-[7px] py-0.5 text-center font-sans">{slot.name}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 pointer-events-none">
            <div className="relative">
              {showSlotNumbers && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-text/40 text-white text-[8px] px-1 rounded-sm z-20 font-black whitespace-nowrap">
                  {index + 1}
                </span>
              )}
              <Plus className="text-forest-accent opacity-40" size={isCelticCenter ? 14 : 20} />
            </div>
            <span className={`text-forest-accent font-bold text-center px-1 leading-tight drop-shadow-sm ${isCelticCenter ? 'text-[8px]' : 'text-[10px]'}`}>
              {slot.label || `第${index + 1}张`}
            </span>
          </div>
        )}
      </button>
      {slot.name && (
        <div className="absolute -bottom-2 left-2 px-1.5 py-0.5 bg-white border border-forest-accent/10 rounded-full shadow-sm text-[8px] font-bold text-forest-accent z-10 pointer-events-none">
          {slot.isReversed ? '逆' : '正'}
        </div>
      )}
      {allowRemove && (
        <button
          type="button"
          onClick={(e) => onRemove(index, e)}
          className="absolute -top-3 -right-3 bg-white text-forest-muted hover:text-red-500 rounded-full w-11 h-11 shadow-sm border border-forest-accent/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
          aria-label={`移除第 ${index + 1} 个位置`}
        >
          <X size={14} />
        </button>
      )}
      {onCycle && (
        <button 
          type="button" 
          onClick={(e) => onCycle(index, e)} 
          className="absolute -top-3 -left-3 bg-white text-forest-accent hover:text-forest-accent/80 rounded-full w-11 h-11 shadow-sm border border-forest-accent/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
          title="切换层级"
          aria-label={`切换第 ${index + 1} 个位置层级`}
        >
          <Layers size={14} />
        </button>
      )}
    </div>
  );
};
