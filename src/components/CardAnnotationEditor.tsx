import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Save, RotateCcw, Star, Moon, Sun, Sparkles, ArrowLeft } from 'lucide-react';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { OFFICIAL_CARD_ANNOTATIONS } from '../constants/cardAnnotations';
import { cardMatchesSearch } from '../lib/cardSearch';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { TarotCardImage } from './TarotCardImage';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';

interface CardAnnotationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialCardId?: string;
  onAnnotationsUpdated?: () => void;
}

type FilterType = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles' | 'modified';

const getAnnotationForm = (cardId: string) => {
  const merged = cardAnnotationService.getMergedAnnotation(cardId);

  return {
    numerology: merged.numerology || '',
    planet: merged.planet || '',
    zodiac: merged.zodiac || '',
    house: merged.house || '',
    element: merged.element || '',
    uprightMeaning: merged.uprightMeaning,
    reversedMeaning: merged.reversedMeaning,
    keywords: merged.keywords.join('、'),
    personalNotes: merged.personalNotes,
  };
};

export const CardAnnotationEditor: React.FC<CardAnnotationEditorProps> = ({
  isOpen,
  onClose,
  initialCardId,
  onAnnotationsUpdated
}) => {
  useBodyScrollLock(isOpen);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCardId || null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [editForm, setEditForm] = useState({
    numerology: '',
    planet: '',
    zodiac: '',
    house: '',
    element: '',
    uprightMeaning: '',
    reversedMeaning: '',
    keywords: '',
    personalNotes: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (!initialCardId) {
      setSelectedCardId(null);
      return;
    }

    setSelectedCardId(initialCardId);
    setEditForm(getAnnotationForm(initialCardId));
  }, [initialCardId, isOpen]);

  const modifiedCardIds = useMemo(() => {
    return new Set(cardAnnotationService.getModifiedCardIds());
  }, [refreshTick]);

  const filteredCards = useMemo(() => {
    let cards = TAROT_CARDS;

    if (filter === 'modified') {
      cards = cards.filter(card => modifiedCardIds.has(card.id));
    } else if (filter !== 'all') {
      if (filter === 'major') {
        cards = cards.filter(card => card.id.startsWith('ar'));
      } else {
        cards = cards.filter(card => card.id.startsWith(filter.substring(0, 2)));
      }
    }

    if (searchQuery.trim()) {
      cards = cards.filter(card => cardMatchesSearch(card, searchQuery));
    }

    return cards;
  }, [filter, searchQuery, modifiedCardIds]);

  const handleCardSelect = (cardId: string) => {
    if (selectedCardId && hasUnsavedChanges()) {
      setShowUnsavedWarning(true);
      return;
    }

    setSelectedCardId(cardId);
    setEditForm(getAnnotationForm(cardId));
  };

  const hasUnsavedChanges = () => {
    if (!selectedCardId) return false;
    
    const originalForm = getAnnotationForm(selectedCardId);

    return JSON.stringify(editForm) !== JSON.stringify(originalForm);
  };

  const handleSave = async () => {
    if (!selectedCardId) return;

    setIsSaving(true);
    
    try {
      const card = TAROT_CARDS.find(c => c.id === selectedCardId);
      const cardName = card?.name || selectedCardId;
      
      cardAnnotationService.saveUserAnnotation(selectedCardId, {
        numerology: editForm.numerology || null,
        planet: editForm.planet || null,
        zodiac: editForm.zodiac || null,
        house: editForm.house || null,
        element: editForm.element || null,
        uprightMeaning: editForm.uprightMeaning,
        reversedMeaning: editForm.reversedMeaning,
        keywords: editForm.keywords.split(/[、,，]/).filter(k => k.trim()),
        personalNotes: editForm.personalNotes,
      });

      setSaveSuccessMessage(`《${cardName}》的注解已保存`);
      setShowSaveSuccess(true);
      setShowUnsavedWarning(false);
      setRefreshTick(prev => prev + 1);
      onAnnotationsUpdated?.();
      
      setTimeout(() => {
        setShowSaveSuccess(false);
      }, 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!selectedCardId) return;
    
    const card = TAROT_CARDS.find(c => c.id === selectedCardId);
    const cardName = card?.name || selectedCardId;
    
    cardAnnotationService.resetAnnotationToOfficial(selectedCardId);
    setEditForm(getAnnotationForm(selectedCardId));
    setRefreshTick(prev => prev + 1);
    onAnnotationsUpdated?.();
    
    setSaveSuccessMessage(`《${cardName}》已恢复官方注解`);
    setShowSaveSuccess(true);
    
    setTimeout(() => {
      setShowSaveSuccess(false);
    }, 2000);
  };

  if (!isOpen) return null;

  const getArcanaInfo = (cardId: string) => {
    if (cardId.startsWith('ar')) return { arcana: 'major', name: '大阿尔卡纳', icon: Sun };
    if (cardId.startsWith('wa')) return { arcana: 'minor', name: '权杖', suit: 'wands', icon: Sparkles };
    if (cardId.startsWith('cu')) return { arcana: 'minor', name: '圣杯', suit: 'cups', icon: Moon };
    if (cardId.startsWith('sw')) return { arcana: 'minor', name: '宝剑', suit: 'swords', icon: Star };
    if (cardId.startsWith('pe')) return { arcana: 'minor', name: '星币', suit: 'pentacles', icon: Star };
    return { arcana: 'unknown' as const, name: '未知' };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[520] bg-black/50 backdrop-blur-sm overscroll-contain"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="absolute inset-2 flex max-h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-2xl bg-forest-bg shadow-2xl sm:inset-4 sm:max-h-[calc(100vh-2rem)] md:inset-8 md:max-h-[calc(100vh-4rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-forest-accent/12 p-3 sm:p-4">
          <h2 className="font-serif text-lg font-bold text-forest-ink sm:text-xl">编辑牌义</h2>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 p-2 hover:bg-forest-accent/10 rounded-lg transition-colors flex items-center justify-center"
            aria-label="关闭编辑牌义"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Card List */}
          <div className={`${selectedCardId ? 'hidden md:flex' : 'flex'} w-full md:w-80 md:border-r border-forest-accent/20 flex-col`}>
            {/* Search and Filter */}
            <div className="space-y-2 border-b border-forest-accent/12 p-3 sm:space-y-3 sm:p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" />
                <input
                  type="text"
                  placeholder="搜索牌名、别称或英文..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-11 pl-10 pr-4 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'major', label: '大阿尔卡纳' },
                  { key: 'modified', label: '已修改' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as FilterType)}
                    className={`min-h-11 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      filter === key
                        ? 'bg-forest-accent text-white'
                        : 'bg-forest-accent/10 text-forest-accent hover:bg-forest-accent/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filter === 'modified' && modifiedCardIds.size > 0 && (
                <div className="rounded-2xl border border-forest-accent/10 bg-white/70 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-forest-muted">
                    已修改牌义
                  </p>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto overscroll-contain pr-1">
                    {TAROT_CARDS.filter(card => modifiedCardIds.has(card.id)).map(card => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleCardSelect(card.id)}
                        className={`min-h-8 rounded-full px-2.5 text-[10px] font-bold transition-colors ${
                          selectedCardId === card.id
                            ? 'bg-forest-accent text-white'
                            : 'bg-forest-accent/10 text-forest-accent hover:bg-forest-accent/15'
                        }`}
                      >
                        {card.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'wands', label: '权杖', color: 'rose' },
                  { key: 'cups', label: '圣杯', color: 'blue' },
                  { key: 'swords', label: '宝剑', color: 'indigo' },
                  { key: 'pentacles', label: '星币', color: 'green' },
                ].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as FilterType)}
                    className={`min-h-11 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      filter === key
                        ? `bg-${color}-500 text-white`
                        : `bg-${color}-100 text-${color}-600 hover:bg-${color}-200`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Card List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
              {filteredCards.length === 0 ? (
                <div className="text-center py-8 text-forest-muted">
                  <p>没有找到匹配的牌</p>
                </div>
              ) : (
                filteredCards.map((card) => {
                  const info = getArcanaInfo(card.id);
                  const isModified = modifiedCardIds.has(card.id);
                  const isSelected = selectedCardId === card.id;
                  const Icon = info.icon || Star;

                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardSelect(card.id)}
                      className={`w-full min-h-16 p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-forest-accent text-white shadow-lg'
                          : 'hover:bg-forest-accent/10'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-white/80' : 'text-forest-accent'} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-forest-ink'}`}>
                          {card.name}
                        </p>
                        <p className={`text-xs truncate ${isSelected ? 'text-white/70' : 'text-forest-muted'}`}>
                          {card.english}
                        </p>
                      </div>
                      {isModified && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-forest-pink/20 text-forest-pink'
                        }`}>
                          已修改
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel - Editor */}
          <div className={`${selectedCardId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
            {selectedCardId ? (
              <>
                {/* Card Header */}
                <div className="p-4 border-b border-forest-accent/20 bg-gradient-to-r from-forest-accent/5 to-forest-pink/5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedCardId(null)}
                    className="md:hidden min-h-11 mb-3 -ml-2 px-3 rounded-xl text-sm font-bold text-forest-accent hover:bg-forest-accent/10 transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    返回牌库
                  </button>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const card = TAROT_CARDS.find(c => c.id === selectedCardId);
                      const annotation = OFFICIAL_CARD_ANNOTATIONS.find(a => a.cardId === selectedCardId);
                      return (
                        <>
                          <div className="w-16 h-24 rounded-lg overflow-hidden shadow-lg border-2 border-forest-accent/20">
                            <TarotCardImage
                              src={getCardImageUrl(card?.id || 'ar00')}
                              alt={card?.name || '塔罗牌'}
                              name={card?.name || '塔罗牌'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xl font-serif font-bold text-forest-ink">{card?.name}</h3>
                            <p className="text-sm text-forest-muted">{card?.english}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded text-xs font-bold">
                                {annotation?.arcana === 'major' ? '大阿尔卡纳' : '小阿尔卡纳'}
                              </span>
                              {annotation?.suit && (
                                <span className="px-2 py-0.5 bg-forest-pink/10 text-forest-pink rounded text-xs font-bold">
                                  {annotation.suit === 'wands' ? '权杖' :
                                   annotation.suit === 'cups' ? '圣杯' :
                                   annotation.suit === 'swords' ? '宝剑' : '星币'}
                                </span>
                              )}
                              {modifiedCardIds.has(selectedCardId) && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-xs font-bold">
                                  阁主已批注
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Editor Form */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 pb-28 md:pb-6">
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-forest-accent mb-1">数字命理学</label>
                      <input
                        type="text"
                        value={editForm.numerology}
                        onChange={(e) => setEditForm({ ...editForm, numerology: e.target.value })}
                        className="w-full min-h-11 px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                        placeholder="如: 0 - 无限可能"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-forest-accent mb-1">行星</label>
                      <input
                        type="text"
                        value={editForm.planet}
                        onChange={(e) => setEditForm({ ...editForm, planet: e.target.value })}
                        className="w-full min-h-11 px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                        placeholder="如: 水星、金星"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-forest-accent mb-1">星座</label>
                      <input
                        type="text"
                        value={editForm.zodiac}
                        onChange={(e) => setEditForm({ ...editForm, zodiac: e.target.value })}
                        className="w-full min-h-11 px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                        placeholder="如: 白羊座、狮子座"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-forest-accent mb-1">宫位</label>
                      <input
                        type="text"
                        value={editForm.house}
                        onChange={(e) => setEditForm({ ...editForm, house: e.target.value })}
                        className="w-full min-h-11 px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                        placeholder="如: 第一宫、第十宫"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-forest-accent mb-1">四元素</label>
                      <input
                        type="text"
                        value={editForm.element}
                        onChange={(e) => setEditForm({ ...editForm, element: e.target.value })}
                        className="w-full min-h-11 px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                        placeholder="如: 火、水、风、土"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-forest-accent mb-1">关键词</label>
                      <input
                        type="text"
                        value={editForm.keywords}
                        onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                        className="w-full min-h-11 px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none"
                        placeholder="用顿号分隔，如: 创造、热情"
                      />
                    </div>
                  </div>

                  {/* Meanings */}
                  <div>
                    <label className="block text-sm font-bold text-forest-accent mb-1">正位释义</label>
                    <AutoResizeTextarea
                      value={editForm.uprightMeaning}
                      onChange={(e) => setEditForm({ ...editForm, uprightMeaning: e.target.value })}
                      minRows={2}
                      maxRows={10}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-forest-accent/20 focus:border-forest-accent focus:ring-2 focus:ring-forest-accent/20 outline-none resize-none"
                      placeholder="请输入正位的详细释义..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-forest-pink mb-1">逆位释义</label>
                    <AutoResizeTextarea
                      value={editForm.reversedMeaning}
                      onChange={(e) => setEditForm({ ...editForm, reversedMeaning: e.target.value })}
                      minRows={2}
                      maxRows={10}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-forest-pink/20 focus:border-forest-pink focus:ring-2 focus:ring-forest-pink/20 outline-none resize-none"
                      placeholder="请输入逆位的详细释义..."
                    />
                  </div>

                  {/* Personal Notes */}
                  <div>
                    <label className="block text-sm font-bold text-amber-600 mb-1">个人注解</label>
                    <AutoResizeTextarea
                      value={editForm.personalNotes}
                      onChange={(e) => setEditForm({ ...editForm, personalNotes: e.target.value })}
                      minRows={2}
                      maxRows={10}
                      className="w-full px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                      placeholder="记录你个人对这张牌的理解和感悟..."
                    />
                  </div>
                </div>

                  {/* Action Buttons */}
                  <div className="shrink-0 border-t border-forest-accent/15 bg-forest-bg/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_28px_-24px_rgba(44,54,44,0.45)]">
                  {/* Success Message */}
                  <AnimatePresence>
                    {showSaveSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
                      >
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs">✓</span>
                        </div>
                        <span className="text-sm text-green-700 font-medium">{saveSuccessMessage}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      onClick={handleReset}
                      className="min-h-11 flex items-center justify-center gap-2 px-4 py-2 bg-white text-forest-muted rounded-lg border border-forest-accent/20 hover:bg-forest-accent/5 transition-colors"
                    >
                      <RotateCcw size={16} />
                      <span className="font-bold text-sm">恢复官方</span>
                    </button>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {showUnsavedWarning && (
                        <span className="text-sm text-amber-600">有未保存的更改</span>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`min-h-11 flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                          isSaving
                            ? 'bg-forest-accent/50 text-white cursor-wait'
                            : 'bg-forest-accent text-white hover:bg-forest-accent/90'
                        }`}
                      >
                        <Save size={16} />
                        <span>{isSaving ? '保存中...' : '保存修改'}</span>
                      </button>
                    </div>
                  </div>
                </div>
                </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-forest-muted">
                <div className="text-center">
                  <Moon size={48} className="mx-auto mb-4 opacity-30" />
                  <p>请从左侧列表选择一张牌</p>
                  <p className="text-sm mt-1">开始编辑你的牌义笔记</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
