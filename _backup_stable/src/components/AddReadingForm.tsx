import React, { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Sparkles, Layers, ChevronDown, ImageIcon, User, MessageSquare, RotateCcw, FileText, BookOpen, X, Calendar, Tag, Settings, Save } from 'lucide-react';
import { SpreadDefinition, TarotCardMetadata, ReadingSlotData } from '../types';
import { LAYOUT_TEMPLATES, TAROT_CARDS, getCardImageUrl, OFFICIAL_SPREADS } from '../constants';
import { CardPicker } from './CardPicker';
import { SpreadDesigner } from './SpreadDesigner';
import { CardCorrespondenceEditor } from './CardCorrespondenceEditor';
import { ReadingSlot } from './ReadingSlot';
import { FoldableSection } from './FoldableSection';
import { ReadingDetailView } from './ReadingDetailView';
import { ReadingSpreadDisplay } from './ReadingSpreadDisplay';
import { BasicInfoSection } from './BasicInfoSection';
import { useCardNumerology } from '../hooks/useCardNumerology';

interface AddReadingFormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  userId?: string;
  spreads: SpreadDefinition[];
  onUpdateSpreads: (spreads: SpreadDefinition[]) => void;
  cardMetadata: TarotCardMetadata[];
  onUpdateCardMetadata: (metadata: TarotCardMetadata[]) => void;
  initialData?: any;
  onCancel?: () => void;
}

export const AddReadingForm: React.FC<AddReadingFormProps> = ({ 
  onSubmit, 
  isLoading, 
  isLoggedIn,
  userId,
  spreads, 
  onUpdateSpreads, 
  cardMetadata,
  onUpdateCardMetadata,
  initialData, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    question: initialData?.question || '',
    spread: initialData?.spread || '单牌阵',
    layoutType: initialData?.layoutType || 'horizontal',
    cardInput: '',
    singleCard: initialData?.interpretation?.singleCard || '',
    combination: initialData?.interpretation?.combination || '',
    isAnonymous: initialData?.isAnonymous || false,
    isPublic: initialData?.isPublic || false,
    isForClient: initialData?.isForClient || false,
    clientName: initialData?.clientName || '',
    clientFeedback: initialData?.clientFeedback || '',
    userFeedback: initialData?.userFeedback || '',
    readingDate: initialData?.readingDate ? new Date(initialData.readingDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    isTimePrecise: initialData?.isTimePrecise !== undefined ? initialData.isTimePrecise : false,
    category: initialData?.category || '',
    skipAi: initialData?.skipAi !== undefined 
      ? initialData.skipAi 
      : (localStorage.getItem('tarot_ai_preference') === 'process' ? false : true)
  });

  const [cardInterpretations, setCardInterpretations] = useState<string[]>(initialData?.cardInterpretations || []);
  const [editingCorrespondence, setEditingCorrespondence] = useState<{ index: number; card: any; metadata: TarotCardMetadata } | null>(null);
  const [cardSlots, setCardSlots] = useState<ReadingSlotData[]>(() => {
    if (initialData?.cards) {
      return initialData.cards.map((c: any, i: number) => ({
        ...c,
        label: initialData.slotLabels?.[i] || '',
        position: initialData.slotPositions?.[i] || '',
        isRotated: initialData.rotatedSlots?.includes(i) || false
      }));
    }
    return [{ name: '', isReversed: false }];
  });
  const [history, setHistory] = useState<ReadingSlotData[][]>([]);
  const [showSpreadManager, setShowSpreadManager] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [newSpreadName, setNewSpreadName] = useState('');
  const [designActiveSlot, setDesignActiveSlot] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSlotNumbers, setShowSlotNumbers] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCompReading, setShowCompReading] = useState(false);
  const [showComboReading, setShowComboReading] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [gridCols, setGridCols] = useState(5);
  const [gridRows, setGridRows] = useState(5);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState<{ name: string, oldSlots: string[] } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<{ name?: string } | null>(null);

  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);

  const isDailyMode = formData.category === '日运';
  const isMultiCard = cardSlots.length > 1;

  useEffect(() => {
    if (isDailyMode && !initialData) {
      setFormData(prev => ({
        ...prev,
        spread: '单牌阵',
        category: '日运',
        layoutType: 'horizontal'
      }));
      setCardSlots([{ name: '', isReversed: false, label: '今日运势' }]);
    } else if (!isDailyMode && formData.spread === '单牌阵' && !initialData) {
      setCardSlots([{ name: '', isReversed: false, label: '单牌解读' }]);
    }
  }, [isDailyMode, formData.spread]);

  // Track spread changes to prompt for re-ordering
  useEffect(() => {
    const currentSpreadDef = spreads.find(s => s.name === formData.spread);
    if (!currentSpreadDef) return;

    // Check if the spread definition in 'spreads' is different from our current 'cardSlots' labels
    const currentLabels = cardSlots.map(s => s.label);
    const hasLabelsChanged = JSON.stringify(currentSpreadDef.slots) !== JSON.stringify(currentLabels);
    
    // If labels changed and we have cards picked, show prompt
    const hasPickedCards = cardSlots.some(s => s.name);
    if (hasLabelsChanged && hasPickedCards && !showUpdatePrompt) {
      setShowUpdatePrompt({ name: formData.spread, oldSlots: currentLabels });
    }
  }, [spreads]);

  // Sync card slots when spread changes
  useEffect(() => {
    const spreadDef = spreads.find(s => s.name === formData.spread);
    if (!spreadDef) return;

    setFormData(prev => ({ ...prev, layoutType: spreadDef.layout }));
    setGridCols(spreadDef.gridCols || 5);
    setGridRows(spreadDef.gridRows || 5);
    
    const newSlots = spreadDef.slots.map((label, i) => ({
      name: cardSlots[i]?.name || '',
      isReversed: cardSlots[i]?.isReversed || false,
      position: spreadDef.slotPositions?.[i] || '',
      label: label,
      isRotated: spreadDef.rotatedSlots?.includes(i) || false
    }));
    
    if (JSON.stringify(newSlots) !== JSON.stringify(cardSlots)) {
      setCardSlots(newSlots);
      setActiveSlotIndex(0);
      // Initialize interpretations if needed
      if (cardInterpretations.length !== newSlots.length) {
        const newInterps = [...cardInterpretations];
        while (newInterps.length < newSlots.length) newInterps.push('');
        setCardInterpretations(newInterps.slice(0, newSlots.length));
      }
    }
  }, [formData.spread, spreads]);

  // Save success notification timer
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

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
    setHistory(prev => [...prev, cardSlots].slice(-20)); // Keep last 20 steps
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
    const newSlots = [...cardSlots];
    newSlots[activeSlotIndex] = { ...newSlots[activeSlotIndex], name: card.name, isReversed };
    updateCardSlotsWithHistory(newSlots);
    setShowPicker(false);
  };

  const toggleReverse = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSlots = [...cardSlots];
    newSlots[index] = { ...newSlots[index], isReversed: !newSlots[index].isReversed };
    updateCardSlotsWithHistory(newSlots);
  };

  const addSlot = () => {
    const newSlots = [...cardSlots, { name: '', isReversed: false, label: `第${cardSlots.length + 1}张` }];
    updateCardSlotsWithHistory(newSlots);
  };
  
  const removeSlot = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardSlots.length > 1) {
      const newSlots = cardSlots.filter((_, i) => i !== index);
      updateCardSlotsWithHistory(newSlots);
    }
  };

  const deleteSpread = (spreadName: string) => {
    onUpdateSpreads(spreads.filter(s => s.name !== spreadName));
  };

  const saveSpread = () => {
    const isOfficial = OFFICIAL_SPREADS.some(os => os.name === formData.spread);
    const suggestedName = isOfficial ? `${formData.spread} (自定义)` : formData.spread;
    const name = newSpreadName.trim() || suggestedName;
    if (!name) return;
    
    // Safety check: if user hasn't changed the name from an official one, and is saving, 
    // we should make sure they don't overwrite the original unless they really want to.
    // However, the findIndex logic already handles replacing by name.
    // To prevent the "Official Spreads Changed" confusion, we'll avoid overwriting 
    // official names if we started from a "Create New" session or if the name matches an official one exactly but definitions differ.
    
    const newSpread: SpreadDefinition = {
      name,
      layout: formData.layoutType,
      slots: cardSlots.map((s, i) => s.label || `第${i+1}张`),
      slotPositions: cardSlots.map(s => s.position || ''),
      rotatedSlots: cardSlots.map((s, i) => s.isRotated ? i : -1).filter(i => i !== -1),
      gridCols: gridCols,
      gridRows: gridRows
    };

    const existingIndex = spreads.findIndex(s => s.name === name);
    let updatedSpreads;
    if (existingIndex !== -1) {
      updatedSpreads = [...spreads];
      updatedSpreads[existingIndex] = newSpread;
    } else {
      updatedSpreads = [...spreads, newSpread];
    }
    
    onUpdateSpreads(updatedSpreads);
    setFormData(prev => ({ ...prev, spread: name }));
    setNewSpreadName('');
    setSaveSuccess(true);
    setIsEditingSession(false);
  };

  const restoreDefaults = (name?: string) => {
    let updatedSpreads;
    if (name && typeof name === 'string') {
      const official = OFFICIAL_SPREADS.find(os => os.name === name);
      if (!official) return;
      updatedSpreads = spreads.map(s => s.name === name ? official : s);
      
      if (formData.spread === name) {
        setFormData(prev => ({ ...prev, layoutType: official.layout }));
        setCardSlots(official.slots.map((label, i) => ({ 
          name: '', 
          isReversed: false, 
          position: official.slotPositions?.[i] || '', 
          label,
          isRotated: official.rotatedSlots?.includes(i) || false
        })));
      }
    } else {
      const officialNames = OFFICIAL_SPREADS.map(os => os.name);
      const customSpreads = spreads.filter(s => !officialNames.includes(s.name));
      updatedSpreads = [...OFFICIAL_SPREADS, ...customSpreads];
      
      if (officialNames.includes(formData.spread)) {
        const restored = OFFICIAL_SPREADS.find(os => os.name === formData.spread) || OFFICIAL_SPREADS[0];
        setFormData(prev => ({ ...prev, spread: restored.name, layoutType: restored.layout }));
        setCardSlots(restored.slots.map((label, i) => ({ 
          name: '', 
          isReversed: false, 
          position: restored.slotPositions?.[i] || '', 
          label,
          isRotated: restored.rotatedSlots?.includes(i) || false
        })));
      }
    }
    
    onUpdateSpreads(updatedSpreads);
    setSaveSuccess(true);
    setShowRestoreConfirm(null);
  };

  const updateSlotPosition = (col: number, row: number) => {
    const posStr = `col-start-${col} row-start-${row}`;
    const slotsAtPos = cardSlots.map((s, i) => s.position === posStr ? i : -1).filter(i => i !== -1);
    
    if (slotsAtPos.length > 0) {
      const isActiveAtPos = slotsAtPos.includes(designActiveSlot);
      if (isActiveAtPos) {
        // If clicking the already active slot
        if (slotsAtPos.length === 1) {
          // If only one slot here, add a second one (stacking)
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
          // If multiple slots, cycle through them
          const currentLocalIdx = slotsAtPos.indexOf(designActiveSlot);
          const nextLocalIdx = (currentLocalIdx + 1) % slotsAtPos.length;
          setDesignActiveSlot(slotsAtPos[nextLocalIdx]);
        }
      } else {
        // Select the first slot at this position
        setDesignActiveSlot(slotsAtPos[0]);
      }
    } else {
      // Add new slot logic
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
      setCardSlots(newSlots); // Label updates might be too frequent for history, or we can debounce it. For now, just set.
    }
  };

  const handleOpenSpreadManager = () => {
    setShowSpreadManager(true);
    setIsEditingSession(false);
  };

  const handleSpreadSelection = (spreadDef: SpreadDefinition) => {
    setFormData(prev => ({ ...prev, spread: spreadDef.name, layoutType: spreadDef.layout }));
    setGridCols(spreadDef.gridCols || 5);
    setGridRows(spreadDef.gridRows || 5);
    
    setCardSlots(spreadDef.slots.map((label, i) => ({
      name: cardSlots[i]?.name || '',
      isReversed: cardSlots[i]?.isReversed || false,
      position: spreadDef.slotPositions?.[i] || '',
      label,
      isRotated: spreadDef.rotatedSlots?.includes(i) || false
    })));
  };

  const shiftSlots = (dx: number, dy: number) => {
    const newSlots = cardSlots.map(slot => {
      if (!slot.position) return slot;
      const match = slot.position.match(/col-start-(\d+) row-start-(\d+)/);
      if (!match) return slot;
      
      const newCol = Math.max(1, Math.min(gridCols, parseInt(match[1]) + dx));
      const newRow = Math.max(1, Math.min(gridRows, parseInt(match[2]) + dy));
      
      return {
        ...slot,
        position: `col-start-${newCol} row-start-${newRow}`
      };
    });
    updateCardSlotsWithHistory(newSlots);
    setIsEditingSession(true);
  };

  const centerSpread = () => {
    if (cardSlots.length === 0) return;
    
    let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
    
    cardSlots.forEach(slot => {
      if (!slot.position) return;
      const match = slot.position.match(/col-start-(\d+) row-start-(\d+)/);
      if (match) {
        const c = parseInt(match[1]);
        const r = parseInt(match[2]);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
      }
    });
    
    if (minCol === Infinity) return;
    
    const contentWidth = maxCol - minCol + 1;
    const contentHeight = maxRow - minRow + 1;
    
    const targetMinCol = Math.floor((gridCols - contentWidth) / 2) + 1;
    const targetMinRow = Math.floor((gridRows - contentHeight) / 2) + 1;
    
    const dx = targetMinCol - minCol;
    const dy = targetMinRow - minRow;
    
    if (dx === 0 && dy === 0) return;
    
    shiftSlots(dx, dy);
  };

  const handleCreateNewSpread = () => {
    setFormData(prev => ({ ...prev, spread: '自定义牌阵', layoutType: 'custom' }));
    setCardSlots([{ name: '', isReversed: false, label: '位置 1', position: 'col-start-3 row-start-3' }]);
    setGridCols(5);
    setGridRows(5);
    setNewSpreadName('我的新牌阵');
    setShowSpreadManager(true);
    setIsEditingSession(true);
    setDesignActiveSlot(0);
  };

  const handleCycleSlot = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const slot = cardSlots[index];
    const pos = slot.position || LAYOUT_TEMPLATES[formData.layoutType]?.itemClasses[index] || '';
    const slotsAtPos = cardSlots.map((s, i) => ({ ...s, idx: i }))
      .filter(s => (s.position || LAYOUT_TEMPLATES[formData.layoutType]?.itemClasses[s.idx] || '') === pos);
    
    if (slotsAtPos.length > 1) {
      const currentInStackIdx = slotsAtPos.findIndex(s => s.idx === index);
      const nextInStackIdx = (currentInStackIdx + 1) % slotsAtPos.length;
      setActiveSlotIndex(slotsAtPos[nextInStackIdx].idx);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const { singleCard, combination, readingDate, ...rest } = formData;
    
    // In daily mode or single card spread, combination is not required
    const finalCombination = (isDailyMode || formData.spread === '单牌阵') ? (cardInterpretations[0] || '') : combination;

    onSubmit({ 
      ...rest, 
      date: new Date().toISOString(),
      readingDate: new Date(readingDate).toISOString(),
      interpretation: { singleCard, combination: finalCombination },
      cards: cardSlots.filter(s => s.name),
      slotLabels: cardSlots.map(s => s.label || ''),
      slotPositions: cardSlots.map(s => s.position || ''),
      rotatedSlots: cardSlots.map((s, i) => s.isRotated ? i : -1).filter(i => i !== -1),
      cardInterpretations: cardInterpretations
    });
  };

  const currentTemplate = LAYOUT_TEMPLATES[formData.layoutType] || LAYOUT_TEMPLATES.horizontal;
  const itemClasses = currentTemplate.itemClasses;

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-forest-border space-y-8">
      {editingCorrespondence && (
        <CardCorrespondenceEditor 
          card={editingCorrespondence.card}
          metadata={editingCorrespondence.metadata}
          onUpdate={(updated) => {
            const newMetadata = [...cardMetadata];
            const idx = newMetadata.findIndex(m => m.id === updated.id);
            if (idx !== -1) {
              newMetadata[idx] = updated;
              onUpdateCardMetadata(newMetadata);
            }
          }}
          onClose={() => setEditingCorrespondence(null)}
        />
      )}

      {showPicker && (
        <CardPicker 
          onSelect={handleCardSelect} 
          onClose={() => setShowPicker(false)} 
          excludeCards={cardSlots
            .filter((_, i) => i !== activeSlotIndex) // Don't exclude the card in the current slot
            .map(s => s.name)
            .filter(Boolean)
          }
        />
      )}
      
      <AnimatePresence>
        {saveSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold"
          >
            <Sparkles size={18} />
            <span>牌阵保存成功！</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestoreConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-forest-accent">
                <RotateCcw size={24} />
                <h3 className="text-xl font-serif">恢复默认设置</h3>
              </div>
              <p className="text-sm text-forest-muted leading-relaxed">
                {showRestoreConfirm.name 
                  ? `确定要将“${showRestoreConfirm.name}”恢复到官方默认设置吗？这将覆盖您对此牌阵的所有修改。`
                  : "确定要恢复所有官方牌阵到默认设置吗？这将覆盖您对官方牌阵的所有修改。"}
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowRestoreConfirm(null)}
                  className="flex-1 py-2 bg-forest-bg text-forest-muted rounded-xl font-medium hover:bg-forest-accent/5 transition-all"
                >
                  取消
                </button>
                <button 
                  type="button"
                  onClick={() => restoreDefaults(showRestoreConfirm.name)}
                  className="flex-1 py-2 bg-forest-accent text-white rounded-xl font-medium hover:bg-forest-accent/90 transition-all shadow-md"
                >
                  确定恢复
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Basic Info Section */}
      <BasicInfoSection 
        question={formData.question}
        onUpdateQuestion={v => setFormData({...formData, question: v})}
        category={formData.category}
        onUpdateCategory={v => setFormData({...formData, category: v})}
        date={formData.readingDate.split('T')[0]}
        onUpdateDate={v => setFormData({...formData, readingDate: v})}
        spread={formData.spread}
        spreads={spreads}
        onSelectSpread={handleSpreadSelection}
        onOpenSpreadManager={handleOpenSpreadManager}
        isMultiCard={isMultiCard}
        activeSlotIndex={activeSlotIndex}
        onSetActiveSlotIndex={setActiveSlotIndex}
        cardSlots={cardSlots}
        onAddSlot={addSlot}
        isDailyMode={isDailyMode}
        isForClient={formData.isForClient}
        onToggleClientMode={() => setFormData({...formData, isForClient: !formData.isForClient})}
        initialData={initialData}
        onCancel={onCancel}
      />


      <AnimatePresence>
        {showSpreadManager && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SpreadDesigner 
              spreads={spreads}
              currentSpread={formData.spread}
              layoutType={formData.layoutType}
              cardSlots={cardSlots}
              designActiveSlot={designActiveSlot}
              newSpreadName={newSpreadName}
              isEditingSession={isEditingSession}
              gridRows={gridRows}
              onUpdateGrid={(cols, rows) => {
                setGridCols(cols);
                setGridRows(rows);
                setIsEditingSession(true);
              }}
              gridCols={gridCols}
              onSelectSpread={(s) => {
                setFormData(prev => ({ ...prev, spread: s.name, layoutType: s.layout }));
                setGridCols(s.gridCols || 5);
                setGridRows(s.gridRows || 5);
                setCardSlots(s.slots.map((label, i) => ({ 
                  name: '', 
                  isReversed: false, 
                  position: s.slotPositions?.[i] || '', 
                  label,
                  isRotated: s.rotatedSlots?.includes(i) || false
                })));
                setIsEditingSession(false);
              }}
              onStartNewSession={handleCreateNewSpread}
              onClose={() => setShowSpreadManager(false)}
              onDeleteSpread={deleteSpread}
              onSaveSpread={saveSpread}
              onUpdateNewSpreadName={setNewSpreadName}
              onShiftSlots={shiftSlots}
              onCenterSpread={centerSpread}
              onUpdateLayoutType={(layout) => {
                setFormData(prev => ({ ...prev, layoutType: layout }));
                const isOfficial = OFFICIAL_SPREADS.some(os => os.name === formData.spread);
                if (isOfficial && !newSpreadName) {
                  setNewSpreadName(`${formData.spread} (自定义)`);
                }
                setIsEditingSession(true);
                setGridCols(5);
                setGridRows(5);
                const template = LAYOUT_TEMPLATES[layout];
                if (template) {
                  setCardSlots(template.defaultSlots.map((label, i) => ({
                    name: '',
                    isReversed: false,
                    position: template.itemClasses[i] || '',
                    label
                  })));
                  setDesignActiveSlot(0);
                }
              }}
              onUpdateSlotPosition={(col, row) => {
                updateSlotPosition(col, row);
                const isOfficial = OFFICIAL_SPREADS.some(os => os.name === formData.spread);
                if (isOfficial && !newSpreadName) {
                   setNewSpreadName(`${formData.spread} (自定义)`);
                }
                setIsEditingSession(true);
              }}
              onSwapSlotIndex={(oldIdx, newIdx) => {
                swapSlotIndex(oldIdx, newIdx);
                setIsEditingSession(true);
              }}
              onUpdateSlotLabel={(idx, label) => {
                updateSlotLabel(idx, label);
                setIsEditingSession(true);
              }}
              onSetDesignActiveSlot={setDesignActiveSlot}
              onRemoveSlot={(index) => {
                if (cardSlots.length > 1) {
                  const newSlots = cardSlots.filter((_, i) => i !== index);
                  updateCardSlotsWithHistory(newSlots);
                  setDesignActiveSlot(Math.max(0, newSlots.length - 1));
                  setIsEditingSession(true);
                }
              }}
              onRestoreDefaults={(name) => {
                setShowRestoreConfirm({ name });
              }}
              canUndo={history.length > 0}
              onUndo={undo}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ReadingSpreadDisplay 
        formData={formData}
        cardSlots={cardSlots}
        activeSlotIndex={activeSlotIndex}
        showSlotNumbers={showSlotNumbers}
        gridCols={gridCols}
        itemClasses={itemClasses}
        currentTemplate={currentTemplate}
        showUpdatePrompt={showUpdatePrompt}
        spreads={spreads}
        onSlotClick={handleSlotClick}
        handleLongPressStart={handleLongPressStart}
        handleLongPressEnd={handleLongPressEnd}
        toggleReverse={toggleReverse}
        removeSlot={removeSlot}
        handleCycleSlot={handleCycleSlot}
        onConfirmSync={(name) => {
          const spreadDef = spreads.find(s => s.name === name);
          if (spreadDef) {
            const newSlots = spreadDef.slots.map((label, i) => ({
              name: cardSlots[i]?.name || '',
              isReversed: cardSlots[i]?.isReversed || false,
              position: spreadDef.slotPositions?.[i] || '',
              label: label
            }));
            setCardSlots(newSlots);
          }
          setShowUpdatePrompt(null);
        }}
        onCancelSync={() => setShowUpdatePrompt(null)}
      />


      {/* Card Metadata & Main Display */}
      <ReadingDetailView 
        activeSlotIndex={activeSlotIndex}
        cardSlots={cardSlots}
        cardMetadata={cardMetadata}
        cardInterpretations={cardInterpretations}
        isLoggedIn={isLoggedIn}
        userId={userId}
        isMultiCard={isMultiCard}
        isDailyMode={isDailyMode}
        showCompReading={showCompReading}
        compReadingValue={formData.singleCard}
        onToggleReverse={toggleReverse}
        onSetCardInterpretations={setCardInterpretations}
        onSetActiveSlotIndex={setActiveSlotIndex}
        onSetShowPicker={setShowPicker}
        onUpdateCardSlotsWithHistory={updateCardSlotsWithHistory}
        onToggleShowCompReading={() => setShowCompReading(!showCompReading)}
        onSetCompReadingValue={val => setFormData({...formData, singleCard: val})}
      />

      {isMultiCard && (
        <FoldableSection 
          icon={Layers} 
          title="🔗 组合解读（可选）" 
          isOpen={showComboReading} 
          onToggle={() => setShowComboReading(!showComboReading)}
          subtitle="探索牌与牌之间的化学反应与整体意象"
        >
          <textarea 
            rows={4} 
            className="w-full px-4 py-3 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm" 
            placeholder="牌与牌之间的整体关联感悟..." 
            value={formData.combination} 
            onChange={e => setFormData({...formData, combination: e.target.value})} 
          />
        </FoldableSection>
      )}

      <div className="space-y-4">
        {formData.isForClient && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-forest-accent/5 rounded-2xl border border-forest-accent/5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-forest-accent flex items-center gap-2 px-1"><User size={14} /> 客户姓名</label>
              <input className="w-full px-4 py-2 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm" placeholder="输入客户称呼..." value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-forest-accent flex items-center gap-2 px-1"><MessageSquare size={14} /> 客户反馈</label>
              <input className="w-full px-4 py-2 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm" placeholder="客户的真实反馈..." value={formData.clientFeedback} onChange={e => setFormData({...formData, clientFeedback: e.target.value})} />
            </div>
          </div>
        )}

        <FoldableSection 
          icon={MessageSquare} 
          title="📌 添加复盘（可选）" 
          isOpen={showFeedback} 
          onToggle={() => setShowFeedback(!showFeedback)}
        >
          <textarea 
            rows={4} 
            className="w-full px-4 py-3 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm" 
            placeholder="记录你对这次占卜的自我评价或后续验证..." 
            value={formData.userFeedback} 
            onChange={e => setFormData({...formData, userFeedback: e.target.value})} 
          />
        </FoldableSection>

        <FoldableSection 
          icon={Settings} 
          title="⚙️ 高级选项" 
          isOpen={showAdvanced} 
          onToggle={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-forest-muted group">
              <input type="checkbox" className="accent-forest-accent w-4 h-4" checked={formData.isPublic} onChange={e => setFormData({...formData, isPublic: e.target.checked})} /> 
              <span className="group-hover:text-forest-accent transition-colors">公开到研习广场</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-forest-muted group">
              <input type="checkbox" className="accent-forest-accent w-4 h-4" checked={formData.isAnonymous} onChange={e => setFormData({...formData, isAnonymous: e.target.checked})} /> 
              <span className="group-hover:text-forest-accent transition-colors">匿名研习</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-forest-accent group text-nowrap">
              <input type="checkbox" className="accent-forest-accent w-4 h-4" checked={!formData.skipAi} onChange={e => {
                const willProcess = e.target.checked;
                setFormData({...formData, skipAi: !willProcess});
                localStorage.setItem('tarot_ai_preference', willProcess ? 'process' : 'skip');
              }} /> 
              <span className="group-hover:scale-105 transition-transform">参与AI深度解析</span>
            </label>
          </div>
        </FoldableSection>
      </div>

      <button 
        type="submit" 
        disabled={isLoading} 
        className="w-full py-5 bg-forest-accent text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all hover:bg-forest-accent/90 disabled:opacity-50"
      >
        {isLoading ? (
          <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Sparkles size={20} /></motion.div> 灵光引路中...</>
        ) : (
          <>
            {isLoggedIn ? <BookOpen size={22} /> : <Save size={22} />}
            <span className="text-lg">
              {initialData ? (isLoggedIn ? '📖 保存修改' : '💾 保存修改') : (isLoggedIn ? '📖 录入灵见手帖' : '💾 保存到本地')}
            </span>
          </>
        )}
      </button>
      
      {/* Spacing */}
      <div className="h-4" />
    </form>
  );
};
