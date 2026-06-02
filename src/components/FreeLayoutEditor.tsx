import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, RotateCcw, Trash2 } from 'lucide-react';
import { ReadingSlotData } from '../types';

interface FreeLayoutEditorProps {
  cardSlots: ReadingSlotData[];
  designActiveSlot: number;
  onSetDesignActiveSlot: (idx: number) => void;
  onRemoveSlot: (idx: number) => void;
  onUpdateSlots: (slots: ReadingSlotData[]) => void;
}

const SLOT_WIDTH = 60;
const SLOT_HEIGHT = 84;
const GRID_SIZE = 10;

export const FreeLayoutEditor: React.FC<FreeLayoutEditorProps> = ({
  cardSlots,
  designActiveSlot,
  onSetDesignActiveSlot,
  onRemoveSlot,
  onUpdateSlots
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 500 });

  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current?.parentElement) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        setCanvasSize({ 
          width: Math.min(rect.width - 32, 900), 
          height: Math.max(450, rect.height - 120) 
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const snapToGrid = useCallback((value: number): number => {
    if (!snapEnabled) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, [snapEnabled]);

  const addSlotAtPosition = useCallback((x: number, y: number) => {
    const snappedX = snapToGrid(x - SLOT_WIDTH / 2);
    const snappedY = snapToGrid(y - SLOT_HEIGHT / 2);
    
    const newSlot: ReadingSlotData = {
      name: '',
      isReversed: false,
      label: `位置${cardSlots.length + 1}`,
      x: Math.max(0, Math.min(snappedX, canvasSize.width - SLOT_WIDTH)),
      y: Math.max(0, Math.min(snappedY, canvasSize.height - SLOT_HEIGHT)),
      rotation: 0,
      scale: 1
    };
    
    onUpdateSlots([...cardSlots, newSlot]);
    onSetDesignActiveSlot(cardSlots.length);
  }, [cardSlots, canvasSize, onSetDesignActiveSlot, onUpdateSlots, snapToGrid]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    addSlotAtPosition(e.clientX - rect.left, e.clientY - rect.top);
  }, [addSlotAtPosition]);

  const handleDragEnd = useCallback((_e: unknown, info: { offset: { x: number; y: number } }, idx: number) => {
    const slot = cardSlots[idx];
    const newX = snapToGrid((slot.x || 0) + info.offset.x);
    const newY = snapToGrid((slot.y || 0) + info.offset.y);
    
    const boundedX = Math.max(0, Math.min(newX, canvasSize.width - SLOT_WIDTH * (slot.scale || 1)));
    const boundedY = Math.max(0, Math.min(newY, canvasSize.height - SLOT_HEIGHT * (slot.scale || 1)));
    
    if (boundedX !== slot.x || boundedY !== slot.y) {
      const newSlots = [...cardSlots];
      newSlots[idx] = {
        ...newSlots[idx],
        x: boundedX,
        y: boundedY
      };
      onUpdateSlots(newSlots);
    }
  }, [cardSlots, canvasSize, onUpdateSlots, snapToGrid]);

  const handleRotate = useCallback((idx: number, delta: number) => {
    const newSlots = [...cardSlots];
    newSlots[idx] = {
      ...newSlots[idx],
      rotation: ((newSlots[idx].rotation || 0) + delta) % 360
    };
    onUpdateSlots(newSlots);
  }, [cardSlots, onUpdateSlots]);

  const handleScale = useCallback((idx: number, delta: number) => {
    const newSlots = [...cardSlots];
    newSlots[idx] = {
      ...newSlots[idx],
      scale: Math.max(0.5, Math.min(2, (newSlots[idx].scale || 1) + delta))
    };
    onUpdateSlots(newSlots);
  }, [cardSlots, onUpdateSlots]);

  const handleClearAll = useCallback(() => {
    if (cardSlots.length > 0 && confirm('确定要清空所有牌位吗？')) {
      onUpdateSlots([]);
      onSetDesignActiveSlot(-1);
    }
  }, [cardSlots, onSetDesignActiveSlot, onUpdateSlots]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-forest-accent">自由画布模式</span>
          <span className="px-2 py-0.5 bg-forest-pink/10 text-forest-pink rounded-full text-[9px] font-bold">
            自由摆放
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              addSlotAtPosition(canvasSize.width / 2, canvasSize.height / 2);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-forest-accent to-forest-pink text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <Plus size={18} />
            添加牌位
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                showGrid ? 'bg-forest-accent/10 text-forest-accent' : 'bg-gray-100 text-gray-400'
              }`}
            >
              网格
            </button>
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                snapEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'
              }`}
            >
              对齐
            </button>
            <button
              onClick={handleClearAll}
              className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-all flex items-center gap-1"
            >
              <Trash2 size={10} />
              清空
            </button>
          </div>
        </div>
      </div>

      <div 
        ref={canvasRef}
        className="relative bg-gradient-to-br from-forest-bg/50 to-forest-pink/5 border-2 border-dashed border-forest-accent/20 rounded-2xl overflow-hidden shadow-inner cursor-crosshair"
        style={{ 
          width: canvasSize.width, 
          height: canvasSize.height,
          backgroundImage: showGrid 
            ? 'linear-gradient(#e8d6d6 1px, transparent 1px), linear-gradient(90deg, #e8d6d6 1px, transparent 1px)' 
            : 'none',
          backgroundSize: showGrid ? `${GRID_SIZE * 2}px ${GRID_SIZE * 2}px` : 'auto'
        }}
        onClick={handleCanvasClick}
      >
        {showGrid && (
          <>
            <div className="absolute top-1/2 left-0 right-0 h-px bg-forest-accent/10" style={{ transform: 'translateY(-50%)' }} />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-forest-accent/10" style={{ transform: 'translateX(-50%)' }} />
          </>
        )}

        <AnimatePresence>
          {cardSlots.map((slot, idx) => (
            <motion.div
              key={idx}
              className={`absolute cursor-grab active:cursor-grabbing select-none ${
                idx === designActiveSlot ? 'z-20' : 'z-10'
              }`}
              style={{
                left: slot.x || 0,
                top: slot.y || 0,
                width: SLOT_WIDTH * (slot.scale || 1),
                height: SLOT_HEIGHT * (slot.scale || 1),
                transform: `rotate(${slot.rotation || 0}deg)`
              }}
              onClick={() => onSetDesignActiveSlot(idx)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 1.05, cursor: 'grabbing' }}
              drag
              dragConstraints={canvasRef}
              dragElastic={0}
              dragMomentum={false}
              onDragEnd={(e, info) => handleDragEnd(e, info, idx)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 50 }}
            >
              <div className={`w-full h-full rounded-xl flex flex-col items-center justify-between p-2 shadow-lg transition-all ${
                idx === designActiveSlot
                  ? 'bg-gradient-to-br from-forest-accent to-forest-pink text-white ring-2 ring-white'
                  : 'bg-white text-forest-accent border-2 border-forest-accent/20 hover:border-forest-accent/40'
              }`}>
                <span className={`font-black text-lg ${idx === designActiveSlot ? 'text-white' : 'text-forest-ink'}`}>
                  {idx + 1}
                </span>
                
                <input
                  type="text"
                  className={`w-full px-1 py-0.5 font-bold text-center bg-transparent border-none focus:ring-0 rounded text-[10px] ${
                    idx === designActiveSlot 
                      ? 'text-white/90 placeholder:text-white/40 bg-white/10' 
                      : 'text-forest-ink/70 placeholder:text-forest-ink/30 bg-forest-accent/5'
                  }`}
                  placeholder="位置标签"
                  value={slot.label || ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const newSlots = [...cardSlots];
                    newSlots[idx] = { ...newSlots[idx], label: e.target.value };
                    onUpdateSlots(newSlots);
                  }}
                />
                
                {idx === designActiveSlot && (
                  <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRotate(idx, 15); }}
                      className="p-1 bg-amber-500 text-white rounded-full shadow hover:bg-amber-600 transition-all"
                      title="顺时针旋转"
                    >
                      <RotateCcw size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRotate(idx, -15); }}
                      className="p-1 bg-amber-500 text-white rounded-full shadow hover:bg-amber-600 transition-all rotate-180"
                      title="逆时针旋转"
                    >
                      <RotateCcw size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveSlot(idx); }}
                      className="p-1 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition-all"
                      title="删除"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>

              {idx === designActiveSlot && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleScale(idx, -0.1); }}
                    className="px-1.5 py-0.5 text-[8px] bg-white/80 text-forest-ink rounded hover:bg-white shadow"
                  >
                    -
                  </button>
                  <span className="text-[8px] text-white/80 bg-forest-accent/80 px-1.5 py-0.5 rounded">
                    {((slot.scale || 1) * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleScale(idx, 0.1); }}
                    className="px-1.5 py-0.5 text-[8px] bg-white/80 text-forest-ink rounded hover:bg-white shadow"
                  >
                    +
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
          <Plus size={14} className="text-forest-accent" />
          <span className="text-xs text-forest-muted">点击空白处添加牌位</span>
        </div>
      </div>

      <p className="text-[9px] text-forest-muted text-center">
        💡 拖拽牌位到任意位置，支持旋转、缩放，对齐辅助线帮助精确对齐
      </p>
    </div>
  );
};