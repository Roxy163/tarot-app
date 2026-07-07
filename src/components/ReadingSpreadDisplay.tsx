import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { ReadingSlotData, SpreadDefinition } from '../types';
import { ReadingSlot } from './ReadingSlot';
import {
  FREE_LAYOUT_CANVAS_HEIGHT,
  FREE_LAYOUT_CANVAS_WIDTH,
  getFreeLayoutDisplayFrame,
  FREE_LAYOUT_SLOT_HEIGHT,
  FREE_LAYOUT_SLOT_WIDTH,
} from '../lib/freeLayout';

const getGridNumber = (position: string, type: 'col' | 'row') => {
  const pattern = type === 'col' ? /col-start-(\d+)/ : /row-start-(\d+)/;
  const match = position.match(pattern);
  return match ? Number(match[1]) : 1;
};

const useElementWidth = <T extends HTMLElement>() => {
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
  toggleReverse: (index: number, e: React.MouseEvent) => void;
  removeSlot: (index: number, e: React.MouseEvent) => void;
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
  const { ref: spreadViewportRef, width: spreadViewportWidth } = useElementWidth<HTMLDivElement>();
  const isFreeLayout = formData.layoutType === 'free';
  const freeLayoutFrame = isFreeLayout ? getFreeLayoutDisplayFrame(cardSlots) : null;
  const isCustomGridLayout = formData.layoutType === 'custom';
  const customGridGapClass = cardSlots.length > 3 ? 'gap-2 sm:gap-4' : 'gap-3 sm:gap-4';
  const isCelticCross = formData.layoutType === 'celtic' || formData.spread === '凯尔特十字牌阵';
  const isComplexGridLayout = isCustomGridLayout || isCelticCross || formData.layoutType === 'yearly';
  const templateGapOverride = !isCelticCross && formData.layoutType !== 'yearly' && cardSlots.length > 3
    ? 'gap-2 sm:gap-4'
    : '';
  const displayPositions = useMemo(() => (
    cardSlots.map((slot, index) => slot.position || itemClasses[index] || '')
  ), [cardSlots, itemClasses]);
  const gridExtent = useMemo(() => {
    if (displayPositions.length === 0) {
      return { cols: gridCols, rows: 1 };
    }

    return displayPositions.reduce((result, position) => ({
      cols: Math.max(result.cols, getGridNumber(position, 'col')),
      rows: Math.max(result.rows, getGridNumber(position, 'row')),
    }), { cols: Math.max(gridCols, 1), rows: 1 });
  }, [displayPositions, gridCols]);
  const isSmallCard = cardSlots.length > 3;
  const baseSlotWidth = isSmallCard ? 64 : 80;
  const baseSlotHeight = isSmallCard ? 112 : 140;
  const gapSize = isCelticCross ? 32 : formData.layoutType === 'yearly' ? 0 : isSmallCard ? 8 : 12;
  const rawGridWidth = isFreeLayout
    ? freeLayoutFrame?.width || FREE_LAYOUT_CANVAS_WIDTH
    : gridExtent.cols * baseSlotWidth + Math.max(0, gridExtent.cols - 1) * gapSize;
  const rawGridHeight = isFreeLayout
    ? freeLayoutFrame?.height || FREE_LAYOUT_CANVAS_HEIGHT
    : gridExtent.rows * baseSlotHeight + Math.max(0, gridExtent.rows - 1) * gapSize;
  const availableDisplayWidth = Math.max(280, spreadViewportWidth || rawGridWidth);
  const mobileDisplayScale = spreadViewportWidth > 0
    ? Math.min(1, availableDisplayWidth / Math.max(1, rawGridWidth + 16))
    : 1;
  const shouldScaleGrid = isComplexGridLayout && mobileDisplayScale < 0.98;
  const scaledGridStyle = shouldScaleGrid ? {
    width: rawGridWidth * mobileDisplayScale,
    minHeight: rawGridHeight * mobileDisplayScale,
  } : undefined;
  const gridInnerStyle = shouldScaleGrid ? {
    transform: `scale(${mobileDisplayScale})`,
    transformOrigin: 'top center',
  } : undefined;

  return (
    <div ref={spreadViewportRef} className="space-y-4">
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

      {isFreeLayout ? (
        <div className="w-full overflow-hidden pb-2">
          <div
            className="relative mx-auto rounded-2xl border border-forest-accent/10 bg-forest-bg/30"
            style={{
              width: (freeLayoutFrame?.width || FREE_LAYOUT_CANVAS_WIDTH) * mobileDisplayScale,
              height: (freeLayoutFrame?.height || FREE_LAYOUT_CANVAS_HEIGHT) * mobileDisplayScale,
            }}
          >
            <div
              className="absolute left-0 top-0"
              style={{
                width: freeLayoutFrame?.width || FREE_LAYOUT_CANVAS_WIDTH,
                height: freeLayoutFrame?.height || FREE_LAYOUT_CANVAS_HEIGHT,
                transform: `scale(${mobileDisplayScale})`,
                transformOrigin: 'top left',
              }}
            >
              {cardSlots.map((slot, index) => {
                const scale = slot.scale || 1;
                return (
                  <div
                    key={`${slot.label || index}-${index}`}
                    className="absolute"
                    style={{
                      left: (slot.x || 0) + (freeLayoutFrame?.offsetX || 0),
                      top: (slot.y || 0) + (freeLayoutFrame?.offsetY || 0),
                      width: FREE_LAYOUT_SLOT_WIDTH,
                      minHeight: FREE_LAYOUT_SLOT_HEIGHT,
                      transform: `rotate(${slot.rotation || 0}deg) scale(${scale})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <ReadingSlot
                      slot={slot}
                      index={index}
                      isActive={activeSlotIndex === index}
                      isCelticCenter={false}
                      stackIndex={0}
                      isSmall
                      showSlotNumbers={showSlotNumbers}
                      onSlotClick={onSlotClick}
                      onLongPressStart={handleLongPressStart}
                      onLongPressEnd={handleLongPressEnd}
                      onToggleReverse={toggleReverse}
                      onRemove={removeSlot}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
      <div className={isComplexGridLayout ? 'w-full overflow-hidden pb-2' : ''}>
        <div className={shouldScaleGrid ? 'mx-auto' : undefined} style={scaledGridStyle}>
        <div
          className={isCustomGridLayout
            ? `grid mx-auto justify-items-center ${customGridGapClass}`
            : `${currentTemplate.class} ${templateGapOverride}`}
          style={{
            ...(isCustomGridLayout ? {
            gridTemplateColumns: `repeat(${gridCols}, max-content)`,
            display: 'grid'
            } : {}),
            ...(shouldScaleGrid ? {
              width: rawGridWidth,
              maxWidth: 'none',
            } : isCustomGridLayout ? {
              width: 'max-content',
            } : {}),
            ...gridInnerStyle,
          }}
        >
          {(() => {
            const renderedPositions = new Set<string>();
            const isSmall = cardSlots.length > 3;

            return cardSlots.map((slot, index) => {
              const pos = slot.position || itemClasses[index] || '';
              if (renderedPositions.has(pos)) return null;
              renderedPositions.add(pos);

              const slotsAtPos = cardSlots.map((s, i) => ({ ...s, idx: i }))
                .filter(s => (s.position || itemClasses[s.idx] || '') === pos);

              const isCelticCenter = isCelticCross && pos === 'col-start-2 row-start-2';
              const celticLayer = isCelticCenter
                ? 40
                : isCelticCross && pos === 'col-start-2 row-start-3'
                  ? 15
                  : undefined;

              return (
                <div
                  key={pos}
                  className={`relative ${pos} flex items-center justify-center z-10 hover:z-50 transition-all`}
                  style={{ zIndex: celticLayer }}
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
      </div>
      )}
    </div>
  );
};
