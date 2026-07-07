import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Save, RotateCcw, Info, ChevronRight, Filter, Book, Sparkles, MessageSquare, History, Calendar, Pencil, Hash, Plus, Edit3 } from 'lucide-react';
import { CardKeywordMemory, TarotCardMetadata, TarotReading } from '../types';
import { getCardImageUrl, TAROT_CARDS } from '../constants';
import { useCardNumerology } from '../hooks/useCardNumerology';
import { getCardAnnotations, saveCardAnnotation } from '../lib/firebaseData';
import { cardMatchesSearch } from '../lib/cardSearch';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { CardAnnotationEditor } from './CardAnnotationEditor';
import { ConfirmDialog } from './ConfirmDialog';

interface CardMetadataManagerProps {
  metadata: TarotCardMetadata[];
  onUpdate: (updated: TarotCardMetadata[]) => void;
  readings: TarotReading[];
  cardKeywordMemory?: CardKeywordMemory[];
  onShowSnackbar?: (message: string) => void;
  isLoggedIn?: boolean;
  userId?: string;
  onAddReading?: (reading: any) => void;
}

interface CardNumerologyCardProps {
  cardName: string;
  isLoggedIn: boolean;
  userId?: string;
}

const buildCardLibrary = (customMetadata: TarotCardMetadata[]) => {
  const customById = new Map(customMetadata.map(card => [card.id, card]));
  const officialIds = new Set(TAROT_CARDS.map(card => card.id));

  return [
    ...TAROT_CARDS.map(card => {
      const custom = customById.get(card.id);
      if (!custom) return card;

      return {
        ...card,
        ...custom,
        astrology: {
          ...card.astrology,
          ...custom.astrology,
        },
      };
    }),
    ...customMetadata.filter(card => !officialIds.has(card.id)),
  ];
};

function CardNumerologyCard({ cardName, isLoggedIn, userId }: CardNumerologyCardProps) {
  const { numerology, meaning, keywords, isCustom, saveNumerology, restoreDefault } = useCardNumerology(cardName, isLoggedIn, userId);
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState<number | string>(numerology !== null ? numerology : '');
  const [tempMeaning, setTempMeaning] = useState<string>(meaning || '');
  const [tempKeywords, setTempKeywords] = useState<string>(keywords || '');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  useEffect(() => {
    if (numerology !== null) setTempVal(numerology);
    else setTempVal('');
    if (meaning !== null) setTempMeaning(meaning);
    if (keywords !== null) setTempKeywords(keywords);
  }, [numerology, meaning, keywords]);

  const options = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22, 33];

  if (isEditing) {
    return (
      <div className="bg-white/80 rounded-[1.5rem] p-5 border border-forest-accent/10 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-forest-accent uppercase tracking-widest flex items-center gap-1.5">
            <Hash size={14} /> 编辑灵数注解
          </span>
        </div>
        
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">数字设定</label>
          <div className="flex flex-wrap gap-2">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => setTempVal(opt)}
                className={`w-11 h-11 rounded-lg text-xs font-bold transition-all ${
                  Number(tempVal) === opt 
                    ? 'bg-forest-accent text-white shadow-sm' 
                    : 'bg-white text-forest-muted border border-forest-accent/10 hover:border-forest-accent/30'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="pt-1">
            <input 
              type="number"
              value={tempVal}
              onChange={e => setTempVal(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="或输入自定义数字..."
              className="w-full px-4 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">灵数含义</label>
          <input 
            type="text"
            value={tempMeaning}
            onChange={e => setTempMeaning(e.target.value)}
            placeholder="输入该灵数的象征意义..."
            className="w-full px-4 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">关键词 (逗号分隔)</label>
          <input 
            type="text"
            value={tempKeywords}
            onChange={e => setTempKeywords(e.target.value)}
            placeholder="例如：创造, 领导力, 开端..."
            className="w-full px-4 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={async () => {
              const valToSave = tempVal === '' ? 0 : Number(tempVal);
              await saveNumerology(valToSave, tempMeaning, tempKeywords);
              setIsEditing(false);
            }}
            className="flex-1 min-h-11 py-2 bg-forest-accent text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
          >
            保存
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="flex-1 min-h-11 py-2 bg-white text-forest-muted border border-forest-accent/10 rounded-xl text-xs font-bold hover:bg-forest-bg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => setShowRestoreConfirm(true)}
            className="min-h-11 min-w-11 px-3 py-2 text-red-400 hover:text-red-500 transition-colors flex items-center justify-center"
            title="恢复默认"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <ConfirmDialog
          isOpen={showRestoreConfirm}
          title="恢复默认灵数"
          message="确定要恢复默认灵数并清空这张牌的自定义注解吗？"
          confirmText="恢复"
          destructive
          onConfirm={async () => {
            await restoreDefault();
            setIsEditing(false);
          }}
          onClose={() => setShowRestoreConfirm(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-forest-accent/5 rounded-[1.5rem] p-5 border border-forest-accent/10 relative group">
      <button 
        onClick={() => setIsEditing(true)}
        className="absolute top-3 right-3 min-h-11 min-w-11 p-2 text-forest-muted hover:text-forest-accent transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center rounded-xl hover:bg-white/70"
        aria-label="编辑灵数注解"
      >
        <Pencil size={14} />
      </button>

      <div className="space-y-3 pr-10 sm:pr-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-serif text-forest-accent font-bold flex items-center gap-1.5">
            🔢 灵数注解
          </span>
          {isCustom && <span className="text-[8px] px-1.5 py-0.5 bg-forest-accent/10 rounded text-forest-accent border border-forest-accent/20 font-bold">自定义</span>}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-forest-muted uppercase tracking-wider w-10">数字:</span>
            <span className={`text-sm font-bold ${numerology !== null ? 'text-forest-accent' : 'text-forest-muted italic'}`}>
              {numerology !== null ? numerology : '未设置'}
            </span>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-forest-muted uppercase tracking-wider w-10">含义:</span>
            <span className={`text-xs ${meaning ? 'text-forest-text' : 'text-forest-muted italic'}`}>
              {meaning || '点击编辑，添加你的灵数注解'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-forest-muted uppercase tracking-wider w-10">关键词:</span>
            <div className="flex flex-wrap gap-1.5">
              {keywords ? keywords.split(/[,，\s]+/).filter(Boolean).map((kw, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-forest-accent/10 rounded-full text-forest-muted">
                  {kw}
                </span>
              )) : (
                <span className="text-xs text-forest-muted italic">暂无关键词</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardMetadataManager({ metadata, onUpdate, readings, cardKeywordMemory = [], onShowSnackbar, isLoggedIn, userId, onAddReading }: CardMetadataManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [localMetadata, setLocalMetadata] = useState<TarotCardMetadata[]>(() => buildCardLibrary(metadata));
  const [filterType, setFilterType] = useState<'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'>('all');
  const [personalMeanings, setPersonalMeanings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [annotationEditorCardId, setAnnotationEditorCardId] = useState<string | undefined>(undefined);
  const [modifiedCount, setModifiedCount] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setLocalMetadata(buildCardLibrary(metadata));
  }, [metadata]);
  
  useEffect(() => {
    setModifiedCount(cardAnnotationService.getModifiedCardIds().length);
  }, [showAnnotationEditor]);

  const refreshModifiedCount = () => {
    setModifiedCount(cardAnnotationService.getModifiedCardIds().length);
  };
  
  // Load personal meanings
  useEffect(() => {
    const loadMeanings = async () => {
      if (isLoggedIn && userId) {
        try {
          setPersonalMeanings(await getCardAnnotations(userId));
        } catch (error) {
          console.error('Error loading annotations:', error);
        }
      } else {
        const saved = localStorage.getItem('tarot_personal_meanings');
        if (saved) {
          try {
            setPersonalMeanings(JSON.parse(saved));
          } catch (e) { /* Fallback */ }
        }
      }
    };
    loadMeanings();
  }, [isLoggedIn, userId]);

  const filteredCards = useMemo(() => {
    return localMetadata.filter(card => {
      const matchesSearch = cardMatchesSearch(card, searchQuery);
      const matchesFilter = filterType === 'all' || 
        (filterType === 'major' && card.id.startsWith('ar')) ||
        (filterType === 'wands' && card.id.startsWith('wa')) ||
        (filterType === 'cups' && card.id.startsWith('cu')) ||
        (filterType === 'swords' && card.id.startsWith('sw')) ||
        (filterType === 'pentacles' && card.id.startsWith('pe'));
      return matchesSearch && matchesFilter;
    });
  }, [localMetadata, searchQuery, filterType]);

  const getDetailedInsights = (cardName: string) => {
    return readings
      .filter(r => r.cards.some(c => c.name === cardName))
      .map(r => {
        const cardIndex = r.cards.findIndex(c => c.name === cardName);
        return {
          id: r.id,
          date: r.readingDate || r.date,
          isReversed: r.cards[cardIndex].isReversed,
          question: r.question || '无具体问题',
          insight: r.cardInterpretations?.[cardIndex] || r.interpretation.singleCard
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handlePersonalMeaningChange = (cardName: string, value: string) => {
    setPersonalMeanings(prev => ({
      ...prev,
      [cardName]: value
    }));
  };

  const getCardKeywordMemory = (cardName: string) => (
    cardKeywordMemory.find(item => item.cardName === cardName)?.keywords || []
  );

  const appendKeywordToPersonalMeaning = (cardName: string, keyword: string) => {
    setPersonalMeanings(prev => {
      const current = prev[cardName] || '';
      if (current.includes(keyword)) return prev;

      return {
        ...prev,
        [cardName]: current ? `${current}\n- ${keyword}` : `- ${keyword}`
      };
    });
  };

  const savePersonalMeaning = async (cardName: string) => {
    setIsSaving(true);
    const meaning = personalMeanings[cardName] || '';

    if (isLoggedIn && userId) {
      try {
        await saveCardAnnotation(userId, cardName, meaning);
      } catch (error) {
        console.error('Error saving annotation:', error);
      }
    } else {
      const updated = { ...personalMeanings, [cardName]: meaning };
      localStorage.setItem('tarot_personal_meanings', JSON.stringify(updated));
    }

    if (onShowSnackbar) {
      onShowSnackbar(`阁主为《${cardName}》添注一则，注疏见深。`);
    }
    setIsSaving(false);
  };

  const handleCardChange = (id: string, field: keyof NonNullable<TarotCardMetadata['astrology']>, value: string) => {
    setLocalMetadata(prev => prev.map(card => {
      if (card.id === id) {
        return {
          ...card,
          astrology: {
            ...card.astrology,
            [field]: value
          }
        };
      }
      return card;
    }));
  };

  const saveAll = () => {
    onUpdate(localMetadata);
    if (onShowSnackbar) {
      const currentCard = localMetadata.find(c => c.id === editingCardId);
      const msg = currentCard 
        ? `阁主为《${currentCard.name}》添注一则，注疏见深。`
        : '已录入阁中典籍。';
      onShowSnackbar(msg);
    }
  };

  const resetAll = () => {
    setShowResetConfirm(true);
  };

  return (
    <div className="space-y-6 pb-24">
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="重置本地编辑"
        message="确定要重置所有修改吗？这将丢失您当前尚未保存的本地编辑。"
        confirmText="重置"
        destructive
        onConfirm={() => setLocalMetadata(buildCardLibrary(metadata))}
        onClose={() => setShowResetConfirm(false)}
      />

      <div className="ancient-book-bg p-4 sm:p-8 rounded-[2rem] border border-forest-accent/10 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-forest-accent/10 text-forest-accent rounded-2xl flex items-center justify-center shrink-0">
              <Book size={28} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-serif text-forest-accent">塔罗牌库</h2>
              <p className="text-xs text-forest-muted font-kai italic">查看 78 张牌，记录你的牌义笔记</p>
              {modifiedCount > 0 && (
                <p className="text-xs text-forest-pink font-bold mt-1">
                  已自定义 {modifiedCount} 张牌的注解
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:flex sm:items-center gap-3">
            <button 
              onClick={() => {
                setAnnotationEditorCardId(undefined);
                setShowAnnotationEditor(true);
              }}
              className="min-h-12 px-5 bg-forest-accent text-white hover:bg-forest-accent/90 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-forest-accent/15"
            >
              <Edit3 size={16} /> 批量编辑单牌牌义
            </button>
            <button 
              onClick={resetAll}
              className="min-h-12 px-4 text-sm text-forest-muted hover:text-forest-accent transition-colors flex items-center justify-center gap-2 rounded-xl hover:bg-forest-accent/5"
            >
              <RotateCcw size={16} /> 重置
            </button>
            <button 
              onClick={saveAll}
              className="min-h-12 px-6 bg-forest-pink text-white rounded-full text-sm font-bold hover:bg-forest-pink/90 transition-all shadow-lg shadow-forest-pink/20 flex items-center justify-center gap-2"
            >
              <Save size={16} /> 撰录成册
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-forest-muted" size={18} />
            <input 
              type="text" 
              placeholder="搜索牌名、别称或英文名..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-forest-accent/10 rounded-2xl focus:ring-2 focus:ring-forest-accent/20 text-sm shadow-inner"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(['all', 'major', 'wands', 'cups', 'swords', 'pentacles'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`min-h-11 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${
                  filterType === type 
                    ? 'bg-forest-accent text-white border-forest-accent shadow-md' 
                    : 'bg-white text-forest-muted border-forest-accent/10 hover:bg-forest-accent/5'
                }`}
              >
                {type === 'all' ? '全部' : type === 'major' ? '大牌' : type === 'wands' ? '权杖' : type === 'cups' ? '圣杯' : type === 'swords' ? '宝剑' : '星币'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map(card => {
          const insights = getDetailedInsights(card.name);
          const personalKeywordStats = getCardKeywordMemory(card.name).slice(0, 8);
          return (
            <motion.div 
              layout
              key={card.id}
              className={`bg-white rounded-[2rem] border transition-all overflow-hidden flex flex-col ${
                editingCardId === card.id ? 'ring-2 ring-forest-accent border-transparent shadow-2xl' : 'border-forest-accent/5 hover:border-forest-accent/20 shadow-sm'
              }`}
            >
              <button
                type="button"
                className="w-full p-5 flex items-center gap-5 cursor-pointer flex-1 text-left"
                onClick={() => setEditingCardId(editingCardId === card.id ? null : card.id)}
              >
                <div className="w-16 h-24 bg-forest-bg rounded-xl overflow-hidden flex-shrink-0 border border-forest-accent/10 shadow-inner">
                  <img 
                    src={getCardImageUrl(card.id)} 
                    alt={card.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xl font-serif text-forest-ink truncate">{card.name}</h4>
                  <p className="text-[10px] text-forest-muted uppercase tracking-widest truncate mb-2">{card.english}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.astrology?.planet && <span className="text-[8px] px-2 py-0.5 bg-forest-accent/5 rounded-full text-forest-accent border border-forest-accent/10">{card.astrology.planet}</span>}
                    {card.astrology?.zodiac && <span className="text-[8px] px-2 py-0.5 bg-forest-accent/5 rounded-full text-forest-accent border border-forest-accent/10">{card.astrology.zodiac}</span>}
                    {card.astrology?.element && <span className="text-[8px] px-2 py-0.5 bg-forest-accent/5 rounded-full text-forest-accent border border-forest-accent/10">{card.astrology.element}</span>}
                  </div>
                  {insights.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[9px] text-forest-accent font-bold">
                      <Sparkles size={10} />
                      <span>{insights.length} 条研习记录</span>
                    </div>
                  )}
                  {personalKeywordStats.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {personalKeywordStats.slice(0, 3).map(item => (
                        <span key={item.keyword} className="text-[8px] px-2 py-0.5 bg-forest-pink/10 rounded-full text-forest-pink border border-forest-pink/10">
                          {item.keyword} ×{item.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight 
                  size={20} 
                  className={`text-forest-muted transition-transform ${editingCardId === card.id ? 'rotate-90' : ''}`} 
                />
              </button>

              <AnimatePresence>
                {editingCardId === card.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-forest-accent/5 bg-forest-bg/30"
                  >
                    <div className="p-5 space-y-6">
                      {/* Full Annotation Editor Button */}
                      <button
                        onClick={() => {
                          setAnnotationEditorCardId(card.id);
                          setShowAnnotationEditor(true);
                        }}
                        className="w-full min-h-12 bg-gradient-to-r from-forest-accent/10 to-forest-pink/10 text-forest-accent rounded-xl font-bold text-sm hover:from-forest-accent/20 hover:to-forest-pink/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Edit3 size={16} />
                        编辑这张牌义
                      </button>

                      {/* Numerology Card */}
                      <CardNumerologyCard 
                        cardName={card.name} 
                        isLoggedIn={isLoggedIn || false} 
                        userId={userId} 
                      />

                      {personalKeywordStats.length > 0 && (
                        <div className="space-y-3 rounded-[1.5rem] bg-white border border-forest-pink/10 p-4 shadow-sm">
                          <h5 className="text-[10px] font-bold text-forest-pink uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={12} />
                            高频理解
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {personalKeywordStats.map(item => (
                              <button
                                key={item.keyword}
                                type="button"
                                onClick={() => appendKeywordToPersonalMeaning(card.name, item.keyword)}
                                className="min-h-11 px-3 py-2 rounded-full bg-forest-pink/5 text-forest-pink border border-forest-pink/10 text-xs font-bold flex items-center gap-1.5 hover:bg-forest-pink/10 transition-colors"
                              >
                                <Plus size={12} />
                                <span>{item.keyword}</span>
                                <span className="text-[9px] opacity-70">×{item.count}</span>
                              </button>
                            ))}
                          </div>
                          {personalKeywordStats[0]?.examples[0] && (
                            <p className="text-[11px] text-forest-muted leading-relaxed bg-forest-bg/50 rounded-xl px-3 py-2">
                              “{personalKeywordStats[0].examples[0]}”
                            </p>
                          )}
                        </div>
                      )}

                      {/* Personal Meaning Editor */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[10px] font-bold text-forest-accent uppercase tracking-widest flex items-center gap-2">
                            <Book size={12} />
                            我的牌义笔记
                          </h5>
                          <button 
                            onClick={() => savePersonalMeaning(card.name)}
                            disabled={isSaving}
                            className="min-h-11 px-3 -mr-3 rounded-xl text-[10px] font-bold text-forest-pink hover:bg-forest-pink/5 transition-colors flex items-center gap-1"
                          >
                            <Save size={10} /> 保存笔记
                          </button>
                        </div>
                        <textarea 
                          className="w-full px-4 py-3 bg-white border border-forest-accent/10 rounded-2xl text-xs focus:ring-2 focus:ring-forest-accent/20 min-h-[100px] resize-none shadow-inner leading-relaxed"
                          placeholder="在此记录你对这张牌的独特见解、私人感悟或研习心得..."
                          value={personalMeanings[card.name] || ''}
                          onChange={e => handlePersonalMeaningChange(card.name, e.target.value)}
                        />
                      </div>

                      {/* Astrology Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">行星</label>
                          <input 
                            className="w-full min-h-11 px-3 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
                            value={card.astrology?.planet || ''}
                            onChange={e => handleCardChange(card.id, 'planet', e.target.value)}
                            placeholder="无"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">星座</label>
                          <input 
                            className="w-full min-h-11 px-3 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
                            value={card.astrology?.zodiac || ''}
                            onChange={e => handleCardChange(card.id, 'zodiac', e.target.value)}
                            placeholder="无"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">先天宫位</label>
                          <input 
                            className="w-full min-h-11 px-3 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
                            value={card.astrology?.house || ''}
                            onChange={e => handleCardChange(card.id, 'house', e.target.value)}
                            placeholder="无"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-forest-muted uppercase tracking-wider">四元素</label>
                          <input 
                            className="w-full min-h-11 px-3 py-2 bg-white border border-forest-accent/10 rounded-xl text-xs focus:ring-2 focus:ring-forest-accent/20"
                            value={card.astrology?.element || ''}
                            onChange={e => handleCardChange(card.id, 'element', e.target.value)}
                            placeholder="无"
                          />
                        </div>
                      </div>

                      {/* User Insights Section */}
                      <div className="space-y-3">
                        <h5 className="text-[10px] font-bold text-forest-accent uppercase tracking-widest flex items-center gap-2">
                          <History size={12} />
                          研习历程
                        </h5>
                        {insights.length > 0 ? (
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {insights.map((item, idx) => (
                              <div key={idx} className="p-4 bg-white rounded-2xl border border-forest-accent/5 shadow-sm space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-forest-accent/10 text-forest-accent rounded-lg">
                                      <Calendar size={12} />
                                    </div>
                                    <span className="text-[10px] text-forest-muted font-medium">{new Date(item.date).toLocaleDateString()}</span>
                                  </div>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${item.isReversed ? 'bg-red-50 text-red-400 border border-red-100' : 'bg-forest-accent/10 text-forest-accent border border-forest-accent/20'}`}>
                                    {item.isReversed ? '逆位' : '正位'}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-forest-muted font-bold flex items-center gap-1">
                                    <MessageSquare size={10} /> 问题摘要
                                  </p>
                                  <p className="text-xs text-forest-ink font-medium line-clamp-1">{item.question}</p>
                                </div>
                                <div className="p-3 bg-forest-bg/30 rounded-xl border border-forest-accent/5">
                                  <p className="text-xs text-forest-ink/80 leading-relaxed italic">“ {item.insight} ”</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white/50 rounded-xl border border-dashed border-forest-accent/10">
                            <p className="text-[10px] text-forest-muted">尚无对此牌的研习记录</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-forest-accent/5 shadow-inner">
          <Info size={48} className="mx-auto mb-4 opacity-10 text-forest-accent" />
          <p className="text-forest-muted">典籍中未见此牌踪迹</p>
        </div>
      )}

      {/* Card Annotation Editor Modal */}
      <CardAnnotationEditor 
        isOpen={showAnnotationEditor}
        onClose={() => {
          setShowAnnotationEditor(false);
          refreshModifiedCount();
        }}
        initialCardId={annotationEditorCardId}
        onAnnotationsUpdated={refreshModifiedCount}
      />
    </div>
  );
}
