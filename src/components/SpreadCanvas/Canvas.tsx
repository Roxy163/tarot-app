import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useSpreadCanvasStore, getCardData, getCardImage } from '../../store/spreadCanvasStore';
import { CardShape } from './CardShape';
import { ContextMenu } from './ContextMenu';

const GRID_SIZE = 20;

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  
  const {
    cards,
    selectedCardIds,
    scale,
    offsetX,
    offsetY,
    isDraggingCanvas,
    isDraggingCard,
    selectCard,
    deselectAll,
    updateCard,
    flipCard,
    rotateCard,
    setOffset,
    setScale,
    setDraggingCanvas,
    setDraggingCard,
    showContextMenuAt,
    hideContextMenu
  } = useSpreadCanvasStore();

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !isDraggingCard) {
      setDraggingCanvas(true);
    }
    if (e.button === 2) {
      e.preventDefault();
      const stage = stageRef.current;
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          showContextMenuAt(pos.x, pos.y);
        }
      }
    }
    deselectAll();
  }, [isDraggingCard, deselectAll, showContextMenuAt]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingCanvas) {
      setDraggingCanvas(false);
    }
  }, [isDraggingCanvas, setDraggingCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const stage = stageRef.current;
      if (stage) {
        const deltaX = e.movementX / scale;
        const deltaY = e.movementY / scale;
        setOffset(offsetX + deltaX, offsetY + deltaY);
      }
    }
  }, [isDraggingCanvas, scale, offsetX, offsetY, setOffset]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = e.deltaY > 0 ? 0.9 : 1.1;
    const mousePointTo = {
      x: stage.getPointerPosition()!.x,
      y: stage.getPointerPosition()!.y
    };

    const newScale = Math.max(0.25, Math.min(3, scale * scaleBy));
    const newOffsetX = mousePointTo.x - (mousePointTo.x - offsetX) * (newScale / scale);
    const newOffsetY = mousePointTo.y - (mousePointTo.y - offsetY) * (newScale / scale);

    setScale(newScale);
    setOffset(newOffsetX, newOffsetY);
  }, [scale, offsetX, offsetY, setScale, setOffset]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete' && selectedCardIds.length > 0) {
      const store = useSpreadCanvasStore.getState();
      selectedCardIds.forEach(id => store.removeCard(id));
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      useSpreadCanvasStore.getState().undo();
    }
    if (e.key === 'Z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      useSpreadCanvasStore.getState().redo();
    }
  }, [selectedCardIds]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const multiSelect = e.ctrlKey || e.metaKey;
    selectCard(id, multiSelect);
  };

  const handleCardDragStart = () => {
    setDraggingCard(true);
  };

  const handleCardDragEnd = (id: string, newX: number, newY: number) => {
    setDraggingCard(false);
    updateCard(id, { x: newX, y: newY });
  };

  const handleCardDoubleClick = (id: string) => {
    flipCard(id);
  };

  const handleCardShiftDrag = (id: string, startX: number, currentX: number) => {
    const delta = Math.round((currentX - startX) / 15) * 15;
    rotateCard(id, delta);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ backgroundColor: '#1a1a2e' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={hideContextMenu}
    >
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        style={{
          transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
          transformOrigin: '0 0',
          cursor: isDraggingCanvas ? 'grabbing' : 'grab'
        }}
      >
        <Layer>
          <Rect
            width={containerSize.width * 10}
            height={containerSize.height * 10}
            fillPatternImage={createGridPattern() as unknown as HTMLImageElement}
            fillPatternRepeat="repeat"
            x={-containerSize.width * 4.5}
            y={-containerSize.height * 4.5}
          />

          {cards.map(card => {
            const cardData = getCardData(card.cardId);
            const imageUrl = getCardImage(card.cardId, card.isReversed);
            const isSelected = selectedCardIds.includes(card.id);

            return (
              <CardShape
                key={card.id}
                id={card.id}
                x={card.x}
                y={card.y}
                rotation={card.rotation}
                scale={card.scale}
                isSelected={isSelected}
                label={card.label}
                imageUrl={imageUrl}
                isReversed={card.isReversed}
                cardName={cardData?.name || ''}
                onClick={(e) => handleCardClick(card.id, e)}
                onDragStart={handleCardDragStart}
                onDragEnd={(newX, newY) => handleCardDragEnd(card.id, newX, newY)}
                onDoubleClick={() => handleCardDoubleClick(card.id)}
                onShiftDrag={(startX, currentX) => handleCardShiftDrag(card.id, startX, currentX)}
              />
            );
          })}
        </Layer>
      </Stage>

      <ContextMenu />

      <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-black/30 px-3 py-2 rounded-lg backdrop-blur-sm">
        <p>缩放: {(scale * 100).toFixed(0)}%</p>
        <p className="text-[10px] mt-1 opacity-70">
          空格拖拽 | Ctrl+滚轮缩放 | Ctrl+点击多选 | Delete删除 | Ctrl+Z撤销
        </p>
      </div>
    </div>
  );
};

function createGridPattern(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, GRID_SIZE, GRID_SIZE);
  return canvas;
}
