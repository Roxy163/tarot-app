import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Text, Image, Circle } from 'react-konva';
import useImage from 'use-image';
import { useSpreadCanvasStore } from '../../store/spreadCanvasStore';

interface CardShapeProps {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  isSelected: boolean;
  label: string;
  imageUrl: string;
  isReversed: boolean;
  cardName: string;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onDoubleClick: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onShiftDrag: (startX: number, currentX: number) => void;
}

type KonvaMouseEvent = {
  evt: MouseEvent;
  stopPropagation?: () => void;
};

export const CardShape: React.FC<CardShapeProps> = ({
  id,
  x,
  y,
  rotation,
  scale,
  isSelected,
  label,
  imageUrl,
  isReversed,
  cardName,
  onClick,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  onWheel,
  onShiftDrag
}) => {
  const [image] = useImage(imageUrl);
  const groupRef = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [shiftDragStart, setShiftDragStart] = useState<number | null>(null);
  const openCardModal = useSpreadCanvasStore(state => state.openCardModal);

  const cardWidth = 120;
  const cardHeight = 200;

  const handleMouseDown = useCallback((e: KonvaMouseEvent) => {
    if ((e.evt.ctrlKey || e.evt.metaKey) && !isSelected) {
      e.stopPropagation();
      onClick(e.evt as unknown as React.MouseEvent);
      return;
    }
    if (e.evt.shiftKey) {
      setShiftDragStart(e.evt.clientX);
      return;
    }
    onClick(e.evt as unknown as React.MouseEvent);
    onDragStart();
    setIsDragging(true);
  }, [isSelected, onClick, onDragStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && groupRef.current) {
      const pos = groupRef.current.position();
      onDragEnd(pos.x, pos.y);
    }
    setIsDragging(false);
    setShiftDragStart(null);
  }, [isDragging, onDragEnd]);

  const handleMouseMove = useCallback((e: KonvaMouseEvent) => {
    if (shiftDragStart !== null) {
      onShiftDrag(shiftDragStart, e.evt.clientX);
      setShiftDragStart(e.evt.clientX);
    }
  }, [shiftDragStart, onShiftDrag]);

  const handleClick = useCallback((e: KonvaMouseEvent) => {
    openCardModal({
      id,
      cardId: '',
      x,
      y,
      rotation,
      scale,
      isReversed,
      zIndex: 0,
      label
    });
  }, [id, x, y, rotation, scale, isReversed, label, openCardModal]);

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      rotation={rotation}
      scaleX={scale}
      scaleY={scale}
      draggable={!isReversed && !shiftDragStart}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={onDoubleClick}
      onClick={handleClick}
      style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
    >
      <Rect
        x={-cardWidth / 2}
        y={-cardHeight / 2}
        width={cardWidth}
        height={cardHeight}
        cornerRadius={8}
        fill={isReversed ? '#2d1f47' : '#ffffff'}
        stroke={isSelected ? '#d4af37' : isHovered ? '#d4af3740' : '#d4af3720'}
        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
        shadowColor={isDragging ? '#000' : 'transparent'}
        shadowBlur={isDragging ? 15 : 0}
        shadowOffsetX={isDragging ? 5 : 0}
        shadowOffsetY={isDragging ? 5 : 0}
      />

      {isReversed ? (
        <Rect
          x={-cardWidth / 2 + 10}
          y={-cardHeight / 2 + 10}
          width={cardWidth - 20}
          height={cardHeight - 20}
          fill="#3d2a5c"
          cornerRadius={4}
        >
          <Rect
            x={10}
            y={10}
            width={cardWidth - 40}
            height={cardHeight - 40}
            fill="#2d1f47"
            cornerRadius={2}
          />
          <Circle
            x={(cardWidth - 20) / 2}
            y={(cardHeight - 20) / 2}
            radius={30}
            fill="transparent"
            stroke="#d4af37"
            strokeWidth={2}
          />
          <Circle
            x={(cardWidth - 20) / 2}
            y={(cardHeight - 20) / 2}
            radius={20}
            fill="transparent"
            stroke="#d4af37"
            strokeWidth={1}
          />
          <Circle
            x={(cardWidth - 20) / 2}
            y={(cardHeight - 20) / 2}
            radius={5}
            fill="#d4af37"
          />
        </Rect>
      ) : image ? (
        <Image
          x={-cardWidth / 2}
          y={-cardHeight / 2}
          width={cardWidth}
          height={cardHeight}
          image={image}
          cornerRadius={8}
        />
      ) : (
        <Rect
          x={-cardWidth / 2}
          y={-cardHeight / 2}
          width={cardWidth}
          height={cardHeight}
          fill="#f0f0f0"
        >
          <Text
            x={0}
            y={-10}
            text={cardName}
            fontSize={14}
            fontFamily="serif"
            fill="#666"
            align="center"
            offsetX={cardWidth / 2}
          />
        </Rect>
      )}

      {isSelected && (
        <>
          <Circle
            x={-cardWidth / 2 - 10}
            y={-cardHeight / 2 - 10}
            radius={8}
            fill="#d4af37"
            stroke="#fff"
            strokeWidth={2}
          />
          <Circle
            x={cardWidth / 2 + 10}
            y={-cardHeight / 2 - 10}
            radius={8}
            fill="#d4af37"
            stroke="#fff"
            strokeWidth={2}
          />
          <Circle
            x={-cardWidth / 2 - 10}
            y={cardHeight / 2 + 10}
            radius={8}
            fill="#d4af37"
            stroke="#fff"
            strokeWidth={2}
          />
          <Circle
            x={cardWidth / 2 + 10}
            y={cardHeight / 2 + 10}
            radius={8}
            fill="#d4af37"
            stroke="#fff"
            strokeWidth={2}
          />
        </>
      )}

      {label && (
        <Text
          x={0}
          y={cardHeight / 2 + 15}
          text={label}
          fontSize={12}
          fontFamily="sans-serif"
          fill="#d4af37"
          align="center"
          offsetX={cardWidth / 2}
        />
      )}
    </Group>
  );
};