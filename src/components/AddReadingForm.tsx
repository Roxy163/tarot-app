import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Layers, User, MessageSquare, RotateCcw, BookOpen, Settings, Save, Hash, Orbit, Home, Wind, Info, Copy } from 'lucide-react';
import { CardKeywordMemory, SpreadDefinition, TarotCardMetadata, ReadingSlotData, TarotReading, ReadingFormData } from '../types';
import { LAYOUT_TEMPLATES, TAROT_CARDS, OFFICIAL_SPREADS } from '../constants';
import { CardPicker } from './CardPicker';
import { FreeLayoutSaveMode, SpreadDesigner } from './SpreadDesigner';
import { CardCorrespondenceEditor } from './CardCorrespondenceEditor';
import { FoldableSection } from './FoldableSection';
import { ReadingDetailView } from './ReadingDetailView';
import { ReadingSpreadDisplay } from './ReadingSpreadDisplay';
import { BasicInfoSection } from './BasicInfoSection';
import { ConfirmDialog } from './ConfirmDialog';
import { QuickSpreadButtons } from './QuickSpreadButtons';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
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
import {
  ReadingRequiredFieldIssue,
  buildReadingSubmitPayload,
  getReadingRequiredFieldIssue,
} from '../lib/readingSubmitPayload';
import { convertGridSlotsToFreeLayout, ensureFreeLayoutSlots } from '../lib/freeLayout';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ReadingAiPromptMode, buildReadingAiPrompt, getGentleAiPromptNotice } from '../lib/readingAiPrompt';

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

type SpreadManagerDraftBackup = {
  spread: string;
  layoutType: string;
  cardSlots: ReadingSlotData[];
  history: ReadingSlotData[][];
  gridCols: number;
  gridRows: number;
  freeLayoutSaveMode: FreeLayoutSaveMode;
  newSpreadName: string;
  designActiveSlot: number;
  activeSlotIndex: number;
  isEditingSession: boolean;
};

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
    numerologyInfluence: initialData?.interpretation?.numerologyInfluence || '',
    astrologyInfluence: initialData?.interpretation?.astrologyInfluence || '',
    houseInfluence: initialData?.interpretation?.houseInfluence || '',
    elementInfluence: initialData?.interpretation?.elementInfluence || '',
    isAnonymous: Boolean(initialData?.isPublic && initialData?.isAnonymous),
    isPublic: initialData?.isPublic || false,
    isForClient: initialData?.isForClient || false,
    clientName: initialData?.clientName || '',
    clientFeedback: initialData?.clientFeedback || '',
    userFeedback: initialData?.userFeedback || '',
    choicePathA: initialData?.choicePathA || '',
    choicePathB: initialData?.choicePathB || '',
    readingDate: initialData?.readingDate ? new Date(initialData.readingDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    isTimePrecise: false,
    category: initialData?.category || initialData?.manualTags?.join('、') || '',
    skipAi: initialData?.skipAi !== undefined 
      ? initialData.skipAi 
      : (localStorage.getItem('tarot_ai_preference') === 'process' ? false : true)
  });

  const [cardInterpretations, setCardInterpretations] = useState<string[]>(initialData?.cardInterpretations || []);
  const [cardQuestions, setCardQuestions] = useState<string[]>(initialData?.cardQuestions || []);
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
  const showSlotNumbers = true;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPromptMode, setAiPromptMode] = useState<ReadingAiPromptMode>('mentor');
  const [aiPromptNotice, setAiPromptNotice] = useState('');
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
  const [submitIssue, setSubmitIssue] = useState<ReadingRequiredFieldIssue | null>(null);
  const [pendingDeleteSpreadNames, setPendingDeleteSpreadNames] = useState<string[]>([]);
  const readingDetailRef = useRef<HTMLDivElement | null>(null);
  const spreadManagerDraftBackupRef = useRef<SpreadManagerDraftBackup | null>(null);
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
  const toFreeEditorSlots = (slots: ReadingSlotData[], layout: string) => (
    ensureFreeLayoutSlots(layout === 'free' ? slots : convertGridSlotsToFreeLayout(slots, layout))
  );
  const captureSpreadManagerDraftBackup = () => {
    if (spreadManagerDraftBackupRef.current) return;

    spreadManagerDraftBackupRef.current = {
      spread: formData.spread,
      layoutType: formData.layoutType,
      cardSlots,
      history,
      gridCols,
      gridRows,
      freeLayoutSaveMode,
      newSpreadName,
      designActiveSlot,
      activeSlotIndex,
      isEditingSession,
    };
  };

  const clearSpreadManagerDraftBackup = () => {
    spreadManagerDraftBackupRef.current = null;
  };

  const handleCancelSpreadManager = () => {
    const backup = spreadManagerDraftBackupRef.current;

    if (backup) {
      setFormData(prev => ({
        ...prev,
        spread: backup.spread,
        layoutType: backup.layoutType,
      }));
      setCardSlots(backup.cardSlots);
      setHistory(backup.history);
      setGridCols(backup.gridCols);
      setGridRows(backup.gridRows);
      setFreeLayoutSaveMode(backup.freeLayoutSaveMode);
      setNewSpreadName(backup.newSpreadName);
      setDesignActiveSlot(backup.designActiveSlot);
      setActiveSlotIndex(backup.activeSlotIndex);
      setIsEditingSession(backup.isEditingSession);
    }

    setSpreadNameNotice('');
    setSpreadSaveConflict(null);
    setShowRestoreConfirm(null);
    clearSpreadManagerDraftBackup();
    setShowSpreadManager(false);
  };
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
  const scrollRequiredIssueIntoView = (issue: ReadingRequiredFieldIssue) => {
    if (issue.slotIndex !== undefined && issue.slotIndex >= 0 && issue.slotIndex < cardSlots.length) {
      setActiveSlotIndex(issue.slotIndex);
    }

    if (typeof window === 'undefined' || window.innerWidth >= 768) return;

    window.setTimeout(() => {
      if (issue.field === 'cardInterpretation') {
        scrollReadingDetailIntoView();
        return;
      }

      const selector = issue.field === 'cards'
        ? '[data-required-field="cards"]'
        : `[data-required-field="${issue.field}"]`;
      const target = document.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 80);
  };
  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) throw new Error('Copy command failed');
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
      if (cardQuestions.length !== newSlots.length) {
        setCardQuestions(normalizeInterpretationsForSlots(cardQuestions, newSlots.length));
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
    clearSpreadManagerDraftBackup();
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
        const restoredSlots = createBlankSlotsForSpread(official);

        if (showSpreadManager) {
          setFormData(prev => ({ ...prev, layoutType: 'free' }));
          setGridCols(20);
          setGridRows(12);
          setFreeLayoutSaveMode('original');
          setCardSlots(toFreeEditorSlots(restoredSlots, official.layout));
        } else {
          setFormData(prev => ({ ...prev, layoutType: official.layout }));
          setCardSlots(restoredSlots);
        }
      }
    } else {
      updatedSpreads = restoreAllOfficialSpreads(spreads, OFFICIAL_SPREADS);
      const officialNames = OFFICIAL_SPREADS.map(os => os.name);
      
      if (officialNames.includes(formData.spread)) {
        const restored = OFFICIAL_SPREADS.find(os => os.name === formData.spread) || OFFICIAL_SPREADS[0];
        const restoredSlots = createBlankSlotsForSpread(restored);

        if (showSpreadManager) {
          setFormData(prev => ({ ...prev, spread: restored.name, layoutType: 'free' }));
          setGridCols(20);
          setGridRows(12);
          setFreeLayoutSaveMode('original');
          setCardSlots(toFreeEditorSlots(restoredSlots, restored.layout));
        } else {
          setFormData(prev => ({ ...prev, spread: restored.name, layoutType: restored.layout }));
          setCardSlots(restoredSlots);
        }
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
    captureSpreadManagerDraftBackup();

    const currentSpreadDef = spreads.find(spread => spread.name === formData.spread);
    const isCurrentOfficial = OFFICIAL_SPREADS.some(spread => spread.name === formData.spread);

    if (currentSpreadDef) {
      const sourceSlots = cardSlots.length > 0 ? cardSlots : createBlankSlotsForSpread(currentSpreadDef);
      const editorSlots = toFreeEditorSlots(sourceSlots, formData.layoutType || currentSpreadDef.layout);

      setFormData(prev => ({ ...prev, layoutType: 'free' }));
      setCardSlots(editorSlots);
      setGridCols(20);
      setGridRows(12);
      setFreeLayoutSaveMode('original');
      setNewSpreadName(isCurrentOfficial ? `${currentSpreadDef.name} (自定义)` : currentSpreadDef.name);
      setDesignActiveSlot(editorSlots.length > 0 ? 0 : -1);
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

  const handleQuickThemeSelect = (spreadName: string, category?: string) => {
    const spreadDef = spreads.find(item => item.name === spreadName);

    if (spreadDef) {
      setFormData(prev => ({
        ...prev,
        spread: spreadDef.name,
        layoutType: spreadDef.layout,
        category: category || prev.category,
      }));
      setGridCols(spreadDef.gridCols || 5);
      setGridRows(spreadDef.gridRows || 5);
      const nextSlots = mapSlotsToSpread(cardSlots, spreadDef);
      setCardSlots(spreadDef.layout === 'free' ? ensureFreeLayoutSlots(nextSlots) : nextSlots);
      setActiveSlotIndex(0);
      return;
    }

    setFormData(prev => ({ ...prev, category: category || prev.category }));
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
    captureSpreadManagerDraftBackup();

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

    const requiredIssue = getReadingRequiredFieldIssue({
      formData,
      cardSlots,
      cardInterpretations,
    });

    if (requiredIssue) {
      setSubmitIssue(requiredIssue);
      setSubmitNotice(requiredIssue.notice);
      scrollRequiredIssueIntoView(requiredIssue);
      return;
    }

    const result = buildReadingSubmitPayload({
      formData,
      cardSlots,
      cardInterpretations,
      cardQuestions,
    });

    if (result.ok === false) {
      setSubmitNotice(result.notice);
      setSubmitIssue(null);
      return;
    }

    setSubmitNotice('');
    setSubmitIssue(null);
    onSubmit(result.payload);
  };

  const handlePublicShareToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isPublic: checked,
      isAnonymous: false,
    }));
  };

  const handleAnonymousShareToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isPublic: checked,
      isAnonymous: checked,
    }));
  };

  useEffect(() => {
    if (aiPromptNotice) setAiPromptNotice('');
  }, [
    formData.question,
    formData.spread,
    formData.isForClient,
    formData.clientName,
    formData.choicePathA,
    formData.choicePathB,
    cardSlots,
    cardInterpretations,
    cardQuestions,
  ]);

  useEffect(() => {
    if (!submitNotice && !submitIssue) return;
    setSubmitNotice('');
    setSubmitIssue(null);
  }, [formData.question, formData.spread, formData.isForClient, formData.clientName, cardSlots, cardInterpretations]);

  const currentTemplate = LAYOUT_TEMPLATES[formData.layoutType] || LAYOUT_TEMPLATES.horizontal;
  const itemClasses = currentTemplate.itemClasses;
  const shouldShowChoicePathFields = formData.layoutType === 'choice'
    || formData.spread.includes('选择')
    || cardSlots.some(slot => /^[ABＡＢ]/i.test((slot.label || '').trim()));
  const aiPromptResult = buildReadingAiPrompt({ formData, cardSlots, cardInterpretations, cardQuestions, mode: aiPromptMode });
  const canGenerateAiPrompt = aiPromptResult.ok === true;
  const aiPromptText = aiPromptResult.ok === true ? aiPromptResult.prompt : '';
  const aiPromptModeMeta = aiPromptMode === 'mentor'
    ? {
        label: '导师复盘',
        buttonText: '生成导师提示词',
        description: '带上你的逐牌解读，让 AI 帮你校准、补充。',
        note: '这版会包含你的逐牌解读、疑问和复盘材料，适合学习校准。',
      }
    : {
        label: '咨询解牌',
        buttonText: '生成咨询提示词',
        description: '只给问题、牌阵和牌面，让 AI 像接咨询一样直解。',
        note: '这版不包含你的个人解读，只整理咨询问题和牌阵结果。',
      };
  const handleAiPromptModeChange = (mode: ReadingAiPromptMode) => {
    setAiPromptMode(mode);
    setShowAiPrompt(false);
    setAiPromptNotice('');
  };
  const pendingCardQuestions = cardSlots
    .map((slot, index) => ({
      id: `${slot.name}-${index}`,
      label: slot.label || `位置${index + 1}`,
      cardName: slot.name || '未选牌',
      question: cardQuestions[index]?.trim() || '',
    }))
    .filter(item => item.question);
  const handleToggleAiPrompt = () => {
    if (showAiPrompt && canGenerateAiPrompt) {
      setShowAiPrompt(false);
      setAiPromptNotice('');
      return;
    }

    if (aiPromptResult.ok === false) {
      setShowAiPrompt(false);
      setAiPromptNotice(getGentleAiPromptNotice(aiPromptResult.notice));
      return;
    }

    setAiPromptNotice('');
    setShowAiPrompt(true);
  };
  const handleCopyAiPrompt = async () => {
    if (aiPromptResult.ok === false) {
      setAiPromptNotice(getGentleAiPromptNotice(aiPromptResult.notice));
      return;
    }

    try {
      await copyTextToClipboard(aiPromptResult.prompt);
      setAiPromptNotice('已复制，可粘贴到你信任的 AI 工具。');
    } catch {
      setAiPromptNotice('复制失败，可以手动全选提示词复制。');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 rounded-[1.45rem] border border-forest-accent/8 bg-white/46 p-2.5 pb-3 shadow-[0_14px_46px_-40px_rgba(62,58,54,0.45)] backdrop-blur-[2px] sm:space-y-4 sm:rounded-[1.7rem] sm:p-5">
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
	            className="fixed left-1/2 top-24 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-forest-accent/90 px-5 py-3 text-sm font-medium text-white shadow-[0_14px_38px_-30px_rgba(62,58,54,0.55)]"
          >
            <Sparkles size={18} />
            <span>已保存，当前手记正在使用这个牌阵</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestoreConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-forest-text/14 p-3 backdrop-blur-[2px] overscroll-contain">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm space-y-3.5 rounded-[1.4rem] border border-forest-accent/8 bg-white/82 p-4 shadow-[0_18px_56px_-42px_rgba(62,58,54,0.58)] backdrop-blur-md"
            >
              <div className="flex items-center gap-3 text-forest-accent">
                <RotateCcw size={24} />
                <h3 className="font-serif text-lg font-semibold">恢复默认设置</h3>
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
                  className="flex-1 min-h-11 py-2 bg-forest-accent/92 text-white rounded-xl font-medium hover:bg-forest-accent transition-all"
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
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-forest-text/14 p-3 backdrop-blur-[2px] overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm space-y-3.5 rounded-[1.4rem] border border-forest-accent/8 bg-white/82 p-4 shadow-[0_18px_56px_-42px_rgba(62,58,54,0.58)] backdrop-blur-md"
            >
              <div className="flex items-center gap-3 text-forest-accent">
                <Layers size={24} />
                <h3 className="font-serif text-lg font-semibold">牌阵名称已存在</h3>
              </div>
              <p className="text-sm text-forest-muted leading-relaxed">
                “{spreadSaveConflict.name}”已经存在。你可以覆盖原牌阵，或另存为一个副本。
              </p>
              <div className="grid gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveSpreadAsCopy}
	                  className="min-h-11 rounded-xl bg-forest-accent/92 font-medium text-white transition-all hover:bg-forest-accent"
                >
                  另存为副本
                </button>
                <button
                  type="button"
                  onClick={() => completeSpreadSave(spreadSaveConflict.spread)}
	                  className="min-h-11 rounded-xl bg-amber-100 font-medium text-amber-700 transition-all hover:bg-amber-200"
                >
                  覆盖原牌阵
                </button>
                <button
                  type="button"
                  onClick={() => setSpreadSaveConflict(null)}
	                  className="min-h-11 rounded-xl bg-forest-bg font-medium text-forest-muted transition-colors hover:text-forest-accent"
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
        onDeleteSpread={requestDeleteSpread}
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
        highlightedRequiredField={
          submitIssue?.field === 'question' || submitIssue?.field === 'spread'
            ? submitIssue.field
            : null
        }
        quickThemeSlot={
          !initialData && !isDailyMode
            ? <QuickSpreadButtons onSelectSpread={handleQuickThemeSelect} />
            : null
        }
      />

      {shouldShowChoicePathFields && (
        <section
          data-testid="choice-path-fields"
          className="rounded-[1.25rem] border border-forest-accent/8 bg-white/34 p-3 shadow-[0_10px_34px_-32px_rgba(62,58,54,0.45)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-forest-accent">选择路径说明</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-forest-muted">
                写清左右两条路，生成 AI 提示词时会自动带上。
              </p>
            </div>
            <span className="rounded-full bg-forest-accent/7 px-2 py-1 text-[10px] font-medium text-forest-muted">
              可稍后补
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-forest-accent">A 路代表</span>
              <input
                aria-label="A 路代表"
                value={formData.choicePathA}
                onChange={e => setFormData({ ...formData, choicePathA: e.target.value })}
                onFocus={scrollFocusedFieldIntoView}
                className="min-h-11 w-full rounded-xl border border-forest-accent/8 bg-white/52 px-3 py-2 text-sm text-forest-ink transition-all placeholder:text-forest-muted/45 focus:ring-2 focus:ring-forest-accent/15"
                placeholder="例如：三个月内离职，和私人老板合作"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-forest-accent">B 路代表</span>
              <input
                aria-label="B 路代表"
                value={formData.choicePathB}
                onChange={e => setFormData({ ...formData, choicePathB: e.target.value })}
                onFocus={scrollFocusedFieldIntoView}
                className="min-h-11 w-full rounded-xl border border-forest-accent/8 bg-white/52 px-3 py-2 text-sm text-forest-ink transition-all placeholder:text-forest-muted/45 focus:ring-2 focus:ring-forest-accent/15"
                placeholder="例如：继续留在当前单位"
              />
            </label>
          </div>
        </section>
      )}

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
                const nextSlots = createBlankSlotsForSpread(s);
                const editorSlots = toFreeEditorSlots(nextSlots, s.layout);
                const isOfficial = OFFICIAL_SPREADS.some(os => os.name === s.name);

                setFormData(prev => ({ ...prev, spread: s.name, layoutType: 'free' }));
                setGridCols(20);
                setGridRows(12);
                setFreeLayoutSaveMode('original');
                setCardSlots(editorSlots);
                setDesignActiveSlot(editorSlots.length > 0 ? 0 : -1);
                setIsEditingSession(!isOfficial);
              }}
              onStartNewSession={handleCreateNewSpread}
              onClose={handleCancelSpreadManager}
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

      <div
        data-required-field="cards"
        className={`rounded-[1.45rem] transition-all ${
          submitIssue?.field === 'cards'
            ? 'ring-2 ring-forest-pink/12'
            : 'ring-0'
        }`}
      >
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
          onToggleSlotReverse={toggleReverse}
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
      </div>


      {/* Card Metadata & Main Display */}
      <div ref={readingDetailRef} className="scroll-mt-24">
        <ReadingDetailView
          activeSlotIndex={activeSlotIndex}
          cardSlots={cardSlots}
          cardMetadata={cardMetadata}
          cardInterpretations={cardInterpretations}
          cardQuestions={cardQuestions}
          isLoggedIn={isLoggedIn}
          userId={userId}
          isMultiCard={isMultiCard}
          isDailyMode={isDailyMode}
          onToggleReverse={toggleReverse}
          onSetCardInterpretations={setCardInterpretations}
          onSetCardQuestions={setCardQuestions}
          onSetActiveSlotIndex={setActiveSlotIndex}
          onSetShowPicker={setShowPicker}
          onUpdateCardSlotsWithHistory={updateCardSlotsWithHistory}
          hasInterpretationError={submitIssue?.field === 'cardInterpretation' && submitIssue.slotIndex === activeSlotIndex}
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
          <AutoResizeTextarea
            minRows={2}
            maxRows={8}
            className="w-full rounded-xl border border-forest-accent/8 bg-white/48 px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:ring-forest-accent/15"
            placeholder="牌与牌之间的整体关联感悟..." 
            value={formData.combination} 
            onChange={e => setFormData({...formData, combination: e.target.value})} 
          />
        </FoldableSection>
      )}

      {formData.isForClient && (
        <div className="grid grid-cols-1 gap-3 rounded-[1.25rem] border border-forest-accent/7 bg-white/22 p-3 md:grid-cols-2">
          <div className="space-y-1.5">
	            <label className="flex items-center gap-2 px-1 text-sm font-medium text-forest-accent"><User size={14} /> 客户姓名</label>
            <input
              data-required-field="clientName"
              aria-invalid={submitIssue?.field === 'clientName'}
              className={`w-full rounded-xl border px-4 py-2 text-sm transition-all focus:ring-2 ${
                submitIssue?.field === 'clientName'
                  ? 'border-forest-pink/35 bg-forest-pink/6 ring-2 ring-forest-pink/10 focus:ring-forest-pink/15'
                  : 'border-forest-accent/8 bg-white/48 focus:ring-forest-accent/15'
              }`}
              placeholder="输入客户称呼..."
              value={formData.clientName}
              onFocus={scrollFocusedFieldIntoView}
              onChange={e => setFormData({...formData, clientName: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
	            <label className="flex items-center gap-2 px-1 text-sm font-medium text-forest-accent"><MessageSquare size={14} /> 客户反馈</label>
            <input className="w-full px-4 py-2 bg-white/48 border border-forest-accent/8 rounded-xl focus:ring-2 focus:ring-forest-accent/15 text-sm" placeholder="客户的真实反馈..." value={formData.clientFeedback} onFocus={scrollFocusedFieldIntoView} onChange={e => setFormData({...formData, clientFeedback: e.target.value})} />
          </div>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        <FoldableSection
          icon={MessageSquare}
          title="📌 添加复盘（可选）"
          isOpen={showFeedback}
          onToggle={() => setShowFeedback(!showFeedback)}
        >
          <AutoResizeTextarea
            minRows={2}
            maxRows={10}
            className="w-full rounded-xl border border-forest-accent/8 bg-white/48 px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:ring-forest-accent/15"
            placeholder="记录你对这次占卜的自我评价或后续验证..."
            value={formData.userFeedback}
            onFocus={scrollFocusedFieldIntoView}
            onChange={e => setFormData({...formData, userFeedback: e.target.value})}
          />

          {pendingCardQuestions.length > 0 && (
            <div className="mt-3 rounded-[1.15rem] border border-forest-accent/7 bg-white/24 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-forest-accent">待回应的牌面疑问</p>
                <span className="rounded-full bg-forest-accent/7 px-2 py-0.5 text-[10px] font-medium text-forest-muted">
                  {pendingCardQuestions.length} 条
                </span>
              </div>
              <div className="space-y-1.5">
                {pendingCardQuestions.map(item => (
                  <div key={item.id} className="rounded-xl bg-white/42 px-3 py-2 text-xs leading-relaxed text-forest-ink">
                    <span className="font-medium text-forest-accent">{item.label} · {item.cardName}：</span>
                    <span className="text-forest-muted">{item.question}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 space-y-2 rounded-[1rem] border border-forest-accent/7 bg-white/22 p-2 sm:rounded-[1.15rem] sm:p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="mr-auto min-w-[6.8rem] text-sm font-semibold text-forest-accent">AI 解牌提示词</p>
              <div className="flex rounded-full border border-forest-accent/7 bg-white/34 p-0.5">
              {([
                ['mentor', '导师复盘', '看我的解读'],
                ['consultant', '咨询解牌', '直接看牌阵'],
              ] as const).map(([mode, label, subtitle]) => {
                const isActive = aiPromptMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleAiPromptModeChange(mode)}
                    aria-label={`${label}${subtitle}`}
                    className={`min-h-11 rounded-full px-2.5 text-center text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${
                      isActive
                        ? 'bg-forest-accent/88 text-white'
                        : 'text-forest-muted hover:bg-white/70 hover:text-forest-accent'
                    }`}
                    aria-pressed={isActive}
                  >
                    {label}
                  </button>
                );
              })}
              </div>
              <button
                type="button"
                onClick={handleToggleAiPrompt}
                aria-label={showAiPrompt && canGenerateAiPrompt ? '收起提示词' : aiPromptModeMeta.buttonText}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-forest-accent/88 px-3 text-[11px] font-medium text-white transition-all hover:bg-forest-accent active:scale-[0.98] sm:px-3.5 sm:text-xs"
              >
                <Sparkles size={13} />
                <span aria-hidden="true">{showAiPrompt && canGenerateAiPrompt ? '收起' : '生成'}</span>
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-forest-muted">
              {aiPromptModeMeta.description}
            </p>

            {aiPromptNotice && !showAiPrompt && (
              <p className="rounded-xl border border-forest-accent/10 bg-white/46 px-3 py-2 text-xs leading-relaxed text-forest-muted">
                {aiPromptNotice}
              </p>
            )}

            <AnimatePresence>
              {showAiPrompt && canGenerateAiPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-2"
                >
                  <AutoResizeTextarea
                    readOnly
                    minRows={5}
                    maxRows={14}
                    value={aiPromptText}
                    className="w-full resize-y rounded-xl border border-forest-accent/8 bg-[#FDF8F0]/70 px-3 py-2 text-xs leading-relaxed text-forest-ink focus:ring-2 focus:ring-forest-accent/15"
                    aria-label={`生成的 AI 解牌提示词：${aiPromptModeMeta.label}`}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-forest-muted">
                      {aiPromptModeMeta.note}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyAiPrompt}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-forest-accent/10 bg-white/60 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-white"
                    >
                      <Copy size={14} />
                      复制提示词
                    </button>
                  </div>
                  {aiPromptNotice && (
                    <p className="text-xs text-forest-accent">{aiPromptNotice}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-3 space-y-2 rounded-[1.05rem] border border-forest-accent/7 bg-white/20 p-2.5 sm:rounded-[1.2rem] sm:p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-forest-accent">补充解读视角（可选）</p>
                <p className="mt-0.5 hidden text-[10px] text-forest-muted sm:block">灵数、星座、宫位、元素，适合复盘后再审慎补充。</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveInfluenceKey(shouldShowInfluenceTools ? null : 'numerologyInfluence')}
                  className="min-h-11 rounded-xl bg-white/38 px-3 text-[11px] font-semibold text-forest-accent ring-1 ring-forest-accent/7 transition-colors hover:bg-white/60 sm:hidden"
                >
                  {shouldShowInfluenceTools ? '收起' : '展开'}
                </button>
                <label className={`${shouldShowInfluenceTools ? 'flex' : 'hidden sm:flex'} min-h-10 items-center gap-1.5 rounded-xl px-1.5 text-[10px] font-semibold text-forest-muted transition-colors hover:bg-forest-accent/5`}>
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
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-all sm:min-h-12 sm:px-3 sm:py-2 sm:text-xs ${
                        isActive
                          ? 'bg-forest-accent/92 text-white border-forest-accent/40'
                          : 'bg-white/42 text-forest-accent border-forest-accent/8 hover:bg-white/64'
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
                  className="space-y-3 rounded-[1.25rem] border border-forest-accent/7 bg-white/24 p-3"
                >
                  <div className="flex items-start gap-2">
                    {React.createElement(activeInfluenceField.icon, { size: 16, className: 'text-forest-accent mt-0.5' })}
                    <div>
                      <p className="text-sm font-semibold text-forest-accent">{activeInfluenceField.title}</p>
                      <p className="text-[10px] text-forest-muted mt-1">{activeInfluenceField.subtitle}</p>
                    </div>
                  </div>
                  <AutoResizeTextarea
                    minRows={2}
                    maxRows={8}
                    className="w-full rounded-xl border border-forest-accent/8 bg-white/48 px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:ring-forest-accent/15"
                    placeholder={activeInfluenceField.placeholder}
                    value={formData[activeInfluenceField.key]}
                    onFocus={scrollFocusedFieldIntoView}
                    onChange={e => setFormData({ ...formData, [activeInfluenceField.key]: e.target.value })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FoldableSection>

        <FoldableSection
          icon={Settings}
          title="⚙️ 高级选项"
          isOpen={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
        >
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-forest-muted group">
              <input type="checkbox" className="accent-forest-accent w-4 h-4" checked={formData.isPublic && !formData.isAnonymous} onChange={e => handlePublicShareToggle(e.target.checked)} />
              <span className="group-hover:text-forest-accent transition-colors">公开到研习广场</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-forest-muted group">
              <input type="checkbox" className="accent-forest-accent w-4 h-4" checked={formData.isPublic && formData.isAnonymous} onChange={e => handleAnonymousShareToggle(e.target.checked)} />
              <span className="group-hover:text-forest-accent transition-colors">匿名分享到广场</span>
            </label>
	            <label className="group flex cursor-pointer items-center gap-2 text-nowrap text-sm font-medium text-forest-accent">
              <input type="checkbox" className="accent-forest-accent w-4 h-4" checked={!formData.skipAi} onChange={e => {
                const willProcess = e.target.checked;
                setFormData({...formData, skipAi: !willProcess});
                localStorage.setItem('tarot_ai_preference', willProcess ? 'process' : 'skip');
              }} />
              <span className="group-hover:scale-105 transition-transform">参与AI深度解析</span>
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-forest-accent/8 bg-white/28 px-4 py-3 text-xs leading-relaxed text-forest-muted">
            <p className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-forest-accent" />
              <span>
                参与 AI 深度解析后，系统会尝试识别牌名、整理关键词和提供灵感线索，帮助你复盘；它不会替你发布内容，也不会代替你的最终判断。
              </span>
            </p>
          </div>
        </FoldableSection>
      </div>

      {submitNotice && (
        <div className="rounded-2xl border border-forest-pink/18 bg-forest-pink/7 px-4 py-3 text-sm font-medium text-forest-ink">
          {submitNotice}
        </div>
      )}

	        <div className="sticky bottom-[4.35rem] z-20 rounded-[1.25rem] border border-forest-accent/7 bg-white/68 p-2 shadow-[0_14px_46px_-40px_rgba(62,58,54,0.48)] backdrop-blur-md sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <button
          type="submit"
          disabled={isLoading}
	          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-accent/88 px-4 py-3 font-medium text-white shadow-sm transition-all hover:bg-forest-accent active:scale-[0.98] disabled:opacity-50 sm:min-h-[3.1rem] sm:gap-3 sm:py-3.5"
        >
          {isLoading ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Sparkles size={20} /></motion.div> 保存中...</>
          ) : (
            <>
              {isLoggedIn ? <BookOpen size={22} /> : <Save size={22} />}
              <span className="text-sm sm:text-base">
                {initialData ? '保存修改' : '保存手记'}
              </span>
            </>
          )}
        </button>
        {!isLoading && (
          <p className="mt-1.5 text-center text-[10px] leading-tight text-forest-muted">
            {isLoggedIn ? '会先写入本机，并继续同步云端。' : '会先保存在本机；登录后可同步云端。'}
          </p>
        )}
      </div>
      
      {/* Spacing */}
      <div className="h-1" />
    </form>
  );
};
