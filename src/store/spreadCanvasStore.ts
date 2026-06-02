import { create } from 'zustand';
import { TAROT_CARDS, getCardImageUrl } from '../constants';

export { TAROT_CARDS };

export interface CardInstance {
  id: string;
  cardId: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  isReversed: boolean;
  zIndex: number;
  label: string;
}

export interface SpreadTemplate {
  id: string;
  name: string;
  description: string;
  positions: { x: number; y: number; rotation: number; label: string; meaning: string }[];
}

interface SpreadCanvasState {
  cards: CardInstance[];
  selectedCardIds: string[];
  history: CardInstance[][];
  historyIndex: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  isDraggingCanvas: boolean;
  isDraggingCard: boolean;
  templates: SpreadTemplate[];
  currentTemplate: string | null;
  showContextMenu: boolean;
  contextMenuPosition: { x: number; y: number };
  showCardModal: boolean;
  selectedCardForModal: CardInstance | null;

  addCard: (cardId: string, x: number, y: number) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, updates: Partial<CardInstance>) => void;
  selectCard: (id: string, multiSelect?: boolean) => void;
  selectCards: (ids: string[]) => void;
  deselectAll: () => void;
  flipCard: (id: string) => void;
  rotateCard: (id: string, delta: number) => void;
  scaleCard: (id: string, delta: number) => void;
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  setDraggingCanvas: (isDragging: boolean) => void;
  setDraggingCard: (isDragging: boolean) => void;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  loadTemplate: (templateId: string) => void;
  exportSpread: () => string;
  importSpread: (json: string) => void;
  clearSpread: () => void;
  showContextMenuAt: (x: number, y: number) => void;
  hideContextMenu: () => void;
  openCardModal: (card: CardInstance) => void;
  closeCardModal: () => void;
}

const DEFAULT_TEMPLATES: SpreadTemplate[] = [
  {
    id: 'single',
    name: '单张牌',
    description: '适合简单问题的快速解答',
    positions: [{ x: 0, y: 0, rotation: 0, label: '答案', meaning: '当前问题的直接答案' }]
  },
  {
    id: 'three-card',
    name: '三张牌',
    description: '过去、现在、未来的时间流解读',
    positions: [
      { x: -150, y: 0, rotation: 0, label: '过去', meaning: '影响当前状况的过去因素' },
      { x: 0, y: 0, rotation: 0, label: '现在', meaning: '当前的状况和能量' },
      { x: 150, y: 0, rotation: 0, label: '未来', meaning: '未来的发展趋势' }
    ]
  },
  {
    id: 'celtic-cross',
    name: '凯尔特十字',
    description: '经典的综合性牌阵，深入解读问题',
    positions: [
      { x: 0, y: 0, rotation: 0, label: '现状', meaning: '问题的核心本质' },
      { x: 0, y: 0, rotation: 90, label: '挑战', meaning: '面临的障碍和挑战' },
      { x: 0, y: 120, rotation: 0, label: '基础', meaning: '问题的根源和基础' },
      { x: -120, y: 0, rotation: 0, label: '过去', meaning: '过去的影响和历史' },
      { x: 120, y: 0, rotation: 0, label: '未来', meaning: '未来的发展方向' },
      { x: 0, y: -120, rotation: 0, label: '目标', meaning: '期望的结果和目标' },
      { x: -180, y: 120, rotation: 0, label: '自我', meaning: '问卜者的内心状态' },
      { x: 180, y: 120, rotation: 0, label: '环境', meaning: '外部环境的影响' },
      { x: -180, y: -120, rotation: 0, label: '希望', meaning: '希望和恐惧' },
      { x: 180, y: -120, rotation: 0, label: '结果', meaning: '最终的结果' }
    ]
  },
  {
    id: 'yes-no',
    name: '是与否',
    description: '针对是非问题的简单牌阵',
    positions: [
      { x: -80, y: 0, rotation: 0, label: '赞成', meaning: '支持肯定答案的因素' },
      { x: 80, y: 0, rotation: 0, label: '反对', meaning: '支持否定答案的因素' },
      { x: 0, y: -100, rotation: 0, label: '建议', meaning: '综合建议' }
    ]
  }
];

export const useSpreadCanvasStore = create<SpreadCanvasState>((set, get) => ({
  cards: [],
  selectedCardIds: [],
  history: [],
  historyIndex: -1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDraggingCanvas: false,
  isDraggingCard: false,
  templates: DEFAULT_TEMPLATES,
  currentTemplate: null,
  showContextMenu: false,
  contextMenuPosition: { x: 0, y: 0 },
  showCardModal: false,
  selectedCardForModal: null,

  addCard: (cardId, x, y) => {
    const newCard: CardInstance = {
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cardId,
      x,
      y,
      rotation: 0,
      scale: 1,
      isReversed: false,
      zIndex: get().cards.length,
      label: ''
    };
    get().saveToHistory();
    set(state => ({ cards: [...state.cards, newCard] }));
  },

  removeCard: (id) => {
    get().saveToHistory();
    set(state => ({ 
      cards: state.cards.filter(c => c.id !== id),
      selectedCardIds: state.selectedCardIds.filter(cid => cid !== id)
    }));
  },

  updateCard: (id, updates) => {
    set(state => ({
      cards: state.cards.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  },

  selectCard: (id, multiSelect = false) => {
    set(state => {
      if (multiSelect) {
        const isSelected = state.selectedCardIds.includes(id);
        return {
          selectedCardIds: isSelected
            ? state.selectedCardIds.filter(cid => cid !== id)
            : [...state.selectedCardIds, id]
        };
      }
      return { selectedCardIds: [id] };
    });
  },

  selectCards: (ids) => {
    set({ selectedCardIds: ids });
  },

  deselectAll: () => {
    set({ selectedCardIds: [] });
  },

  flipCard: (id) => {
    get().saveToHistory();
    set(state => ({
      cards: state.cards.map(c => 
        c.id === id ? { ...c, isReversed: !c.isReversed, rotation: c.rotation + 180 } : c
      )
    }));
  },

  rotateCard: (id, delta) => {
    set(state => ({
      cards: state.cards.map(c =>
        c.id === id ? { ...c, rotation: c.rotation + delta } : c
      )
    }));
  },

  scaleCard: (id, delta) => {
    set(state => ({
      cards: state.cards.map(c => {
        if (c.id === id) {
          const newScale = Math.max(0.5, Math.min(2, c.scale + delta));
          return { ...c, scale: newScale };
        }
        return c;
      })
    }));
  },

  setScale: (scale) => {
    set({ scale: Math.max(0.25, Math.min(3, scale)) });
  },

  setOffset: (x, y) => {
    set({ offsetX: x, offsetY: y });
  },

  setDraggingCanvas: (isDragging) => {
    set({ isDraggingCanvas: isDragging });
  },

  setDraggingCard: (isDragging) => {
    set({ isDraggingCard: isDragging });
  },

  saveToHistory: () => {
    const { cards, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(cards)));
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      set({ cards: previousState, historyIndex: historyIndex - 1 });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      set({ cards: nextState, historyIndex: historyIndex + 1 });
    }
  },

  loadTemplate: (templateId) => {
    const { templates } = get();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    get().saveToHistory();
    const centerX = 0;
    const centerY = 0;
    const cards: CardInstance[] = template.positions.map((pos, index) => ({
      id: `card-${Date.now()}-${index}`,
      cardId: TAROT_CARDS[index % TAROT_CARDS.length].id,
      x: centerX + pos.x,
      y: centerY + pos.y,
      rotation: pos.rotation,
      scale: 1,
      isReversed: false,
      zIndex: index,
      label: pos.label
    }));
    set({ cards, currentTemplate: templateId });
  },

  exportSpread: () => {
    const { cards, currentTemplate } = get();
    return JSON.stringify({ cards, currentTemplate }, null, 2);
  },

  importSpread: (json) => {
    try {
      const data = JSON.parse(json);
      get().saveToHistory();
      set({ cards: data.cards || [], currentTemplate: data.currentTemplate || null });
    } catch (e) {
      console.error('Failed to import spread:', e);
    }
  },

  clearSpread: () => {
    get().saveToHistory();
    set({ cards: [], currentTemplate: null });
  },

  showContextMenuAt: (x, y) => {
    set({ showContextMenu: true, contextMenuPosition: { x, y } });
  },

  hideContextMenu: () => {
    set({ showContextMenu: false });
  },

  openCardModal: (card) => {
    set({ showCardModal: true, selectedCardForModal: card });
  },

  closeCardModal: () => {
    set({ showCardModal: false, selectedCardForModal: null });
  }
}));

export const getCardMeaning = (cardId: string, isReversed: boolean): { upright: string; reversed: string } => {
  const card = TAROT_CARDS.find(c => c.id === cardId);
  if (!card) return { upright: '', reversed: '' };
  
  return {
    upright: card.meaning || '暂无解读',
    reversed: card.reversedMeaning || '暂无逆位解读'
  };
};

export const getCardData = (cardId: string) => {
  return TAROT_CARDS.find(c => c.id === cardId);
};

export const getCardImage = (cardId: string, isReversed: boolean) => {
  const url = getCardImageUrl(cardId);
  return isReversed ? `${url}?reversed=1` : url;
};