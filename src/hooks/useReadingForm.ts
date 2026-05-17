import React, { useState, useEffect } from 'react';
import { SpreadDefinition } from '../types';
import { LAYOUT_TEMPLATES, TAROT_CARDS } from '../constants';

export function useReadingForm(spreads: SpreadDefinition[], onUpdateSpreads: (spreads: SpreadDefinition[]) => void) {
  const [formData, setFormData] = useState({
    question: '',
    spread: '单牌阵',
    layoutType: 'horizontal',
    cardInput: '',
    singleCard: '',
    combination: '',
    summary: '',
    isAnonymous: false,
    isPublic: false,
    isForClient: false,
    clientName: '',
    clientFeedback: '',
    userFeedback: ''
  });

  const [cardSlots, setCardSlots] = useState<Array<{ name: string; isReversed: boolean; position?: string; label?: string }>>([{ name: '', isReversed: false }]);
  const [history, setHistory] = useState<Array<typeof cardSlots>>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [showSpreadManager, setShowSpreadManager] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [newSpreadName, setNewSpreadName] = useState('');
  const [designActiveSlot, setDesignActiveSlot] = useState(0);

  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);

  useEffect(() => {
    const spreadDef = spreads.find(s => s.name === formData.spread);
    if (spreadDef) {
      setFormData(prev => ({ ...prev, layoutType: spreadDef.layout }));
      if (!cardSlots.some(s => s.name)) {
        setCardSlots(spreadDef.slots.map((label, i) => ({ 
          name: '', 
          isReversed: false,
          position: spreadDef.slotPositions?.[i] || '',
          label: label
        })));
      }
    }
  }, [formData.spread, spreads]);

  const handleSlotClick = (index: number) => {
    if (isLongPressActive) {
      setIsLongPressActive(false);
      return;
    }
    setActiveSlotIndex(index);
    setShowPicker(true);
  };

  const handleLongPressStart = (index: number) => {
    setIsLongPressActive(false);
    const timer = setTimeout(() => {
      const newSlots = [...cardSlots];
      if (newSlots[index].name) {
        newSlots[index] = { ...newSlots[index], name: '', isReversed: false };
        setCardSlots(newSlots);
        setIsLongPressActive(true);
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }
      setLongPressTimer(null);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const updateCardSlotsWithHistory = (newSlots: typeof cardSlots) => {
    setHistory(prev => [...prev, cardSlots].slice(-20));
    setCardSlots(newSlots);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCardSlots(previous);
    setDesignActiveSlot(Math.max(0, Math.min(designActiveSlot, previous.length - 1)));
  };

  const handleCardSelect = (card: typeof TAROT_CARDS[0], isReversed: boolean) => {
    if (activeSlotIndex === null) return;
    const newSlots = [...cardSlots];
    newSlots[activeSlotIndex] = { ...newSlots[activeSlotIndex], name: card.name, isReversed };
    setCardSlots(newSlots);
    setShowPicker(false);
    setActiveSlotIndex(null);
  };

  const toggleReverse = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSlots = [...cardSlots];
    newSlots[index].isReversed = !newSlots[index].isReversed;
    setCardSlots(newSlots);
  };

  const addSlot = () => setCardSlots([...cardSlots, { name: '', isReversed: false }]);
  
  const removeSlot = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardSlots.length > 1) {
      setCardSlots(cardSlots.filter((_, i) => i !== index));
    }
  };

  const deleteSpread = (spreadName: string) => {
    onUpdateSpreads(spreads.filter(s => s.name !== spreadName));
  };

  const saveAsNewSpread = () => {
    const name = newSpreadName.trim();
    if (!name) return;
    if (spreads.some(s => s.name === name)) {
      alert('牌阵名称已存在');
      return;
    }
    const newSpread: SpreadDefinition = {
      name,
      layout: formData.layoutType,
      slots: cardSlots.map((s, i) => s.label || `第${i+1}张`),
      slotPositions: cardSlots.map(s => s.position || '')
    };
    onUpdateSpreads([...spreads, newSpread]);
    setFormData(prev => ({ ...prev, spread: name }));
    setNewSpreadName('');
    setShowSpreadManager(false);
  };

  const updateSlotPosition = (col: number, row: number) => {
    const posStr = `col-start-${col} row-start-${row}`;
    const slotsAtPos = cardSlots.map((s, i) => s.position === posStr ? i : -1).filter(i => i !== -1);
    
    if (slotsAtPos.length > 0) {
      const isActiveAtPos = slotsAtPos.includes(designActiveSlot);
      if (isActiveAtPos) {
        if (slotsAtPos.length === 1) {
          const newSlots = [...cardSlots];
          newSlots.push({ 
            name: '', 
            isReversed: false, 
            position: posStr, 
            label: `叠放牌 ${newSlots.length + 1}` 
          });
          updateCardSlotsWithHistory(newSlots);
          setDesignActiveSlot(newSlots.length - 1);
        } else {
          const currentLocalIdx = slotsAtPos.indexOf(designActiveSlot);
          const nextLocalIdx = (currentLocalIdx + 1) % slotsAtPos.length;
          setDesignActiveSlot(slotsAtPos[nextLocalIdx]);
        }
      } else {
        setDesignActiveSlot(slotsAtPos[0]);
      }
    } else {
      if (formData.layoutType === 'horizontal') {
        setFormData(prev => ({ ...prev, layoutType: 'custom' }));
      }
      const newSlots = [...cardSlots];
      if (newSlots.length === 0) {
        newSlots.push({ name: '', isReversed: false, position: posStr, label: '牌 1' });
      } else if (newSlots.length === 1 && !newSlots[0].position) {
        newSlots[0].position = posStr;
        newSlots[0].label = '牌 1';
      } else {
        newSlots.push({ name: '', isReversed: false, position: posStr, label: `牌 ${newSlots.length + 1}` });
      }
      updateCardSlotsWithHistory(newSlots);
      setDesignActiveSlot(newSlots.length - 1);
    }
  };

  const swapSlotIndex = (oldIndex: number, newIndex: number) => {
    if (newIndex < 0 || newIndex >= cardSlots.length) return;
    const newSlots = [...cardSlots];
    const temp = newSlots[oldIndex];
    newSlots[oldIndex] = newSlots[newIndex];
    newSlots[newIndex] = temp;
    updateCardSlotsWithHistory(newSlots);
    setDesignActiveSlot(newIndex);
  };

  const updateSlotLabel = (index: number, label: string) => {
    const newSlots = [...cardSlots];
    if (newSlots[index]) {
      newSlots[index].label = label;
      setCardSlots(newSlots);
    }
  };

  return {
    formData,
    setFormData,
    cardSlots,
    setCardSlots,
    history,
    activeSlotIndex,
    setActiveSlotIndex,
    showSpreadManager,
    setShowSpreadManager,
    showPicker,
    setShowPicker,
    newSpreadName,
    setNewSpreadName,
    designActiveSlot,
    setDesignActiveSlot,
    handleSlotClick,
    handleLongPressStart,
    handleLongPressEnd,
    handleCardSelect,
    toggleReverse,
    addSlot,
    removeSlot,
    deleteSpread,
    saveAsNewSpread,
    updateSlotPosition,
    swapSlotIndex,
    updateSlotLabel,
    undo
  };
}
