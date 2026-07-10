import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Layers, User, MessageSquare, RotateCcw, BookOpen, X, Settings, Save, Hash, Orbit, Home, Wind, Info } from 'lucide-react';
import { CardKeywordMemory, SpreadDefinition, TarotCardMetadata, ReadingSlotData, TarotReading, ReadingFormData } from '../types';
import { LAYOUT_TEMPLATES, TAROT_CARDS, getCardImageUrl, OFFICIAL_SPREADS } from '../constants';
import { CardPicker } from './CardPicker';
import { FreeLayoutSaveMode, SpreadDesigner } from './SpreadDesigner';
import { CardCorrespondenceEditor } from './CardCorrespondenceEditor';
import { ReadingSlot } from './ReadingSlot';
import { FoldableSection } from './FoldableSection';
import { ReadingDetailView } from './ReadingDetailView';
import { ReadingSpreadDisplay } from './ReadingSpreadDisplay';
import { BasicInfoSection } from './BasicInfoSection';
import { ConfirmDialog } from './ConfirmDialog';
import { useLongPressClear } from '../hooks/useLongPressClear';
import { mapSlotsToSpread, normalizeInterpretationsForSlots } from '../lib/readingSlotSync';
import {
  addReadingSlot,
  applyGridSlotPositionClick,
  appendSlotHistory,
  moveReadingSlot,
  removeReadingSlot,
  selectCardForSlot,
  toggleSlotReversal,
  updateReadingSlotLabel,
} from '../lib/readingSlotOperations';
import {
  createBlankSlotsForSpread,
  createSpreadDefinitionFromSlots,
  getSafeCustomSpreadName,
  getUniqueSpreadName,
  restoreAllOfficialSpreads,
  restoreOfficialSpread,
  upsertSpreadDefinition,
} from '../lib/spreadPersistence';
import { centerGridSlots, shiftGridSlots } from '../lib/spreadGridLayout';
import { buildReadingSubmitPayload } from '../lib/readingSubmitPayload';
import { convertGridSlotsToFreeLayout, ensureFreeLayoutSlots } from '../lib/freeLayout';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface AddReadingFormProps {
  onSubmit: (data: Partial<ReadingFormData>) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  userId?: string;
  spreads: SpreadDefinition[];
  onUpdateSpreads: (spreads: SpreadDefinition[]) => void;
  cardMetadata: TarotCardMetadata[];
  cardKeywordMemory?: CardKeywordMemory[];
  onUpdateCardMetadata: (metadata: TarotCardMetadata[]) => void;
  initialData?: Partial<TarotReading>;
  onCancel?: () => void;
}

type InfluenceFieldKey = 'numerologyInfluence' | 'astrologyInfluence' | 'houseInfluence' | 'elementInfluence';

type SpreadSaveConflict = {
  name: string;
  spread: SpreadDefinition;
};

export const AddReadingForm: React.FC<AddReadingFormProps> = ({ 
  onSubmit, 
  isLoading, 
  isLoggedIn,
  userId,
  spreads, 
  onUpdateSpreads, 
  cardMetadata,
  cardKeywordMemory = [],
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
    numerologyInfluence: initialData?.interpretation?.numerologyInfluence || '',
    astrologyInfluence: initialData?.interpretation?.astrologyInfluence || '',
    houseInfluence: initialData?.interpretation?.houseInfluence || '',
    elementInfluence: initialData?.interpretation?.elementInfluence || '',
    isAnonymous: initialData?.isAnonymous || false,
    isPublic: initialData?.isPublic || false,
    isForClient: initialData?.isForClient || false,
    clientName: initialData?.clientName || '',
    clientFeedback: initialData?.clientFeedback || '',
    userFeedback: initialData?.userFeedback || '',
    readingDate: initialData?.readingDate ? new Date(initialData.readingDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    isTimePrecise: false,
    category: initialData?.category || '',
    skipAi: initialData?.skipAi !== undefined 
      ? initialData.skipAi 
      : (localStorage.getItem('tarot_ai_preference') === 'process' ? false : true)
  });

  const [cardInterpretations, setCardInterpretations] = useState<string[]>(initialData?.cardInterpretations || []);
  const [editingCorrespondence, setEditingCorrespondence] = useState<{ index: number; card: ReadingSlotData; metadata: TarotCardMetadata } | null>(null);
  const [cardSlots, setCardSlots] = useState<ReadingSlotData[]>(() => {
    if (initialData?.cards) {
      const restoredSlots = initialData.cards.map((c: ReadingSlotData, i: number) => ({
        ...c,
        label: initialData.slotLabels?.[i] || '',
        position: initialData.slotPositions?.[i] || c.position || '',
        isRotated: initialData.rotatedSlots?.includes(i) || c.isRotated || false,
      }));
      return initialData.layoutType === 'free' ? ensureFreeLayoutSlots(restoredSlots) : restoredSlots;
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
  const [showComboReading, setShowComboReading] = useState(false);
  const [expandInfluenceByDefault, setExpandInfluenceByDefault] = useState(() => (
    localStorage.getItem('tarot_influence_sections_open') === 'true'
  ));
  const [activeInfluenceKey, setActiveInfluenceKey] = useState<InfluenceFieldKey | null>(() => (
    localStorage.getItem('tarot_influence_sections_open') === 'true' ? 'numerologyInfluence' : null
  ));
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [gridCols, setGridCols] = useState(5);
  const [gridRows, setGridRows] = useState(5);
  const [freeLayoutSaveMode, setFreeLayoutSaveMode] = useState<FreeLayoutSaveMode>('original');
  const [showUpdatePrompt, setShowUpdatePrompt] = useState<{ name: string, oldSlots: string[] } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<{ name?: string } | null>(null);
  const [spreadSaveConflict, setSpreadSaveConflict] = useState<SpreadSaveConflict | null>(null);
  const [spreadNameNotice, setSpreadNameNotice] = useState('');
  const [submitNotice, setSubmitNotice] = useState('');
  const [pendingDeleteSpreadNames, setPendingDeleteSpreadNames] = useState<string[]>([]);
  const readingDetailRef = useRef<HTMLDivElement | null>(null);
  useBodyScrollLock(Boolean(showRestoreConfirm || spreadSaveConflict));

  const {
    isLongPressActive,
    clearLongPressActive,
    handleLongPressStart,
    handleLongPressEnd,
  } = useLongPressClear({ cardSlots, setCardSlots });

  const isDailyMode = formData.category === '日运';
  const isMultiCard = cardSlots.length > 1;
  const isOfficialSelectedSpread = OFFICIAL_SPREADS.some(spread => spread.name === formData.spread);
  const canAddSlot = !isOfficialSelectedSpread;
  const influenceFields = [
    {
      key: 'numerologyInfluence',
      icon: Hash,
      title: '🔢 灵数影响',
      subtitle: '数字、重复数字、阶段感和成长课题。',
      placeholder: '这组牌里的数字在提醒什么节奏、阶段或课题...',
    },
    {
      key: 'astrologyInfluence',
      icon: Orbit,
      title: '🪐 行星星座影响',
      subtitle: '行星和星座带来的驱动力、情绪气质与关系模式。',
      placeholder: '行星或星座让这次解读呈现出什么气质和动力...',
    },
    {
      key: 'houseInfluence',
      icon: Home,
      title: '🏛️ 宫位影响',
      subtitle: '宫位提示主题落在哪个现实场景或经验领域。',
      placeholder: '这次主题更像落在哪个生活领域、关系位置或现实场景...',
    },
    {
      key: 'elementInfluence',
      icon: Wind,
      title: '🌿 元素影响',
      subtitle: '火、水、风、土在行动、感受、思考和现实层面的比例。',
      placeholder: '火水风土哪一种更强，分别带来什么推动或失衡...',
    },
  ] as const;

  const handleToggleInfluenceDefault = (checked: boolean) => {
    localStorage.setItem('tarot_influence_sections_open', String(checked));
    setExpandInfluenceByDefault(checked);
    setActiveInfluenceKey(checked ? 'numerologyInfluence' : null);
  };
  const activeInfluenceField = influenceFields.find(field => field.key === activeInfluenceKey);
  const hasInfluenceValues = influenceFields.some(field => formData[field.key]?.trim());
  const shouldShowInfluenceTools = expandInfluenceByDefault || activeInfluenceKey !== null || hasInfluenceValues;
  const scrollFocusedFieldIntoView = (event: React.FocusEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = event.currentTarget;

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 120);
  };
  const scrollReadingDetailIntoView = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const detailTop = readingDetailRef.current?.getBoundingClientRect().top;
    if (detailTop === undefined) return;

    window.scrollTo({
      top: Math.max(0, window.scrollY + detailTop - 96),
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    if (isDailyMode && !initialData) {
      setFormData(prev => ({
        ...prev,
        spread: '单牌阵',
        category: '日运',
        layoutType: 'horizontal'
      }));
      setCardSlots([{ name: '', isReversed: false, label: '今日日运' }]);
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
    
    const newSlots = mapSlotsToSpread(cardSlots, spreadDef);
    
    if (JSON.stringify(newSlots) !== JSON.stringify(cardSlots)) {
      setCardSlots(newSlots);
      setActiveSlotIndex(0);
      // Initialize interpretations if needed
      if (cardInterpretations.length !== newSlots.length) {
        setCardInterpretations(normalizeInterpretationsForSlots(cardInterpretations, newSlots.length));
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
      clearLongPressActive();
      return;
    }
    setActiveSlotIndex(index);
    setShowPicker(true);
  };

  const updateCardSlotsWithHistory = (newSlots: typeof cardSlots) => {
    setHistory(prev => appendSlotHistory(prev, cardSlots));
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
    const newSlots = selectCardForSlot(cardSlots, activeSlotIndex, card.name, isReversed);
    if (newSlots !== cardSlots) {
      updateCardSlotsWithHistory(newSlots);
    }
    setShowPicker(false);
    window.setTimeout(scrollReadingDetailIntoView, 260);
  };

  const toggleReverse = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSlots = toggleSlotReversal(cardSlots, index);
    if (newSlots !== cardSlots) {
      updateCardSlotsWithHistory(newSlots);
    }
  };

  const addSlot = () => {
    if (!canAddSlot) return;
    updateCardSlotsWithHistory(addReadingSlot(cardSlots));
  };
  
  const removeSlot = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSlots = removeReadingSlot(cardSlots, index);
    if (newSlots !== cardSlots) {
      updateCardSlotsWithHistory(newSlots);
    }
  };

  const requestDeleteSpread = (spreadName: string) => {
    if (!spreadName || OFFICIAL_SPREADS.some(spread => spread.name === spreadName)) return;

    setPendingDeleteSpreadNames([spreadName]);
  };

  const requestDeleteSpreads = (spreadNames: string[]) => {
    const safeNames = spreadNames.filter(name => (
      name && !OFFICIAL_SPREADS.some(spread => spread.name === name)
    ));

    if (safeNames.length === 0) return;
    setPendingDeleteSpreadNames(Array.from(new Set(safeNames)));
  };

  const confirmDeleteSpread = () => {
    if (pendingDeleteSpreadNames.length === 0) return;

    const deleteNameSet = new Set(pendingDeleteSpreadNames);
    const updatedSpreads = spreads.filter(s => !deleteNameSet.has(s.name));
    const fallbackSpread = updatedSpreads[0] || OFFICIAL_SPREADS[0];

    onUpdateSpreads(updatedSpreads);
    if (deleteNameSet.has(formData.spread) && fallbackSpread) {
      setFormData(prev => ({ ...prev, spread: fallbackSpread.name, layoutType: fallbackSpread.layout }));
      setCardSlots(createBlankSlotsForSpread(fallbackSpread));
      setGridCols(fallbackSpread.gridCols || 5);
      setGridRows(fallbackSpread.gridRows || 5);
      setNewSpreadName('');
      setDesignActiveSlot(0);
      setIsEditingSession(false);
    }
    setPendingDeleteSpreadNames([]);
  };

  const completeSpreadSave = (
    newSpread: SpreadDefinition,
    options: { replaceCurrentCustom?: boolean } = { replaceCurrentCustom: true },
  ) => {
    const isRenamingCurrentCustomSpread = Boolean(
      options.replaceCurrentCustom !== false
      &&
      isEditingSession
      && formData.spread
      && formData.spread !== newSpread.name
      && !OFFICIAL_SPREADS.some(spread => spread.name === formData.spread),
    );
    const sourceSpreads = isRenamingCurrentCustomSpread
      ? spreads.filter(spread => spread.name !== formData.spread)
      : spreads;
    const updatedSpreads = upsertSpreadDefinition(sourceSpreads, newSpread);
    
    onUpdateSpreads(updatedSpreads);
    setFormData(prev => ({ ...prev, spread: newSpread.name, layoutType: newSpread.layout }));
    setCardSlots(mapSlotsToSpread(cardSlots, newSpread));
    setGridCols(newSpread.gridCols || gridCols);
    setGridRows(newSpread.gridRows || gridRows);
    setNewSpreadName('');
    setSpreadNameNotice('');
    setSpreadSaveConflict(null);
    setSaveSuccess(true);
    setIsEditingSession(false);
    setShowSpreadManager(false);
  };

  const buildSpreadDefinition = (name: string) => createSpreadDefinitionFromSlots({
    name,
    layout: formData.layoutType,
    slots: cardSlots,
    gridCols,
    gridRows,
    freeLayoutSaveMode,
  });

  const saveSpread = () => {
    const requestedName = newSpreadName.trim();
    if (!requestedName) {
      setSpreadNameNotice('先给这个牌阵起个名字，再保存。');
      return;
    }

    const name = getSafeCustomSpreadName(formData.spread, requestedName, OFFICIAL_SPREADS);
    if (!name) return;

    const newSpread = buildSpreadDefinition(name);
    const isEditingSameCustomSpread = Boolean(
      formData.spread
      && formData.spread === name
      && !OFFICIAL_SPREADS.some(spread => spread.name === name),
    );
    const hasNameConflict = spreads.some(spread => spread.name === name) && !isEditingSameCustomSpread;

    if (hasNameConflict) {
      setSpreadSaveConflict({ name, spread: newSpread });
      return;
    }

    completeSpreadSave(newSpread);
  };

  const saveSpreadAsCopy = () => {
    if (!spreadSaveConflict) return;

    completeSpreadSave({
      ...spreadSaveConflict.spread,
      name: getUniqueSpreadName(spreadSaveConflict.name, spreads, OFFICIAL_SPREADS),
    }, { replaceCurrentCustom: false });
  };

  const restoreDefaults = (name?: string) => {
    let updatedSpreads;
    if (name && typeof name === 'string') {
      const { spreads: restoredSpreads, official } = restoreOfficialSpread(spreads, OFFICIAL_SPREADS, name);
      if (!official) return;
      updatedSpreads = restoredSpreads;
      
      if (formData.spread === name) {
        setFormData(prev => ({ ...prev, layoutType: official.layout }));
        setCardSlots(createBlankSlotsForSpread(official));
      }
    } else {
      updatedSpreads = restoreAllOfficialSpreads(spreads, OFFICIAL_SPREADS);
      const officialNames = OFFICIAL_SPREADS.map(os => os.name);
      
      if (officialNames.includes(formData.spread)) {
        const restored = OFFICIAL_SPREADS.find(os => os.name === formData.spread) || OFFICIAL_SPREADS[0];
        setFormData(prev => ({ ...prev, spread: restored.name, layoutType: restored.layout }));
        setCardSlots(createBlankSlotsForSpread(restored));
      }
    }
    
    onUpdateSpreads(updatedSpreads);
    setSaveSuccess(true);
    setShowRestoreConfirm(null);
  };

  const updateSlotPosition = (col: number, row: number) => {
    const result = applyGridSlotPositionClick(cardSlots, designActiveSlot, col, row, formData.layoutType);

    if (result.shouldConvertHorizontalLayout) {
      setFormData(prev => ({ ...prev, layoutType: 'custom' }));
    }

    if (result.changed) {
      updateCardSlotsWithHistory(result.slots);
    }

    setDesignActiveSlot(result.activeSlotIndex);
  };

  const swapSlotIndex = (oldIndex: number, newIndex: number) => {
    const newSlots = moveReadingSlot(cardSlots, oldIndex, newIndex);
    if (newSlots === cardSlots) return;
    updateCardSlotsWithHistory(newSlots);
    setDesignActiveSlot(newIndex);
  };

  const updateSlotLabel = (index: number, label: string) => {
    const newSlots = updateReadingSlotLabel(cardSlots, index, label);
    if (newSlots !== cardSlots) {
      setCardSlots(newSlots); // Label updates might be too frequent for history, or we can debounce it. For now, just set.
    }
  };

  const handleOpenSpreadManager = () => {
    const currentSpreadDef = spreads.find(spread => spread.name === formData.spread);
    const isCurrentOfficial = OFFICIAL_SPREADS.some(spread => spread.name === formData.spread);

    if (currentSpreadDef) {
      setGridCols(currentSpreadDef.gridCols || gridCols || 5);
      setGridRows(currentSpreadDef.gridRows || gridRows || 5);
      setNewSpreadName(isCurrentOfficial ? `${currentSpreadDef.name} (自定义)` : currentSpreadDef.name);
      setDesignActiveSlot(cardSlots.length > 0 ? 0 : -1);
      setShowSpreadManager(true);
      setIsEditingSession(!isCurrentOfficial);
      return;
    }

    setFormData(prev => ({ ...prev, spread: '', layoutType: 'free' }));
    setCardSlots([]);
    setGridCols(20);
    setGridRows(12);
    setNewSpreadName('');
    setDesignActiveSlot(-1);
    setShowSpreadManager(true);
    setIsEditingSession(true);
  };

  const handleSpreadSelection = (spreadDef: SpreadDefinition) => {
    setFormData(prev => ({ ...prev, spread: spreadDef.name, layoutType: spreadDef.layout }));
    setGridCols(spreadDef.gridCols || 5);
    setGridRows(spreadDef.gridRows || 5);
    
    const nextSlots = mapSlotsToSpread(cardSlots, spreadDef);
    setCardSlots(spreadDef.layout === 'free' ? ensureFreeLayoutSlots(nextSlots) : nextSlots);
  };

  const shiftSlots = (dx: number, dy: number) => {
    const newSlots = shiftGridSlots(cardSlots, dx, dy, gridCols, gridRows);
    updateCardSlotsWithHistory(newSlots);
    setIsEditingSession(true);
  };

  const centerSpread = () => {
    const newSlots = centerGridSlots(cardSlots, gridCols, gridRows);
    if (newSlots === cardSlots) return;

    updateCardSlotsWithHistory(newSlots);
    setIsEditingSession(true);
  };

  const handleCreateNewSpread = () => {
    setFormData(prev => ({ ...prev, spread: '', layoutType: 'free' }));
    setCardSlots([]);
    setGridCols(20);
    setGridRows(12);
    setNewSpreadName('');
    setShowSpreadManager(true);
    setIsEditingSession(true);
    setDesignActiveSlot(-1);
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

    const result = buildReadingSubmitPayload({
      formData,
      cardSlots,
      cardInterpretations,
    });

    if (result.ok === false) {
      setSubmitNotice(result.notice);
      return;
    }

    setSubmitNotice('');
    onSubmit(result.payload);
  };

  const currentTemplate = LAYOUT_TEMPLATES[formData.layoutType] || LAYOUT_TEMPLATES.horizontal;
  const itemClasses = currentTemplate.itemClasses;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-forest-border bg-white p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] shadow-sm sm:space-y-8 sm:rounded-3xl sm:p-10">
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
            <span>已保存，当前手记正在使用这个牌阵</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestoreConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm overscroll-contain">
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
                  className="flex-1 min-h-11 py-2 bg-forest-bg text-forest-muted rounded-xl font-medium hover:bg-forest-accent/5 transition-all"
                >
                  取消
                </button>
                <button 
                  type="button"
                  onClick={() => restoreDefaults(showRestoreConfirm.name)}
                  className="flex-1 min-h-11 py-2 bg-forest-accent text-white rounded-xl font-medium hover:bg-forest-accent/90 transition-all shadow-md"
                >
                  确定恢复
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {spreadSaveConflict && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-forest-accent">
                <Layers size={24} />
                <h3 className="text-xl font-serif">牌阵名称已存在</h3>
              </div>
              <p className="text-sm text-forest-muted leading-relaxed">
                “{spreadSaveConflict.name}”已经存在。你可以覆盖原牌阵，或另存为一个副本。
              </p>
              <div className="grid gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveSpreadAsCopy}
                  className="min-h-11 rounded-xl bg-forest-accent text-white font-bold hover:bg-forest-accent/90 transition-all shadow-md"
                >
                  另存为副本
                </button>
                <button
                  type="button"
                  onClick={() => completeSpreadSave(spreadSaveConflict.spread)}
                  className="min-h-11 rounded-xl bg-amber-100 text-amber-700 font-bold hover:bg-amber-200 transition-all"
                >
                  覆盖原牌阵
                </button>
                <button
                  type="button"
                  onClick={() => setSpreadSaveConflict(null)}
                  className="min-h-11 rounded-xl bg-forest-bg text-forest-muted font-bold hover:text-forest-accent transition-colors"
                >
                  取消
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
        onCreateSpread={handleCreateNewSpread}
        isMultiCard={isMultiCard}
        activeSlotIndex={activeSlotIndex}
        onSetActiveSlotIndex={setActiveSlotIndex}
        cardSlots={cardSlots}
        onAddSlot={addSlot}
        canAddSlot={canAddSlot}
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
              freeLayoutSaveMode={freeLayoutSaveMode}
              onUpdateFreeLayoutSaveMode={setFreeLayoutSaveMode}
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
                const nextSlots = mapSlotsToSpread([], s);
                setCardSlots(s.layout === 'free' ? ensureFreeLayoutSlots(nextSlots) : nextSlots);
                setIsEditingSession(false);
              }}
              onStartNewSession={handleCreateNewSpread}
              onClose={() => setShowSpreadManager(false)}
              onDeleteSpread={requestDeleteSpread}
              onDeleteSpreads={requestDeleteSpreads}
              onSaveSpread={saveSpread}
              onUpdateNewSpreadName={(name) => {
                setNewSpreadName(name);
                setSpreadNameNotice('');
              }}
              saveNotice={spreadNameNotice}
              onShiftSlots={shiftSlots}
              onCenterSpread={centerSpread}
              onUpdateLayoutType={(layout) => {
                setFormData(prev => ({ ...prev, layoutType: layout }));
                const isOfficial = OFFICIAL_SPREADS.some(os => os.name === formData.spread);
                if (isOfficial && !newSpreadName) {
                  setNewSpreadName(`${formData.spread} (自定义)`);
                }
                setIsEditingSession(true);
                const spreadDef = spreads.find(s => s.name === formData.spread);
                if (spreadDef?.gridCols && spreadDef?.gridRows) {
                  setGridCols(spreadDef.gridCols);
                  setGridRows(spreadDef.gridRows);
                } else {
                  setGridCols(5);
                  setGridRows(5);
                }
                if (layout === 'free') {
                  setCardSlots(prev => (
                    prev.length > 0
                      ? convertGridSlotsToFreeLayout(prev, formData.layoutType)
                      : ensureFreeLayoutSlots([{ name: '', isReversed: false, label: '位置1' }])
                  ));
                  setDesignActiveSlot(0);
                  return;
                }
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
              onUpdateSlots={(slots) => {
                updateCardSlotsWithHistory(slots);
                setIsEditingSession(true);
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

      <ConfirmDialog
        isOpen={pendingDeleteSpreadNames.length > 0}
        title={pendingDeleteSpreadNames.length > 1 ? '批量删除自定义牌阵' : '删除自定义牌阵'}
        message={
          pendingDeleteSpreadNames.length > 1
            ? `确定要删除这 ${pendingDeleteSpreadNames.length} 个自定义牌阵吗？已经保存的抽牌手记不会被删除，但之后不能再从列表里选择这些牌阵。`
            : `确定要删除“${pendingDeleteSpreadNames[0] || ''}”吗？已经保存的抽牌手记不会被删除，但之后不能再从列表里选择这个牌阵。`
        }
        confirmText="删除"
        cancelText="取消"
        destructive
        onConfirm={confirmDeleteSpread}
        onClose={() => setPendingDeleteSpreadNames([])}
      />

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
        removeSlot={removeSlot}
        allowSlotRemoval={false}
        handleCycleSlot={handleCycleSlot}
        onConfirmSync={(name) => {
          const spreadDef = spreads.find(s => s.name === name);
          if (spreadDef) {
            const nextSlots = mapSlotsToSpread(cardSlots, spreadDef);
            setCardSlots(spreadDef.layout === 'free' ? ensureFreeLayoutSlots(nextSlots) : nextSlots);
          }
          setShowUpdatePrompt(null);
        }}
        onCancelSync={() => setShowUpdatePrompt(null)}
      />


      {/* Card Metadata & Main Display */}
      <div ref={readingDetailRef} className="scroll-mt-24">
        <ReadingDetailView
          activeSlotIndex={activeSlotIndex}
          cardSlots={cardSlots}
          cardMetadata={cardMetadata}
          cardKeywordMemory={cardKeywordMemory}
          cardInterpretations={cardInterpretations}
          question={formData.question}
          spread={formData.spread}
          category={formData.category}
          combinationContext={formData.combination}
          isLoggedIn={isLoggedIn}
          userId={userId}
          isMultiCard={isMultiCard}
          isDailyMode={isDailyMode}
          onToggleReverse={toggleReverse}
          onSetCardInterpretations={setCardInterpretations}
          onSetActiveSlotIndex={setActiveSlotIndex}
          onSetShowPicker={setShowPicker}
          onUpdateCardSlotsWithHistory={updateCardSlotsWithHistory}
        />
      </div>

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

      <div className="space-y-2.5 rounded-2xl border border-forest-accent/5 bg-forest-accent/[0.03] p-2.5 sm:space-y-3 sm:p-0 sm:border-0 sm:bg-transparent">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <p className="text-xs font-bold text-forest-accent">补充解读视角（可选）</p>
            <p className="mt-0.5 hidden text-[10px] text-forest-muted sm:block">灵数、星座、宫位、元素，需要时再补充。</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveInfluenceKey(shouldShowInfluenceTools ? null : 'numerologyInfluence')}
              className="min-h-10 rounded-xl bg-white px-3 text-[11px] font-bold text-forest-accent shadow-sm ring-1 ring-forest-accent/10 transition-colors hover:bg-forest-accent/5 sm:hidden"
            >
              {shouldShowInfluenceTools ? '收起' : '展开'}
            </button>
            <label className={`${shouldShowInfluenceTools ? 'flex' : 'hidden sm:flex'} min-h-10 items-center gap-1.5 rounded-xl px-1.5 text-[10px] font-bold text-forest-muted transition-colors hover:bg-forest-accent/5`}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-forest-accent"
                checked={expandInfluenceByDefault}
                onChange={e => handleToggleInfluenceDefault(e.target.checked)}
              />
              <span>默认展开</span>
            </label>
          </div>
        </div>
        {shouldShowInfluenceTools && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {influenceFields.map(field => {
              const isActive = activeInfluenceKey === field.key;
              const hasValue = !!formData[field.key]?.trim();

              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => setActiveInfluenceKey(isActive ? null : field.key)}
                  className={`min-h-11 rounded-xl border px-2 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all sm:min-h-12 sm:px-3 sm:py-2 sm:text-xs ${
                    isActive
                      ? 'bg-forest-accent text-white border-forest-accent shadow-sm'
                      : 'bg-white text-forest-accent border-forest-accent/5 hover:bg-forest-accent/10'
                  }`}
                >
                  <span>{field.title}</span>
                  {hasValue && <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-forest-accent'}`} />}
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeInfluenceField && (
            <motion.div
              key={activeInfluenceField.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl bg-forest-accent/5 border border-forest-accent/5 p-4 space-y-3"
            >
              <div className="flex items-start gap-2">
                {React.createElement(activeInfluenceField.icon, { size: 16, className: 'text-forest-accent mt-0.5' })}
                <div>
                  <p className="text-sm font-bold text-forest-accent">{activeInfluenceField.title}</p>
                  <p className="text-[10px] text-forest-muted mt-1">{activeInfluenceField.subtitle}</p>
                </div>
              </div>
              <textarea
                rows={4}
                className="w-full px-4 py-3 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder={activeInfluenceField.placeholder}
                value={formData[activeInfluenceField.key]}
                onFocus={scrollFocusedFieldIntoView}
                onChange={e => setFormData({ ...formData, [activeInfluenceField.key]: e.target.value })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {formData.isForClient && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-forest-accent/5 bg-forest-accent/5 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-forest-accent flex items-center gap-2 px-1"><User size={14} /> 客户姓名</label>
            <input className="w-full px-4 py-2 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm" placeholder="输入客户称呼..." value={formData.clientName} onFocus={scrollFocusedFieldIntoView} onChange={e => setFormData({...formData, clientName: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-forest-accent flex items-center gap-2 px-1"><MessageSquare size={14} /> 客户反馈</label>
            <input className="w-full px-4 py-2 bg-white border border-forest-accent/5 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm" placeholder="客户的真实反馈..." value={formData.clientFeedback} onFocus={scrollFocusedFieldIntoView} onChange={e => setFormData({...formData, clientFeedback: e.target.value})} />
          </div>
        </div>
      )}

      {submitNotice && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {submitNotice}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-accent px-4 py-3 font-bold text-white shadow-lg transition-all hover:bg-forest-accent/90 active:scale-[0.98] disabled:opacity-50 sm:min-h-14 sm:gap-3 sm:py-5"
      >
        {isLoading ? (
          <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Sparkles size={20} /></motion.div> 灵光引路中...</>
        ) : (
          <>
            {isLoggedIn ? <BookOpen size={22} /> : <Save size={22} />}
            <span className="text-base sm:text-lg">
              {initialData ? (isLoggedIn ? '📖 保存修改' : '💾 保存修改') : (isLoggedIn ? '📖 录入灵见手帖' : '💾 保存到本地')}
            </span>
          </>
        )}
      </button>

      <div className="space-y-3 sm:space-y-4">
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
            onFocus={scrollFocusedFieldIntoView}
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
          <div className="mt-4 rounded-2xl border border-forest-accent/10 bg-forest-accent/5 px-4 py-3 text-xs leading-relaxed text-forest-muted">
            <p className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-forest-accent" />
              <span>
                参与 AI 深度解析后，系统会尝试识别牌名、整理关键词和提供灵感线索，帮助你复盘；它不会替你发布内容，也不会代替你的最终判断。
              </span>
            </p>
          </div>
        </FoldableSection>
      </div>
      
      {/* Spacing */}
      <div className="h-4" />
    </form>
  );
};
