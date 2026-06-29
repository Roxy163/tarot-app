import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  Copy,
  Crosshair,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ReadingSlotData } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import {
  createFreeLayoutSlotAt,
  getBoundedFreeLayoutPosition,
  snapFreeLayoutValue,
  FREE_LAYOUT_CANVAS_HEIGHT,
  FREE_LAYOUT_CANVAS_WIDTH,
  FREE_LAYOUT_GRID_SIZE,
  FREE_LAYOUT_SLOT_HEIGHT,
  FREE_LAYOUT_SLOT_WIDTH,
  FREE_LAYOUT_VIEWPORT_HEIGHT,
} from '../lib/freeLayout';

const DRAG_START_DELAY = 160;
const DRAG_MOVE_THRESHOLD = 6;
const CLICK_SUPPRESS_MS = 180;
const PENDING_SLOT_TIMEOUT_MS = 2000;
const ALIGNMENT_SNAP_THRESHOLD = 8;

type DragPosition = {
  x: number;
  y: number;
};

type AlignmentGuide = {
  id: string;
  orientation: 'vertical' | 'horizontal';
  position: number;
};

type AlignedPositionResult = {
  position: DragPosition;
  guides: AlignmentGuide[];
};

type SelectionBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type PointerDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
  isDragging?: boolean;
};

const getSlotScale = (slot: ReadingSlotData) => slot.scale || 1;

const getSlotMetrics = (slot: ReadingSlotData, fallback: DragPosition = { x: 0, y: 0 }) => {
  const scale = getSlotScale(slot);
  const x = typeof slot.x === 'number' ? slot.x : fallback.x;
  const y = typeof slot.y === 'number' ? slot.y : fallback.y;
  const width = FREE_LAYOUT_SLOT_WIDTH * scale;
  const height = FREE_LAYOUT_SLOT_HEIGHT * scale;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    right: x + width,
    bottom: y + height,
  };
};

const getAlignedFreeLayoutPosition = ({
  position,
  movingSlot,
  otherSlots,
  snap,
}: {
  position: DragPosition;
  movingSlot: ReadingSlotData;
  otherSlots: ReadingSlotData[];
  snap: boolean;
}): AlignedPositionResult => {
  if (!snap || otherSlots.length === 0) {
    return { position, guides: [] };
  }

  const movingMetrics = getSlotMetrics({ ...movingSlot, x: position.x, y: position.y });
  const xCandidates = [
    { key: 'left', value: movingMetrics.x, offset: 0 },
    { key: 'center-x', value: movingMetrics.centerX, offset: movingMetrics.width / 2 },
    { key: 'right', value: movingMetrics.right, offset: movingMetrics.width },
  ];
  const yCandidates = [
    { key: 'top', value: movingMetrics.y, offset: 0 },
    { key: 'center-y', value: movingMetrics.centerY, offset: movingMetrics.height / 2 },
    { key: 'bottom', value: movingMetrics.bottom, offset: movingMetrics.height },
  ];
  let bestX: { distance: number; target: number; offset: number; key: string } | null = null;
  let bestY: { distance: number; target: number; offset: number; key: string } | null = null;

  otherSlots.forEach((slot, slotIndex) => {
    const metrics = getSlotMetrics(slot);
    const targetsX = [
      { key: `slot-${slotIndex}-left`, value: metrics.x },
      { key: `slot-${slotIndex}-center-x`, value: metrics.centerX },
      { key: `slot-${slotIndex}-right`, value: metrics.right },
    ];
    const targetsY = [
      { key: `slot-${slotIndex}-top`, value: metrics.y },
      { key: `slot-${slotIndex}-center-y`, value: metrics.centerY },
      { key: `slot-${slotIndex}-bottom`, value: metrics.bottom },
    ];

    xCandidates.forEach(candidate => {
      targetsX.forEach(target => {
        const distance = Math.abs(candidate.value - target.value);
        if (distance <= ALIGNMENT_SNAP_THRESHOLD && (!bestX || distance < bestX.distance)) {
          bestX = {
            distance,
            target: target.value,
            offset: candidate.offset,
            key: `${candidate.key}-${target.key}`,
          };
        }
      });
    });

    yCandidates.forEach(candidate => {
      targetsY.forEach(target => {
        const distance = Math.abs(candidate.value - target.value);
        if (distance <= ALIGNMENT_SNAP_THRESHOLD && (!bestY || distance < bestY.distance)) {
          bestY = {
            distance,
            target: target.value,
            offset: candidate.offset,
            key: `${candidate.key}-${target.key}`,
          };
        }
      });
    });
  });

  const guides: AlignmentGuide[] = [];
  const alignedPosition = { ...position };

  if (bestX) {
    alignedPosition.x = bestX.target - bestX.offset;
    guides.push({
      id: `vertical-${bestX.key}`,
      orientation: 'vertical',
      position: bestX.target,
    });
  }

  if (bestY) {
    alignedPosition.y = bestY.target - bestY.offset;
    guides.push({
      id: `horizontal-${bestY.key}`,
      orientation: 'horizontal',
      position: bestY.target,
    });
  }

  return {
    position: alignedPosition,
    guides,
  };
};

interface FreeLayoutEditorProps {
  cardSlots: ReadingSlotData[];
  designActiveSlot: number;
  onSetDesignActiveSlot: (idx: number) => void;
  onRemoveSlot: (idx: number) => void;
  onUpdateSlots: (slots: ReadingSlotData[]) => void;
}

export const FreeLayoutEditor: React.FC<FreeLayoutEditorProps> = ({
  cardSlots,
  designActiveSlot,
  onSetDesignActiveSlot,
  onRemoveSlot,
  onUpdateSlots
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<ReadingSlotData | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [selectedSlotIndexes, setSelectedSlotIndexes] = useState<number[]>(() => (
    designActiveSlot >= 0 ? [designActiveSlot] : []
  ));
  const [canvasScale, setCanvasScale] = useState(1);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'place' | 'pan'>('place');
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingDragRef = useRef<PointerDragState | null>(null);
  const selectionDragRef = useRef<PointerDragState | null>(null);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const pendingAlignedRef = useRef(false);
  const pendingSuppressClickRef = useRef(false);
  const pendingSuppressClickTimerRef = useRef<number | null>(null);
  const canvasSuppressClickRef = useRef(false);
  const canvasSuppressClickTimerRef = useRef<number | null>(null);
  const pendingExpireTimerRef = useRef<number | null>(null);
  const panStartRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });
  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(FREE_LAYOUT_CANVAS_WIDTH);
  const canvasSize = {
    width: FREE_LAYOUT_CANVAS_WIDTH,
    height: FREE_LAYOUT_CANVAS_HEIGHT,
  };

  useEffect(() => {
    const updateSize = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      const availableWidth = rect?.width || FREE_LAYOUT_CANVAS_WIDTH;
      const nextViewportWidth = Math.max(280, Math.min(availableWidth, 900));

      setViewportWidth(nextViewportWidth);
    };

    updateSize();
    const resizeObserver = typeof ResizeObserver !== 'undefined' && rootRef.current
      ? new ResizeObserver(updateSize)
      : null;

    resizeObserver?.observe(rootRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    setSelectedSlotIndexes(current => {
      const validIndexes = current.filter(idx => idx >= 0 && idx < cardSlots.length);
      if (validIndexes.length > 1 && validIndexes.includes(designActiveSlot)) {
        return validIndexes;
      }
      if (designActiveSlot >= 0 && designActiveSlot < cardSlots.length) {
        return [designActiveSlot];
      }
      return [];
    });
  }, [cardSlots.length, designActiveSlot]);

  const clearPendingExpiry = useCallback(() => {
    if (!pendingExpireTimerRef.current) return;

    window.clearTimeout(pendingExpireTimerRef.current);
    pendingExpireTimerRef.current = null;
  }, []);

  const schedulePendingExpiry = useCallback(() => {
    clearPendingExpiry();
    pendingExpireTimerRef.current = window.setTimeout(() => {
      pendingDragRef.current = null;
      setPendingSlot(null);
      setAlignmentGuides([]);
      pendingExpireTimerRef.current = null;
    }, PENDING_SLOT_TIMEOUT_MS);
  }, [clearPendingExpiry]);

  useEffect(() => () => {
    if (pendingSuppressClickTimerRef.current) {
      window.clearTimeout(pendingSuppressClickTimerRef.current);
    }
    if (canvasSuppressClickTimerRef.current) {
      window.clearTimeout(canvasSuppressClickTimerRef.current);
    }
    clearPendingExpiry();
  }, [clearPendingExpiry]);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: (clientX - rect.left - viewportOffset.x) / canvasScale,
      y: (clientY - rect.top - viewportOffset.y) / canvasScale,
    };
  }, [canvasScale, viewportOffset]);

  const previewSlotAtPosition = useCallback((x: number, y: number) => {
    const previewSlot = createFreeLayoutSlotAt({
      index: cardSlots.length,
      x,
      y,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      snap: snapEnabled,
    });

    setPendingSlot(current => ({
      ...previewSlot,
      label: current?.label || previewSlot.label,
    }));
    setAlignmentGuides([]);
    schedulePendingExpiry();
  }, [cardSlots.length, schedulePendingExpiry, snapEnabled]);

  const getVisibleCanvasCenter = useCallback(() => ({
    x: (viewportWidth / 2 - viewportOffset.x) / canvasScale,
    y: (FREE_LAYOUT_VIEWPORT_HEIGHT / 2 - viewportOffset.y) / canvasScale,
  }), [canvasScale, viewportOffset.x, viewportOffset.y, viewportWidth]);

  const boundCanvasPosition = useCallback(({
    x,
    y,
    scale = 1,
    snap = snapEnabled,
  }: DragPosition & { scale?: number; snap?: boolean }) => (
    getBoundedFreeLayoutPosition({
      x: snapFreeLayoutValue(x, snap),
      y: snapFreeLayoutValue(y, snap),
      scale,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
    })
  ), [snapEnabled]);

  const suppressPendingClick = useCallback(() => {
    pendingSuppressClickRef.current = true;
    if (pendingSuppressClickTimerRef.current) {
      window.clearTimeout(pendingSuppressClickTimerRef.current);
    }
    pendingSuppressClickTimerRef.current = window.setTimeout(() => {
      pendingSuppressClickRef.current = false;
      pendingSuppressClickTimerRef.current = null;
    }, CLICK_SUPPRESS_MS);
  }, []);

  const suppressCanvasClick = useCallback(() => {
    canvasSuppressClickRef.current = true;
    if (canvasSuppressClickTimerRef.current) {
      window.clearTimeout(canvasSuppressClickTimerRef.current);
    }
    canvasSuppressClickTimerRef.current = window.setTimeout(() => {
      canvasSuppressClickRef.current = false;
      canvasSuppressClickTimerRef.current = null;
    }, CLICK_SUPPRESS_MS);
  }, []);

  const startViewportPan = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    panStartRef.current = {
      clientX,
      clientY,
      x: viewportOffset.x,
      y: viewportOffset.y,
    };
  }, [viewportOffset]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current && e.target !== viewportRef.current) return;

    if (interactionMode === 'pan') {
      startViewportPan(e.clientX, e.clientY);
      return;
    }

    const nativeEvent = e.nativeEvent;
    pointersRef.current.set(nativeEvent.pointerId, nativeEvent);

    if (pointersRef.current.size >= 2) {
      selectionDragRef.current = null;
      selectionBoxRef.current = null;
      setSelectionBox(null);
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      pinchRef.current = {
        distance: Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY),
        scale: canvasScale,
      };
      return;
    }

    const startPoint = getCanvasPoint(e.clientX, e.clientY);
    if (!startPoint) return;

    selectionDragRef.current = {
      pointerId: nativeEvent.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: startPoint.x,
      startY: startPoint.y,
      moved: false,
    };
  }, [
    canvasScale,
    getCanvasPoint,
    interactionMode,
    startViewportPan,
  ]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== 'place') return;
    if (e.target !== canvasRef.current && e.target !== viewportRef.current) return;
    if (canvasSuppressClickRef.current) return;

    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;

    previewSlotAtPosition(point.x, point.y);
  }, [getCanvasPoint, interactionMode, previewSlotAtPosition]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const nativeEvent = e.nativeEvent;
    if (!pointersRef.current.has(nativeEvent.pointerId)) return;

    pointersRef.current.set(nativeEvent.pointerId, nativeEvent);

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      const nextDistance = Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
      const nextScale = Math.max(0.55, Math.min(1.8, pinchRef.current.scale * (nextDistance / pinchRef.current.distance)));
      setCanvasScale(nextScale);
      return;
    }
    const dragState = selectionDragRef.current;
    if (!dragState || dragState.pointerId !== nativeEvent.pointerId) return;

    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;

    const deltaX = e.clientX - dragState.startClientX;
    const deltaY = e.clientY - dragState.startClientY;
    if (!dragState.moved && Math.hypot(deltaX, deltaY) < DRAG_MOVE_THRESHOLD) return;

    dragState.moved = true;
    const nextSelectionBox = {
      startX: dragState.startX,
      startY: dragState.startY,
      currentX: point.x,
      currentY: point.y,
    };
    selectionBoxRef.current = nextSelectionBox;
    setSelectionBox(nextSelectionBox);
  }, [getCanvasPoint]);

  const finishCanvasPointer = useCallback((pointerId: number) => {
    const dragState = selectionDragRef.current;
    if (dragState?.pointerId === pointerId) {
      const finishedSelectionBox = selectionBoxRef.current;
      if (dragState.moved && finishedSelectionBox) {
        const left = Math.min(finishedSelectionBox.startX, finishedSelectionBox.currentX);
        const right = Math.max(finishedSelectionBox.startX, finishedSelectionBox.currentX);
        const top = Math.min(finishedSelectionBox.startY, finishedSelectionBox.currentY);
        const bottom = Math.max(finishedSelectionBox.startY, finishedSelectionBox.currentY);
        const selectedIndexes = cardSlots.reduce<number[]>((result, slot, idx) => {
          const metrics = getSlotMetrics(slot);
          const intersects = metrics.right >= left
            && metrics.x <= right
            && metrics.bottom >= top
            && metrics.y <= bottom;

          return intersects ? [...result, idx] : result;
        }, []);

        setSelectedSlotIndexes(selectedIndexes);
        onSetDesignActiveSlot(selectedIndexes[0] ?? -1);
        suppressCanvasClick();
      }

      selectionDragRef.current = null;
      selectionBoxRef.current = null;
      setSelectionBox(null);
    }

    pointersRef.current.delete(pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
  }, [cardSlots, onSetDesignActiveSlot, suppressCanvasClick]);

  const handleMoveSlot = useCallback((idx: number, x: number, y: number, options?: { snap?: boolean; moveSelection?: boolean }) => {
    const slot = cardSlots[idx];
    if (!slot) return;

    const bounded = boundCanvasPosition({
      x,
      y,
      scale: slot.scale || 1,
      snap: options?.snap ?? snapEnabled,
    });

    if (options?.moveSelection && selectedSlotIndexes.includes(idx) && selectedSlotIndexes.length > 1) {
      const deltaX = bounded.x - (slot.x || 0);
      const deltaY = bounded.y - (slot.y || 0);
      const selectedIndexes = new Set(selectedSlotIndexes);
      const newSlots = cardSlots.map((currentSlot, currentIdx) => (
        selectedIndexes.has(currentIdx)
          ? {
            ...currentSlot,
            x: (currentSlot.x || 0) + deltaX,
            y: (currentSlot.y || 0) + deltaY,
          }
          : currentSlot
      ));

      onUpdateSlots(newSlots);
      setAlignmentGuides([]);
      return;
    }
    
    if (bounded.x !== slot.x || bounded.y !== slot.y) {
      const newSlots = [...cardSlots];
      newSlots[idx] = {
        ...newSlots[idx],
        x: bounded.x,
        y: bounded.y
      };
      onUpdateSlots(newSlots);
    }
    setAlignmentGuides([]);
  }, [boundCanvasPosition, cardSlots, onUpdateSlots, selectedSlotIndexes, snapEnabled]);

  const handlePendingPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pendingSlot) return;

    e.stopPropagation();
    clearPendingExpiry();
    const pointerId = e.nativeEvent.pointerId;
    pendingDragRef.current = {
      pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pendingSlot.x || 0,
      startY: pendingSlot.y || 0,
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(pointerId);
  }, [clearPendingExpiry, pendingSlot]);

  const handlePendingPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const dragState = pendingDragRef.current;
    if (!dragState || dragState.pointerId !== e.nativeEvent.pointerId) return;

    e.stopPropagation();
    const deltaX = (e.clientX - dragState.startClientX) / canvasScale;
    const deltaY = (e.clientY - dragState.startClientY) / canvasScale;

    if (!dragState.moved && Math.hypot(deltaX, deltaY) < DRAG_MOVE_THRESHOLD) return;

    dragState.moved = true;
    const bounded = boundCanvasPosition({
      x: dragState.startX + deltaX,
      y: dragState.startY + deltaY,
      snap: false,
    });
    const aligned = getAlignedFreeLayoutPosition({
      position: bounded,
      movingSlot: pendingSlot,
      otherSlots: cardSlots,
      snap: snapEnabled,
    });

    setPendingSlot(current => current ? ({
      ...current,
      x: aligned.position.x,
      y: aligned.position.y,
    }) : current);
    pendingAlignedRef.current = aligned.guides.length > 0;
    setAlignmentGuides(aligned.guides);
  }, [boundCanvasPosition, canvasScale, cardSlots, pendingSlot, snapEnabled]);

  const finishPendingPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const dragState = pendingDragRef.current;
    if (!dragState || dragState.pointerId !== e.nativeEvent.pointerId) return;

    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(dragState.pointerId);
    pendingDragRef.current = null;

    if (!dragState.moved) return;

    setPendingSlot(current => {
      if (!current) return current;
      const bounded = boundCanvasPosition({
        x: current.x || 0,
        y: current.y || 0,
        scale: current.scale || 1,
        snap: !pendingAlignedRef.current,
      });

      return {
        ...current,
        x: bounded.x,
        y: bounded.y,
      };
    });
    pendingAlignedRef.current = false;
    setAlignmentGuides([]);
    suppressPendingClick();
    schedulePendingExpiry();
  }, [boundCanvasPosition, schedulePendingExpiry, suppressPendingClick]);

  const commitPendingSlot = useCallback(() => {
    if (!pendingSlot) return;

    clearPendingExpiry();
    const bounded = boundCanvasPosition({
      x: pendingSlot.x || 0,
      y: pendingSlot.y || 0,
      scale: pendingSlot.scale || 1,
      snap: !pendingAlignedRef.current,
    });
    const nextSlot = {
      ...pendingSlot,
      x: bounded.x,
      y: bounded.y,
      label: pendingSlot.label || `位置${cardSlots.length + 1}`,
    };

    onUpdateSlots([...cardSlots, nextSlot]);
    onSetDesignActiveSlot(cardSlots.length);
    setPendingSlot(null);
    pendingAlignedRef.current = false;
    setAlignmentGuides([]);

    if (window.navigator.vibrate) {
      window.navigator.vibrate(35);
    }
  }, [boundCanvasPosition, cardSlots, clearPendingExpiry, onSetDesignActiveSlot, onUpdateSlots, pendingSlot]);

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
    if (cardSlots.length > 0) setShowClearConfirm(true);
  }, [cardSlots.length]);

  const visibleWorldFrame = {
    left: (0 - viewportOffset.x) / canvasScale,
    top: (0 - viewportOffset.y) / canvasScale,
    width: viewportWidth / canvasScale,
    height: FREE_LAYOUT_VIEWPORT_HEIGHT / canvasScale,
  };

  const activeSlot = cardSlots[designActiveSlot] || null;
  const activeSlotMetrics = activeSlot ? getSlotMetrics(activeSlot) : null;
  const visibleCenter = getVisibleCanvasCenter();
  const axisLineWidth = Math.max(1, 1 / canvasScale);
  const selectedSlotSet = new Set(selectedSlotIndexes);
  const isMultiSelecting = selectedSlotIndexes.length > 1;
  const canMirrorGroup = Boolean(activeSlot) && cardSlots.length > 1;

  const handleSelectSlot = useCallback((idx: number, additive = false, preserveSelection = false) => {
    if (preserveSelection && selectedSlotIndexes.includes(idx)) {
      onSetDesignActiveSlot(idx);
      setPendingSlot(null);
      setAlignmentGuides([]);
      return;
    }

    const nextSelection = additive
      ? selectedSlotIndexes.includes(idx)
        ? selectedSlotIndexes.filter(selectedIdx => selectedIdx !== idx)
        : [...selectedSlotIndexes, idx]
      : [idx];
    const nextActive = nextSelection.includes(idx) ? idx : nextSelection[0] ?? -1;

    setSelectedSlotIndexes(nextSelection);
    onSetDesignActiveSlot(nextActive);
    setPendingSlot(null);
    setAlignmentGuides([]);
  }, [onSetDesignActiveSlot, selectedSlotIndexes]);

  const createEmptyCopiedSlot = useCallback((slot: ReadingSlotData, nextPosition: DragPosition, labelIndex = cardSlots.length): ReadingSlotData => ({
    ...slot,
    name: '',
    isReversed: false,
    label: `位置${labelIndex + 1}`,
    position: '',
    x: nextPosition.x,
    y: nextPosition.y,
  }), [cardSlots.length]);

  const addCopiedSlot = useCallback((slot: ReadingSlotData, nextPosition: DragPosition) => {
    const bounded = boundCanvasPosition({
      ...nextPosition,
      scale: slot.scale || 1,
    });
    const nextSlot = createEmptyCopiedSlot(slot, bounded);

    onUpdateSlots([...cardSlots, nextSlot]);
    onSetDesignActiveSlot(cardSlots.length);
  }, [boundCanvasPosition, cardSlots, createEmptyCopiedSlot, onSetDesignActiveSlot, onUpdateSlots]);

  const handleDuplicateActiveSlot = useCallback(() => {
    const slot = cardSlots[designActiveSlot];
    if (!slot) return;

    addCopiedSlot(slot, {
      x: (slot.x || 0) + FREE_LAYOUT_GRID_SIZE * 3,
      y: (slot.y || 0) + FREE_LAYOUT_GRID_SIZE * 3,
    });
  }, [addCopiedSlot, cardSlots, designActiveSlot]);

  const handleDuplicateSelectedSlots = useCallback(() => {
    if (selectedSlotIndexes.length === 0) return;

    const copiedSlots = selectedSlotIndexes
      .map((idx, sourceIndex) => {
        const slot = cardSlots[idx];
        if (!slot) return null;

        const nextPosition = boundCanvasPosition({
          x: (slot.x || 0) + FREE_LAYOUT_GRID_SIZE * 3,
          y: (slot.y || 0) + FREE_LAYOUT_GRID_SIZE * 3,
          scale: slot.scale || 1,
        });

        return createEmptyCopiedSlot(slot, nextPosition, cardSlots.length + sourceIndex);
      })
      .filter((slot): slot is ReadingSlotData => Boolean(slot));

    if (copiedSlots.length === 0) return;

    const nextSelection = copiedSlots.map((_, idx) => cardSlots.length + idx);
    onUpdateSlots([...cardSlots, ...copiedSlots]);
    setSelectedSlotIndexes(nextSelection);
    onSetDesignActiveSlot(nextSelection[0] ?? -1);
  }, [
    boundCanvasPosition,
    cardSlots,
    createEmptyCopiedSlot,
    onSetDesignActiveSlot,
    onUpdateSlots,
    selectedSlotIndexes,
  ]);

  const handleDeleteSelectedSlots = useCallback(() => {
    if (selectedSlotIndexes.length === 0) return;

    const selectedIndexes = new Set(selectedSlotIndexes);
    const remainingSlots = cardSlots.filter((_, idx) => !selectedIndexes.has(idx));

    onUpdateSlots(remainingSlots);
    setSelectedSlotIndexes([]);
    onSetDesignActiveSlot(-1);
  }, [cardSlots, onSetDesignActiveSlot, onUpdateSlots, selectedSlotIndexes]);

  const handleCenterSelectedSlots = useCallback((axis: 'horizontal' | 'vertical') => {
    if (selectedSlotIndexes.length === 0) return;

    const selectedMetrics = selectedSlotIndexes
      .map(idx => ({ idx, metrics: cardSlots[idx] ? getSlotMetrics(cardSlots[idx]) : null }))
      .filter((item): item is { idx: number; metrics: ReturnType<typeof getSlotMetrics> } => Boolean(item.metrics));

    if (selectedMetrics.length === 0) return;

    const bounds = selectedMetrics.reduce((result, item) => ({
      left: Math.min(result.left, item.metrics.x),
      right: Math.max(result.right, item.metrics.right),
      top: Math.min(result.top, item.metrics.y),
      bottom: Math.max(result.bottom, item.metrics.bottom),
    }), {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    });
    const center = getVisibleCanvasCenter();
    const deltaX = axis === 'horizontal' ? center.x - (bounds.left + bounds.right) / 2 : 0;
    const deltaY = axis === 'vertical' ? center.y - (bounds.top + bounds.bottom) / 2 : 0;
    const selectedIndexes = new Set(selectedMetrics.map(item => item.idx));
    const newSlots = cardSlots.map((slot, idx) => {
      if (!selectedIndexes.has(idx)) return slot;

      return {
        ...slot,
        x: (slot.x || 0) + deltaX,
        y: (slot.y || 0) + deltaY,
      };
    });

    onUpdateSlots(newSlots);
  }, [cardSlots, getVisibleCanvasCenter, onUpdateSlots, selectedSlotIndexes]);

  const handleRotateSelectedSlots = useCallback((delta: number) => {
    if (selectedSlotIndexes.length === 0) return;

    const selectedIndexes = new Set(selectedSlotIndexes);
    const newSlots = cardSlots.map((slot, idx) => (
      selectedIndexes.has(idx)
        ? {
          ...slot,
          rotation: ((slot.rotation || 0) + delta) % 360,
        }
        : slot
    ));

    onUpdateSlots(newSlots);
  }, [cardSlots, onUpdateSlots, selectedSlotIndexes]);

  const handleScaleSelectedSlots = useCallback((delta: number) => {
    if (selectedSlotIndexes.length === 0) return;

    const selectedIndexes = new Set(selectedSlotIndexes);
    const newSlots = cardSlots.map((slot, idx) => (
      selectedIndexes.has(idx)
        ? {
          ...slot,
          scale: Math.max(0.5, Math.min(2, (slot.scale || 1) + delta)),
        }
        : slot
    ));

    onUpdateSlots(newSlots);
  }, [cardSlots, onUpdateSlots, selectedSlotIndexes]);

  const handleMirrorCopyActiveSlot = useCallback((axis: 'horizontal' | 'vertical') => {
    const slot = cardSlots[designActiveSlot];
    if (!slot) return;

    const center = getVisibleCanvasCenter();
    const metrics = getSlotMetrics(slot);
    const mirroredPosition = axis === 'horizontal'
      ? {
        x: center.x * 2 - metrics.centerX - metrics.width / 2,
        y: metrics.y,
      }
      : {
        x: metrics.x,
        y: center.y * 2 - metrics.centerY - metrics.height / 2,
      };
    const minSeparationX = metrics.width + FREE_LAYOUT_GRID_SIZE * 2;
    const minSeparationY = metrics.height + FREE_LAYOUT_GRID_SIZE * 2;
    const isTooClose = axis === 'horizontal'
      ? Math.abs(mirroredPosition.x - metrics.x) < minSeparationX
      : Math.abs(mirroredPosition.y - metrics.y) < minSeparationY;
    const nextPosition = { ...mirroredPosition };

    if (isTooClose && axis === 'horizontal') {
      nextPosition.x = metrics.x < center.x
        ? metrics.x + minSeparationX
        : metrics.x - minSeparationX;
    }

    if (isTooClose && axis === 'vertical') {
      nextPosition.y = metrics.y < center.y
        ? metrics.y + minSeparationY
        : metrics.y - minSeparationY;
    }

    addCopiedSlot(slot, nextPosition);
  }, [addCopiedSlot, cardSlots, designActiveSlot, getVisibleCanvasCenter]);

  const handleMirrorGroupAroundActive = useCallback((axis: 'horizontal' | 'vertical') => {
    const anchorSlot = cardSlots[designActiveSlot];
    if (!anchorSlot || cardSlots.length < 2) return;

    const anchorMetrics = getSlotMetrics(anchorSlot);
    const mirroredSlots = cardSlots
      .filter((_, idx) => idx !== designActiveSlot)
      .map((slot, sourceIndex) => {
        const metrics = getSlotMetrics(slot);
        const mirroredPosition = axis === 'horizontal'
          ? {
            x: anchorMetrics.centerX * 2 - metrics.centerX - metrics.width / 2,
            y: metrics.y,
          }
          : {
            x: metrics.x,
            y: anchorMetrics.centerY * 2 - metrics.centerY - metrics.height / 2,
          };
        const bounded = boundCanvasPosition({
          ...mirroredPosition,
          scale: slot.scale || 1,
        });

        return createEmptyCopiedSlot(slot, bounded, cardSlots.length + sourceIndex);
      });

    if (mirroredSlots.length === 0) return;

    onUpdateSlots([...cardSlots, ...mirroredSlots]);
    onSetDesignActiveSlot(cardSlots.length);
  }, [
    boundCanvasPosition,
    cardSlots,
    createEmptyCopiedSlot,
    designActiveSlot,
    onSetDesignActiveSlot,
    onUpdateSlots,
  ]);

  const handleCenterActiveSlot = useCallback((axis: 'horizontal' | 'vertical') => {
    const slot = cardSlots[designActiveSlot];
    if (!slot) return;

    const center = getVisibleCanvasCenter();
    const metrics = getSlotMetrics(slot);
    const bounded = boundCanvasPosition({
      x: axis === 'horizontal' ? center.x - metrics.width / 2 : metrics.x,
      y: axis === 'vertical' ? center.y - metrics.height / 2 : metrics.y,
      scale: slot.scale || 1,
    });
    const nextSlots = [...cardSlots];

    nextSlots[designActiveSlot] = {
      ...slot,
      x: bounded.x,
      y: bounded.y,
    };
    onUpdateSlots(nextSlots);
  }, [boundCanvasPosition, cardSlots, designActiveSlot, getVisibleCanvasCenter, onUpdateSlots]);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (interactionMode !== 'pan') return;
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;

    startViewportPan(e.clientX, e.clientY);
  }, [interactionMode, startViewportPan]);

  const handleViewportPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    setViewportOffset({
      x: panStartRef.current.x + e.clientX - panStartRef.current.clientX,
      y: panStartRef.current.y + e.clientY - panStartRef.current.clientY,
    });
  }, [isPanning]);

  const stopPanning = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setCanvasScale(1);
    setViewportOffset({ x: 0, y: 0 });
  }, []);

  const updateCanvasScale = useCallback((getNextScale: (currentScale: number) => number) => {
    setCanvasScale(currentScale => Math.max(0.55, Math.min(1.8, getNextScale(currentScale))));
  }, []);

  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    const direction = e.deltaY > 0 ? -0.08 : 0.08;
    updateCanvasScale(prev => prev + direction);
  }, [updateCanvasScale]);

  return (
    <div ref={rootRef} className="w-full max-w-[900px] space-y-3">
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="清空位置"
        message="确定要清空自由画布上的所有位置吗？"
        confirmText="清空"
        destructive
        onConfirm={() => {
          onUpdateSlots([]);
          onSetDesignActiveSlot(-1);
          setAlignmentGuides([]);
        }}
        onClose={() => setShowClearConfirm(false)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-forest-accent">自由画布模式</span>
          <span className="px-2 py-0.5 bg-forest-pink/10 text-forest-pink rounded-full text-[9px] font-bold">
            自由摆放
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-h-11 items-center rounded-xl bg-forest-bg p-1">
              <button
                type="button"
                onClick={() => setInteractionMode('place')}
                className={`flex min-h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold transition-all ${
                  interactionMode === 'place'
                    ? 'bg-white text-forest-accent shadow-sm'
                    : 'text-forest-muted hover:text-forest-accent'
                }`}
              >
                <Crosshair size={13} />
                摆牌
              </button>
              <button
                type="button"
                onClick={() => setInteractionMode('pan')}
                className={`flex min-h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold transition-all ${
                  interactionMode === 'pan'
                    ? 'bg-white text-forest-accent shadow-sm'
                    : 'text-forest-muted hover:text-forest-accent'
                }`}
              >
                <Move size={13} />
                移动画布
              </button>
            </div>
            <button
              type="button"
              onClick={() => updateCanvasScale(prev => prev + 0.1)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent transition-all hover:bg-forest-accent/20"
              title="放大画布"
              aria-label="放大画布"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => updateCanvasScale(prev => prev - 0.1)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent transition-all hover:bg-forest-accent/20"
              title="缩小画布"
              aria-label="缩小画布"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent transition-all hover:bg-forest-accent/20"
              title="重置视图"
              aria-label="重置视图"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`min-h-11 rounded-xl px-3 text-[10px] font-bold transition-all ${
                showGrid ? 'bg-forest-accent/10 text-forest-accent' : 'bg-gray-100 text-gray-400'
              }`}
            >
              网格
            </button>
            <button
              type="button"
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`min-h-11 rounded-xl px-3 text-[10px] font-bold transition-all ${
                snapEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'
              }`}
            >
              对齐
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={cardSlots.length === 0}
              className={`flex min-h-11 items-center gap-1 rounded-xl px-3 text-[10px] font-bold transition-all ${
                cardSlots.length === 0
                  ? 'cursor-not-allowed bg-gray-100 text-gray-300'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              <Trash2 size={10} />
              清空
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="free-layout-viewport"
        className={`relative overflow-hidden rounded-2xl border border-forest-accent/10 bg-forest-bg/40 shadow-inner touch-none ${
          isPanning ? 'cursor-grabbing' : interactionMode === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
        }`}
        style={{
          width: viewportWidth,
          maxWidth: '100%',
          height: FREE_LAYOUT_VIEWPORT_HEIGHT,
          backgroundImage: showGrid
            ? 'linear-gradient(#e8d6d6 1px, transparent 1px), linear-gradient(90deg, #e8d6d6 1px, transparent 1px)'
            : 'none',
          backgroundPosition: `${viewportOffset.x}px ${viewportOffset.y}px`,
          backgroundSize: showGrid
            ? `${FREE_LAYOUT_GRID_SIZE * 2 * canvasScale}px ${FREE_LAYOUT_GRID_SIZE * 2 * canvasScale}px`
            : 'auto',
        }}
        onPointerDown={(e) => {
          handleCanvasPointerDown(e);
          handleViewportPointerDown(e);
        }}
        onPointerMove={(e) => {
          handleCanvasPointerMove(e);
          handleViewportPointerMove(e);
        }}
        onPointerUp={(e) => {
          finishCanvasPointer(e.nativeEvent.pointerId);
          stopPanning();
        }}
        onPointerCancel={(e) => {
          finishCanvasPointer(e.nativeEvent.pointerId);
          stopPanning();
        }}
        onWheel={handleCanvasWheel}
        onClick={handleCanvasClick}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${canvasScale})`,
            transformOrigin: '0 0',
          }}
        >
          <div
            ref={canvasRef}
            className="relative cursor-crosshair touch-none"
            style={{
              width: 1,
              height: 1,
            }}
            data-testid="free-layout-canvas"
          >
            <AnimatePresence>
              <motion.div
                key="free-layout-center-axis-vertical"
                data-testid="free-layout-center-axis-vertical"
                className="pointer-events-none absolute z-[1]"
                style={{
                  left: visibleCenter.x,
                  top: visibleWorldFrame.top,
                  height: visibleWorldFrame.height,
                  borderLeft: `${axisLineWidth}px dashed rgba(74, 107, 72, 0.32)`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
              <motion.div
                key="free-layout-center-axis-horizontal"
                data-testid="free-layout-center-axis-horizontal"
                className="pointer-events-none absolute z-[1]"
                style={{
                  left: visibleWorldFrame.left,
                  top: visibleCenter.y,
                  width: visibleWorldFrame.width,
                  borderTop: `${axisLineWidth}px dashed rgba(74, 107, 72, 0.32)`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />

              {activeSlotMetrics && (
                <>
                  <motion.div
                    key="free-layout-active-axis-vertical"
                    data-testid="free-layout-active-axis-vertical"
                    className="pointer-events-none absolute z-[2]"
                    style={{
                      left: activeSlotMetrics.centerX,
                      top: visibleWorldFrame.top,
                      height: visibleWorldFrame.height,
                      borderLeft: `${axisLineWidth}px solid rgba(184, 78, 104, 0.34)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <motion.div
                    key="free-layout-active-axis-horizontal"
                    data-testid="free-layout-active-axis-horizontal"
                    className="pointer-events-none absolute z-[2]"
                    style={{
                      left: visibleWorldFrame.left,
                      top: activeSlotMetrics.centerY,
                      width: visibleWorldFrame.width,
                      borderTop: `${axisLineWidth}px solid rgba(184, 78, 104, 0.34)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                </>
              )}

              {alignmentGuides.map(guide => (
                <motion.div
                  key={guide.id}
                  data-testid={`free-layout-guide-${guide.orientation}`}
                  className="pointer-events-none absolute z-20"
                  style={guide.orientation === 'vertical'
                    ? {
                      left: guide.position,
                      top: visibleWorldFrame.top,
                      height: visibleWorldFrame.height,
                      borderLeft: `${Math.max(1, 1 / canvasScale)}px dashed rgba(184, 78, 104, 0.85)`,
                    }
                    : {
                      left: visibleWorldFrame.left,
                      top: guide.position,
                      width: visibleWorldFrame.width,
                      borderTop: `${Math.max(1, 1 / canvasScale)}px dashed rgba(184, 78, 104, 0.85)`,
                    }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              ))}

              {selectionBox && (
                <motion.div
                  key="free-layout-selection-box"
                  data-testid="free-layout-selection-box"
                  className="pointer-events-none absolute z-40 rounded-xl bg-forest-accent/10 ring-1 ring-forest-accent/45"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                    width: Math.abs(selectionBox.currentX - selectionBox.startX),
                    height: Math.abs(selectionBox.currentY - selectionBox.startY),
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}

              {cardSlots.length === 0 && !pendingSlot && (
                <motion.div
                  key="free-layout-empty-guide"
                  data-testid="free-layout-empty-guide"
                  className="pointer-events-none absolute z-10 flex w-[min(260px,80vw)] flex-col items-center gap-2 rounded-2xl border border-forest-accent/10 bg-white/85 px-4 py-4 text-center shadow-sm backdrop-blur-sm"
                  style={{
                    left: (viewportWidth / 2 - viewportOffset.x) / canvasScale,
                    top: (FREE_LAYOUT_VIEWPORT_HEIGHT / 2 - viewportOffset.y) / canvasScale,
                    transform: `translate(-50%, -50%) scale(${1 / canvasScale})`,
                    transformOrigin: 'center',
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-accent/10 text-forest-accent">
                    <Plus size={18} />
                  </div>
                  <p className="text-xs font-bold text-forest-ink">点击画布创建第一个位置</p>
                  <p className="text-[10px] leading-relaxed text-forest-muted">虚影会短暂停留，拖到想要的位置后点击固定。</p>
                </motion.div>
              )}

              {pendingSlot && (
                <motion.div
                  key="pending-slot"
                  data-testid="free-layout-pending-slot"
                  className="absolute z-30 cursor-grab select-none active:cursor-grabbing"
                  style={{
                    left: pendingSlot.x || 0,
                    top: pendingSlot.y || 0,
                    width: FREE_LAYOUT_SLOT_WIDTH,
                    height: FREE_LAYOUT_SLOT_HEIGHT,
                  }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  onPointerDown={handlePendingPointerDown}
                  onPointerMove={handlePendingPointerMove}
                  onPointerUp={finishPendingPointer}
                  onPointerCancel={finishPendingPointer}
                  onPointerEnter={clearPendingExpiry}
                  onPointerLeave={() => {
                    if (!pendingDragRef.current) schedulePendingExpiry();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pendingSuppressClickRef.current) {
                      return;
                    }
                    commitPendingSlot();
                  }}
                >
                  <div className="w-full h-full rounded-xl border-2 border-dashed border-forest-pink bg-white/70 shadow-lg flex flex-col items-center justify-center gap-1">
                    <Crosshair size={18} className="text-forest-pink" />
                    <span className="rounded-full bg-forest-pink/10 px-1.5 py-0.5 text-[8px] font-bold text-forest-pink">
                      点击固定
                    </span>
                  </div>
                </motion.div>
              )}

              {cardSlots.map((slot, idx) => (
                <FreeLayoutSlot
                  key={idx}
                  idx={idx}
                  slot={slot}
                  isActive={idx === designActiveSlot}
                  isSelected={selectedSlotSet.has(idx)}
                  selectedCount={selectedSlotIndexes.length}
                  canvasScale={canvasScale}
                  canvasSize={canvasSize}
                  onSelectSlot={handleSelectSlot}
                  onUpdateSlots={onUpdateSlots}
                  onMoveSlot={handleMoveSlot}
                  cardSlots={cardSlots}
                  snapEnabled={snapEnabled}
                  onUpdateAlignmentGuides={setAlignmentGuides}
                />
              ))}
            </AnimatePresence>

            <div
              className="absolute flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm pointer-events-none"
              style={{
                left: (viewportWidth / 2 - viewportOffset.x) / canvasScale,
                top: (FREE_LAYOUT_VIEWPORT_HEIGHT - 44 - viewportOffset.y) / canvasScale,
                transform: `translateX(-50%) scale(${1 / canvasScale})`,
                transformOrigin: 'center bottom',
              }}
            >
              <Plus size={14} className="text-forest-accent" />
              <span className="text-xs text-forest-muted">单击出现虚影，拖动后点击固定</span>
            </div>
          </div>
        </div>

        <div className="absolute left-3 top-3 flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded-full shadow-sm text-[10px] font-bold text-forest-accent pointer-events-none">
          <Move size={11} />
          <span>{interactionMode === 'pan' ? '移动画布' : `${(canvasScale * 100).toFixed(0)}%`}</span>
        </div>
      </div>

      <p className="text-[9px] text-forest-muted text-center">
        点击空白处预览落点，虚影会在 2 秒后自动取消；切到移动视图可拖动画布。
      </p>

      {activeSlot && (
        <div className="rounded-2xl border border-forest-accent/10 bg-white/85 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-forest-accent">
              {isMultiSelecting ? `已选中 ${selectedSlotIndexes.length} 个位置` : `已选中：${activeSlot.label || `位置${designActiveSlot + 1}`}`}
            </p>
            <span className="rounded-full bg-forest-accent/10 px-2 py-1 text-[9px] font-bold text-forest-accent">
              {isMultiSelecting ? '多选操作' : '快捷摆位'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {isMultiSelecting ? (
              <>
                <button
                  type="button"
                  onClick={handleDuplicateSelectedSlots}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/10 px-2 text-[10px] font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
                >
                  <Copy size={14} />
                  复制所选
                </button>
                <button
                  type="button"
                  onClick={() => handleCenterSelectedSlots('horizontal')}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
                >
                  <AlignCenterHorizontal size={14} />
                  所选水平
                </button>
                <button
                  type="button"
                  onClick={() => handleCenterSelectedSlots('vertical')}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
                >
                  <AlignCenterVertical size={14} />
                  所选垂直
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateSelectedSlots(-15)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/10 px-2 text-[10px] font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
                >
                  <RotateCcw size={14} />
                  所选左旋
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateSelectedSlots(15)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/10 px-2 text-[10px] font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
                >
                  <RotateCcw size={14} className="rotate-180" />
                  所选右旋
                </button>
                <button
                  type="button"
                  onClick={() => handleScaleSelectedSlots(-0.1)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
                >
                  <Minus size={14} />
                  所选缩小
                </button>
                <button
                  type="button"
                  onClick={() => handleScaleSelectedSlots(0.1)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
                >
                  <Plus size={14} />
                  所选放大
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedSlots}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-red-100 px-2 text-[10px] font-bold text-red-600 transition-all hover:bg-red-200"
                >
                  <Trash2 size={14} />
                  删除所选
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlotIndexes([designActiveSlot].filter(idx => idx >= 0))}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-gray-100 px-2 text-[10px] font-bold text-forest-muted transition-all hover:bg-gray-200"
                >
                  <Crosshair size={14} />
                  取消多选
                </button>
              </>
            ) : (
              <>
            <button
              type="button"
              onClick={handleDuplicateActiveSlot}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/10 px-2 text-[10px] font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
            >
              <Copy size={14} />
              复制
            </button>
            <button
              type="button"
              onClick={() => handleMirrorCopyActiveSlot('horizontal')}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-pink/10 px-2 text-[10px] font-bold text-forest-pink transition-all hover:bg-forest-pink/20"
            >
              <FlipHorizontal size={14} />
              左右镜像
            </button>
            <button
              type="button"
              onClick={() => handleMirrorCopyActiveSlot('vertical')}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-pink/10 px-2 text-[10px] font-bold text-forest-pink transition-all hover:bg-forest-pink/20"
            >
              <FlipVertical size={14} />
              上下镜像
            </button>
            <button
              type="button"
              onClick={() => handleMirrorGroupAroundActive('horizontal')}
              disabled={!canMirrorGroup}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-bold transition-all ${
                canMirrorGroup
                  ? 'bg-forest-pink/10 text-forest-pink hover:bg-forest-pink/20'
                  : 'cursor-not-allowed bg-gray-100 text-gray-300'
              }`}
            >
              <FlipHorizontal size={14} />
              成组左右
            </button>
            <button
              type="button"
              onClick={() => handleMirrorGroupAroundActive('vertical')}
              disabled={!canMirrorGroup}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-bold transition-all ${
                canMirrorGroup
                  ? 'bg-forest-pink/10 text-forest-pink hover:bg-forest-pink/20'
                  : 'cursor-not-allowed bg-gray-100 text-gray-300'
              }`}
            >
              <FlipVertical size={14} />
              成组上下
            </button>
            <button
              type="button"
              onClick={() => handleCenterActiveSlot('horizontal')}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
            >
              <AlignCenterHorizontal size={14} />
              水平居中
            </button>
            <button
              type="button"
              onClick={() => handleCenterActiveSlot('vertical')}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
            >
              <AlignCenterVertical size={14} />
              垂直居中
            </button>
            <button
              type="button"
              onClick={() => handleRotate(designActiveSlot, -15)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/10 px-2 text-[10px] font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
            >
              <RotateCcw size={14} />
              左旋
            </button>
            <button
              type="button"
              onClick={() => handleRotate(designActiveSlot, 15)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/10 px-2 text-[10px] font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
            >
              <RotateCcw size={14} className="rotate-180" />
              右旋
            </button>
            <button
              type="button"
              onClick={() => handleScale(designActiveSlot, -0.1)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
            >
              <Minus size={14} />
              缩小
            </button>
            <button
              type="button"
              onClick={() => handleScale(designActiveSlot, 0.1)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-amber-100 px-2 text-[10px] font-bold text-amber-700 transition-all hover:bg-amber-200"
            >
              <Plus size={14} />
              放大
            </button>
            <button
              type="button"
              onClick={() => onRemoveSlot(designActiveSlot)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-red-100 px-2 text-[10px] font-bold text-red-600 transition-all hover:bg-red-200"
            >
              <Trash2 size={14} />
              删除
            </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface FreeLayoutSlotProps {
  idx: number;
  slot: ReadingSlotData;
  isActive: boolean;
  isSelected: boolean;
  selectedCount: number;
  canvasScale: number;
  canvasSize: { width: number; height: number };
  cardSlots: ReadingSlotData[];
  onSelectSlot: (idx: number, additive?: boolean, preserveSelection?: boolean) => void;
  onUpdateSlots: (slots: ReadingSlotData[]) => void;
  onMoveSlot: (idx: number, x: number, y: number, options?: { snap?: boolean; moveSelection?: boolean }) => void;
  snapEnabled: boolean;
  onUpdateAlignmentGuides: (guides: AlignmentGuide[]) => void;
}

const FreeLayoutSlot: React.FC<FreeLayoutSlotProps> = ({
  idx,
  slot,
  isActive,
  isSelected,
  selectedCount,
  canvasScale,
  canvasSize,
  cardSlots,
  onSelectSlot,
  onUpdateSlots,
  onMoveSlot,
  snapEnabled,
  onUpdateAlignmentGuides,
}) => {
  const dragStartTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<PointerDragState | null>(null);
  const dragPreviewRef = useRef<DragPosition | null>(null);
  const dragAlignedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const mouseDragCleanupRef = useRef<(() => void) | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPosition | null>(null);
  const scale = slot.scale || 1;

  const clearDragStartTimer = useCallback(() => {
    if (!dragStartTimerRef.current) return;

    window.clearTimeout(dragStartTimerRef.current);
    dragStartTimerRef.current = null;
  }, []);

  const updateDragPreview = useCallback((position: DragPosition | null) => {
    dragPreviewRef.current = position;
    setDragPreview(position);
  }, []);

  const suppressClickAfterDrag = useCallback(() => {
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, CLICK_SUPPRESS_MS);
  }, []);

  const clearMouseDragListeners = useCallback(() => {
    mouseDragCleanupRef.current?.();
    mouseDragCleanupRef.current = null;
  }, []);

  const startSlotDrag = useCallback(({
    additive,
    clientX,
    clientY,
    pointerId,
  }: {
    additive: boolean;
    clientX: number;
    clientY: number;
    pointerId: number;
  }) => {
    onSelectSlot(idx, additive, !additive && isSelected && selectedCount > 1);
    clearDragStartTimer();

    dragStateRef.current = {
      pointerId,
      startClientX: clientX,
      startClientY: clientY,
      startX: slot.x || 0,
      startY: slot.y || 0,
      moved: false,
      isDragging: false,
    };

    dragStartTimerRef.current = window.setTimeout(() => {
      if (dragStateRef.current?.pointerId !== pointerId) return;

      dragStateRef.current.isDragging = true;
      updateDragPreview({
        x: dragStateRef.current.startX,
        y: dragStateRef.current.startY,
      });

      if (window.navigator.vibrate) {
        window.navigator.vibrate(25);
      }
    }, DRAG_START_DELAY);
  }, [clearDragStartTimer, idx, isSelected, onSelectSlot, selectedCount, slot.x, slot.y, updateDragPreview]);

  const moveSlotDrag = useCallback((clientX: number, clientY: number, pointerId?: number) => {
    const dragState = dragStateRef.current;
    if (!dragState || (typeof pointerId === 'number' && dragState.pointerId !== pointerId)) return;

    const deltaX = (clientX - dragState.startClientX) / canvasScale;
    const deltaY = (clientY - dragState.startClientY) / canvasScale;

    if (!dragState.isDragging) {
      if (Math.hypot(deltaX, deltaY) < DRAG_MOVE_THRESHOLD) return;

      clearDragStartTimer();
      dragState.isDragging = true;
    }

    dragState.moved = true;
    const bounded = getBoundedFreeLayoutPosition({
      x: dragState.startX + deltaX,
      y: dragState.startY + deltaY,
      scale,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
    });
    const aligned = getAlignedFreeLayoutPosition({
      position: bounded,
      movingSlot: slot,
      otherSlots: cardSlots.filter((_, slotIndex) => slotIndex !== idx),
      snap: snapEnabled,
    });

    updateDragPreview(aligned.position);
    dragAlignedRef.current = aligned.guides.length > 0;
    onUpdateAlignmentGuides(aligned.guides);
  }, [canvasScale, canvasSize, cardSlots, clearDragStartTimer, idx, onUpdateAlignmentGuides, scale, slot, snapEnabled, updateDragPreview]);

  const finishSlotDrag = useCallback((pointerId?: number) => {
    const dragState = dragStateRef.current;
    if (!dragState || (typeof pointerId === 'number' && dragState.pointerId !== pointerId)) return;

    clearDragStartTimer();
    dragStateRef.current = null;

    if (!dragState.isDragging) return;

    const finalPosition = dragPreviewRef.current || {
      x: dragState.startX,
      y: dragState.startY,
    };
    onMoveSlot(idx, finalPosition.x, finalPosition.y, {
      snap: !dragAlignedRef.current,
      moveSelection: isSelected && selectedCount > 1,
    });
    dragAlignedRef.current = false;
    updateDragPreview(null);
    onUpdateAlignmentGuides([]);
    suppressClickAfterDrag();
  }, [clearDragStartTimer, idx, isSelected, onMoveSlot, onUpdateAlignmentGuides, selectedCount, suppressClickAfterDrag, updateDragPreview]);

  const attachDocumentMouseDrag = useCallback((pointerId: number) => {
    clearMouseDragListeners();

    const handleDocumentMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      moveSlotDrag(event.clientX, event.clientY, pointerId);
    };
    const handleDocumentMouseUp = (event: MouseEvent) => {
      event.preventDefault();
      clearMouseDragListeners();
      finishSlotDrag(pointerId);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    mouseDragCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [clearMouseDragListeners, finishSlotDrag, moveSlotDrag]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const pointerId = e.nativeEvent.pointerId;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    startSlotDrag({
      additive,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerId,
    });
    e.currentTarget.setPointerCapture?.(pointerId);
    if (e.nativeEvent.pointerType === 'mouse') {
      attachDocumentMouseDrag(pointerId);
    }
  }, [attachDocumentMouseDrag, startSlotDrag]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pointerId = e.nativeEvent.pointerId;
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== pointerId) return;

    e.stopPropagation();
    moveSlotDrag(e.clientX, e.clientY, pointerId);
  }, [moveSlotDrag]);

  const finishPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pointerId = e.nativeEvent.pointerId;
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== pointerId) return;

    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(pointerId);
    finishSlotDrag(pointerId);
  }, [finishSlotDrag]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    e.stopPropagation();
    const existingPointerId = dragStateRef.current?.pointerId;
    const pointerId = typeof existingPointerId === 'number' ? existingPointerId : -1;

    if (!dragStateRef.current) {
      startSlotDrag({
        additive: e.shiftKey || e.metaKey || e.ctrlKey,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId,
      });
    }

    attachDocumentMouseDrag(pointerId);
  }, [attachDocumentMouseDrag, startSlotDrag]);

  useEffect(() => () => {
    clearDragStartTimer();
    clearMouseDragListeners();
    if (suppressClickTimerRef.current) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
  }, [clearDragStartTimer, clearMouseDragListeners]);

  const currentX = dragPreview?.x ?? slot.x ?? 0;
  const currentY = dragPreview?.y ?? slot.y ?? 0;

  return (
    <motion.div
      data-testid={`free-layout-slot-${idx}`}
      className={`absolute select-none ${
        isActive ? 'z-20 cursor-grab active:cursor-grabbing' : 'z-10 cursor-pointer'
      }`}
      style={{
        left: currentX,
        top: currentY,
        width: FREE_LAYOUT_SLOT_WIDTH * scale,
        height: FREE_LAYOUT_SLOT_HEIGHT * scale,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (suppressClickRef.current) return;
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        onSelectSlot(idx, additive, !additive && isSelected && selectedCount > 1);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onMouseDown={handleMouseDown}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 50 }}
    >
      <div
        className={`w-full h-full rounded-xl flex flex-col items-center justify-between p-2 shadow-lg transition-all ${
          isActive
            ? 'bg-gradient-to-br from-forest-accent to-forest-pink text-white ring-2 ring-white'
            : isSelected
              ? 'bg-white text-forest-pink border-2 border-forest-pink/50 ring-2 ring-forest-pink/20'
            : 'bg-white text-forest-accent border-2 border-forest-accent/20 hover:border-forest-accent/40'
        }`}
        style={{
          transform: `rotate(${slot.rotation || 0}deg)`,
        }}
      >
        <span className={`font-black text-lg ${isActive ? 'text-white' : 'text-forest-ink'}`}>
          {idx + 1}
        </span>

        <input
          type="text"
          className={`w-full px-1 py-0.5 font-bold text-center bg-transparent border-none focus:ring-0 rounded text-[10px] ${
            isActive
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

        {isSelected && (
          <span className={`absolute -right-2 -top-2 rounded-full bg-white px-2 py-1 text-[8px] font-bold shadow ${
            isActive ? 'text-forest-accent' : 'text-forest-pink'
          }`}>
            {isActive ? '已选' : '同组'}
          </span>
        )}
      </div>

      {isSelected && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-forest-accent/80 px-2 py-0.5 text-[8px] text-white shadow">
          {(scale * 100).toFixed(0)}%
        </span>
      )}
    </motion.div>
  );
};
