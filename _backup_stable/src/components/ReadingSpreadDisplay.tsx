import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { ReadingSlotData, SpreadDefinition } from '../types';
import { ReadingSlot } from './ReadingSlot';

interface ReadingSpreadDisplayProps {
  formData: any;
  cardSlots: ReadingSlotData[];
  activeSlotIndex: number;
  showSlotNumbers: boolean;
  gridCols: number;
  itemClasses: string[];
  currentTemplate: any;
  showUpdatePrompt: { name: string } | null;
  spreads: SpreadDefinition[];
  onSlotClick: (index: number) => void;
  handleLongPressStart: (index: number) => void;
  handleLongPressEnd: () => void;
  toggleReverse: (index: number) => void;
  removeSlot: (index: number) => void;
  handleCycleSlot: (index: number, e: React.MouseEvent) => void;
  onConfirmSync: (spreadName: string) => void;
  onCancelSync: () => void;
}

export const ReadingSpreadDisplay: React.FC<ReadingSpreadDisplayProps> = ({
  formData,
  cardSlots,
  activeSlotIndex,
  showSlotNumbers,
  gridCols,
  itemClasses,
  currentTemplate,
  showUpdatePrompt,
  spreads,
  onSlotClick,
  handleLongPressStart,
  handleLongPressEnd,
  toggleReverse,
  removeSlot,
  handleCycleSlot,
  onConfirmSync,
  onCancelSync
}) => {
  return (
    <div className="space-y-4">
      <AnimatePresence>
        {showUpdatePrompt && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-forest-accent/5 border border-forest-accent/20 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-forest-accent" />
              <span className="text-[11px] text-forest-ink font-medium">检测到牌阵“{showUpdatePrompt.name}”的定义已更新，是否按新序号调整当前已选牌的位置？</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button 
                type="button" 
                onClick={onCancelSync}
                className="px-3 py-1 text-[10px] text-forest-muted hover:text-forest-accent transition-colors"
              >
                保持现状
              </button>
              <button 
                type="button" 
                onClick={() => onConfirmSync(showUpdatePrompt.name)}
                className="px-3 py-1 text-[10px] bg-forest-accent text-white rounded hover:bg-forest-accent/90"
              >
                同步更新
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div 
        className={`${currentTemplate.class} ${cardSlots.length > 3 ? 'gap-2 sm:gap-4' : ''}`}
        style={formData.layoutType === 'custom' ? { 
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          display: 'grid'
        } : {}}
      >
        {(() => {
          const isCelticCross = formData.layoutType === 'celtic' || formData.spread === '凯尔特十字牌阵';
          const renderedPositions = new Set<string>();
          const isSmall = cardSlots.length > 3;
          
          return cardSlots.map((slot, index) => {
            const pos = slot.position || itemClasses[index] || '';
            if (renderedPositions.has(pos)) return null;
            renderedPositions.add(pos);

            const slotsAtPos = cardSlots.map((s, i) => ({ ...s, idx: i }))
              .filter(s => (s.position || itemClasses[s.idx] || '') === pos);
            
            const isCelticCenter = isCelticCross && pos === 'col-start-2 row-start-2';

            return (
              <div 
                key={pos} 
                className={`relative ${pos} flex items-center justify-center z-10 hover:z-50 transition-all`}
                style={{ zIndex: isCelticCross && pos === 'col-start-2 row-start-3' ? 30 : undefined }}
              >
                {slotsAtPos.map((s, sIdx) => (
                  <ReadingSlot 
                    key={s.idx}
                    slot={s}
                    index={s.idx}
                    isActive={activeSlotIndex === s.idx}
                    isCelticCenter={isCelticCenter && slotsAtPos.length > 1}
                    stackIndex={sIdx}
                    isSmall={isSmall}
                    showSlotNumbers={showSlotNumbers}
                    onSlotClick={onSlotClick}
                    onLongPressStart={handleLongPressStart}
                    onLongPressEnd={handleLongPressEnd}
                    onToggleReverse={toggleReverse}
                    onRemove={removeSlot}
                    onCycle={slotsAtPos.length > 1 ? handleCycleSlot : undefined}
                  />
                ))}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
};
