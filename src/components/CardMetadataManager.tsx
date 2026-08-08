import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Save, RotateCcw, ChevronRight, Book, Sparkles, History, Pencil, Hash, Plus, Edit3, Download, FileText, Table2, LayoutGrid, List } from 'lucide-react';
import { CardKeywordMemory, DailyFortune, TarotCardMetadata, TarotReading } from '../types';
import { getCardImageUrl, TAROT_CARDS } from '../constants';
import { useCardNumerology } from '../hooks/useCardNumerology';
import { getCardAnnotations, saveCardAnnotation } from '../lib/firebaseData';
import { cardMatchesSearch } from '../lib/cardSearch';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { CardAnnotationEditor } from './CardAnnotationEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { TarotCardImage } from './TarotCardImage';
import { readJsonRecordWithBackup, writeJsonWithBackup } from '../lib/safeLocalStorage';
import {
  getCurrentMonthKey,
  getDailyFortunesByCard,
  getSavedDailyFortuneExamples,
} from '../lib/dailyFortuneReview';
import { getDailyReflectionParts } from '../lib/dailyFortuneReflection';
import {
  buildCardLibraryPdfLines,
  CardLibraryExportItem,
  CardLibraryExportScope,
  exportCardLibraryToCsv,
  exportCardLibraryToMarkdown,
  getCardLibraryExportBaseName,
  getCardLibraryScopeLabel,
} from '../lib/cardLibraryExport';
import { createExportPdfBlobFromLines } from '../lib/pdfExport';
import { useClickOutside } from '../hooks/useClickOutside';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { MysticWatermark } from './MysticWatermark';
import { QuietEmptyState } from './ui/SoftUI';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';

interface CardMetadataManagerProps {
  metadata: TarotCardMetadata[];
  onUpdate: (updated: TarotCardMetadata[]) => void;
  readings: TarotReading[];
  dailyFortunes?: DailyFortune[];
  cardKeywordMemory?: CardKeywordMemory[];
  onShowSnackbar?: (message: string) => void;
  isLoggedIn?: boolean;
  userId?: string;
  initialCardId?: string;
  ownerName?: string;
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

const getArcanaLabel = (cardId: string) => (
  cardId.startsWith('ar') ? '大阿尔卡纳' : '小阿尔卡纳'
);

const getSuitLabel = (cardId: string) => {
  if (cardId.startsWith('wa')) return '权杖';
  if (cardId.startsWith('cu')) return '圣杯';
  if (cardId.startsWith('sw')) return '宝剑';
  if (cardId.startsWith('pe')) return '星币';
  return '';
};

const uniqueTexts = (items: Array<string | undefined | null>) => (
  Array.from(new Set(items.map(item => item?.trim()).filter(Boolean) as string[]))
);

const downloadTextFile = (filename: string, content: string, type: string) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadBlobFile = (filename: string, blob: Blob) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
      <div className="space-y-3 rounded-[1.2rem] border border-forest-accent/8 bg-white/46 p-3 sm:space-y-4 sm:rounded-[1.45rem] sm:p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-forest-accent">
            <Hash size={14} /> 编辑灵数注解
          </span>
        </div>
        
        <div className="space-y-2">
          <label className="text-[9px] font-medium uppercase tracking-wider text-forest-muted">数字设定</label>
          <div className="flex flex-wrap gap-2">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => setTempVal(opt)}
                className={`h-11 w-11 rounded-lg text-xs font-medium transition-all ${
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
              className="w-full rounded-xl border border-forest-accent/10 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-forest-accent/20 sm:px-4"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-medium uppercase tracking-wider text-forest-muted">灵数含义</label>
          <input 
            type="text"
            value={tempMeaning}
            onChange={e => setTempMeaning(e.target.value)}
            placeholder="输入该灵数的象征意义..."
            className="w-full rounded-xl border border-forest-accent/10 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-forest-accent/20 sm:px-4"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-medium uppercase tracking-wider text-forest-muted">关键词 (逗号分隔)</label>
          <input 
            type="text"
            value={tempKeywords}
            onChange={e => setTempKeywords(e.target.value)}
            placeholder="例如：创造, 领导力, 开端..."
            className="w-full rounded-xl border border-forest-accent/10 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-forest-accent/20 sm:px-4"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={async () => {
              const valToSave = tempVal === '' ? 0 : Number(tempVal);
              await saveNumerology(valToSave, tempMeaning, tempKeywords);
              setIsEditing(false);
            }}
            className="min-h-11 flex-1 rounded-xl bg-forest-accent py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            保存
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="min-h-11 flex-1 rounded-xl border border-forest-accent/8 bg-white/46 py-2 text-xs font-medium text-forest-muted transition-colors hover:bg-forest-bg"
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
    <div className="group relative rounded-[1.2rem] border border-forest-accent/8 bg-forest-accent/5 p-3 sm:rounded-[1.45rem] sm:p-5">
      <button 
        onClick={() => setIsEditing(true)}
        className="absolute top-3 right-3 min-h-11 min-w-11 p-2 text-forest-muted hover:text-forest-accent transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center rounded-xl hover:bg-white/70"
        aria-label="编辑灵数注解"
      >
        <Pencil size={14} />
      </button>

      <div className="space-y-2.5 pr-10 sm:space-y-3 sm:pr-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-serif text-sm font-semibold text-forest-accent">
            🔢 灵数注解
          </span>
          {isCustom && <span className="rounded border border-forest-accent/20 bg-forest-accent/10 px-1.5 py-0.5 text-[8px] font-medium text-forest-accent">自定义</span>}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-baseline gap-2">
            <span className="w-10 text-[10px] font-medium uppercase tracking-wider text-forest-muted">数字:</span>
            <span className={`text-sm font-semibold ${numerology !== null ? 'text-forest-accent' : 'text-forest-muted italic'}`}>
              {numerology !== null ? numerology : '未设置'}
            </span>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="w-10 text-[10px] font-medium uppercase tracking-wider text-forest-muted">含义:</span>
            <span className={`text-xs ${meaning ? 'text-forest-text' : 'text-forest-muted italic'}`}>
              {meaning || '点击编辑，添加你的灵数注解'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="w-10 text-[10px] font-medium uppercase tracking-wider text-forest-muted">关键词:</span>
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

export function CardMetadataManager({ metadata, onUpdate, readings, dailyFortunes = [], cardKeywordMemory = [], onShowSnackbar, isLoggedIn, userId, initialCardId, ownerName = '见习阁主' }: CardMetadataManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [localMetadata, setLocalMetadata] = useState<TarotCardMetadata[]>(() => buildCardLibrary(metadata));
  const [filterType, setFilterType] = useState<'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'>('all');
  const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>('grid');
  const [personalMeanings, setPersonalMeanings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [annotationEditorCardId, setAnnotationEditorCardId] = useState<string | undefined>(undefined);
  const [modifiedCount, setModifiedCount] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const closeExportMenu = useCallback(() => setIsExportMenuOpen(false), []);
  useClickOutside(exportMenuRef, closeExportMenu, isExportMenuOpen);
  const currentMonthKey = getCurrentMonthKey();
  const dailyFortuneGroups = useMemo(
    () => getDailyFortunesByCard(dailyFortunes, currentMonthKey),
    [currentMonthKey, dailyFortunes],
  );
  const dailyFortuneGroupMap = useMemo(
    () => new Map(dailyFortuneGroups.map(group => [group.cardName, group])),
    [dailyFortuneGroups],
  );
  const readingCountByCardName = useMemo(() => {
    const counts = new Map<string, number>();
    readings
      .filter(reading => !reading.isExample)
      .forEach(reading => {
        reading.cards.forEach(card => {
          const name = card.name?.trim();
          if (!name) return;
          counts.set(name, (counts.get(name) || 0) + 1);
        });
      });
    return counts;
  }, [readings]);

  useEffect(() => {
    setLocalMetadata(buildCardLibrary(metadata));
  }, [metadata]);
  
  useEffect(() => {
    setModifiedCount(cardAnnotationService.getModifiedCardIds().length);
  }, [showAnnotationEditor]);

  useEffect(() => {
    if (!initialCardId) return;

    setAnnotationEditorCardId(initialCardId);
    setShowAnnotationEditor(true);
  }, [initialCardId]);

  const refreshModifiedCount = () => {
    setModifiedCount(cardAnnotationService.getModifiedCardIds().length);
  };

  const handleOpenCard = useCallback((cardId: string) => {
    setDetailCardId(cardId);
  }, []);

  const handleToggleCardDetails = useCallback((cardId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setDetailCardId(cardId);
  }, []);
  
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
        setPersonalMeanings(readJsonRecordWithBackup<Record<string, string>>('tarot_personal_meanings') || {});
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

  const exportItems = useMemo<CardLibraryExportItem[]>(() => (
    localMetadata.map(card => {
      const annotation = cardAnnotationService.getMergedAnnotation(card.id);
      const hasUserAnnotation = cardAnnotationService.hasUserModification(card.id);
      const astrology = {
        planet: hasUserAnnotation ? annotation.planet || card.astrology?.planet : card.astrology?.planet || annotation.planet || undefined,
        zodiac: hasUserAnnotation ? annotation.zodiac || card.astrology?.zodiac : card.astrology?.zodiac || annotation.zodiac || undefined,
        house: hasUserAnnotation ? annotation.house || card.astrology?.house : card.astrology?.house || annotation.house || undefined,
        element: hasUserAnnotation ? annotation.element || card.astrology?.element : card.astrology?.element || annotation.element || undefined,
      };
      const dailyFortuneGroup = dailyFortuneGroupMap.get(card.name);
      const personalNoteBlocks = [
        annotation.personalNotes,
        personalMeanings[card.name],
      ].map(text => text?.trim()).filter(Boolean);

      return {
        card: {
          ...card,
          astrology,
        },
        arcanaLabel: getArcanaLabel(card.id),
        suitLabel: getSuitLabel(card.id),
        numerology: annotation.numerology || (card.default_numerology === null || card.default_numerology === undefined ? '' : String(card.default_numerology)),
        keywords: uniqueTexts([...(annotation.keywords || []), ...(card.keywords || [])]),
        uprightMeaning: annotation.uprightMeaning || card.meaning || '',
        reversedMeaning: annotation.reversedMeaning || card.reversedMeaning || '',
        personalNotes: personalNoteBlocks.join('\n\n'),
        readingCount: readingCountByCardName.get(card.name) || 0,
        dailyFortuneTotal: dailyFortuneGroup?.totalCount || 0,
        dailyFortuneCurrentMonth: dailyFortuneGroup?.currentMonthCount || 0,
        dailyFortuneSavedExamples: dailyFortuneGroup?.savedToAnnotationCount || 0,
      };
    })
  ), [dailyFortuneGroupMap, localMetadata, personalMeanings, readingCountByCardName, modifiedCount]);

  const exportItemById = useMemo(
    () => new Map(exportItems.map(item => [item.card.id, item])),
    [exportItems],
  );

  const filteredExportItems = useMemo(
    () => filteredCards.map(card => exportItemById.get(card.id)).filter(Boolean) as CardLibraryExportItem[],
    [exportItemById, filteredCards],
  );

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

  const detailCard = useMemo(
    () => localMetadata.find(card => card.id === detailCardId) || null,
    [detailCardId, localMetadata],
  );
  const detailInsights = useMemo(
    () => (detailCard ? getDetailedInsights(detailCard.name) : []),
    [detailCard, readings],
  );
  const detailKeywordStats = useMemo(
    () => (detailCard ? getCardKeywordMemory(detailCard.name).slice(0, 8) : []),
    [detailCard, cardKeywordMemory],
  );
  const detailDailyFortuneGroup = detailCard ? dailyFortuneGroupMap.get(detailCard.name) : undefined;
  const detailDailyFortuneExamples = getSavedDailyFortuneExamples(detailDailyFortuneGroup?.fortunes || []);
  const detailDailyFortuneHistory = detailDailyFortuneGroup?.fortunes || [];
  const closeCardDetail = useCallback(() => {
    setDetailCardId(null);
  }, []);

  useBodyScrollLock(Boolean(detailCard));

  useEffect(() => {
    if (!detailCard) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCardDetail();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCardDetail, detailCard]);

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
      writeJsonWithBackup('tarot_personal_meanings', updated);
    }

    if (onShowSnackbar) {
      onShowSnackbar(`阁主为《${cardName}》添注一则，注疏见深。`);
    }
    setIsSaving(false);
  };

  const saveAll = () => {
    onUpdate(localMetadata);
    if (onShowSnackbar) {
      onShowSnackbar('已录入阁中典籍。');
    }
  };

  const handleExportCards = (scope: CardLibraryExportScope, format: 'pdf' | 'csv' | 'markdown') => {
    const items = scope === 'all' ? exportItems : filteredExportItems;
    const scopeLabel = getCardLibraryScopeLabel(scope, items.length);
    if (items.length === 0) {
      const message = '当前没有可导出的牌。';
      setExportStatus(message);
      onShowSnackbar?.(message);
      setIsExportMenuOpen(false);
      return;
    }

    const fileBaseName = getCardLibraryExportBaseName(ownerName);

    try {
      if (format === 'pdf') {
        const blob = createExportPdfBlobFromLines(buildCardLibraryPdfLines(items, ownerName, scopeLabel));
        downloadBlobFile(`${fileBaseName}.pdf`, blob);
      } else if (format === 'csv') {
        downloadTextFile(
          `${fileBaseName}.csv`,
          `\ufeff${exportCardLibraryToCsv(items)}`,
          'text/csv;charset=utf-8',
        );
      } else {
        downloadTextFile(
          `${fileBaseName}.md`,
          exportCardLibraryToMarkdown(items, ownerName, scopeLabel),
          'text/markdown;charset=utf-8',
        );
      }

      const label = format === 'pdf' ? 'PDF' : format === 'csv' ? '表格' : 'Markdown';
      const message = `已开始下载${scopeLabel}的${label}。`;
      setExportStatus(message);
      onShowSnackbar?.(message);
      setIsExportMenuOpen(false);
    } catch (error) {
      console.warn('Failed to export card library:', error);
      const message = '导出失败，请稍后再试。';
      setExportStatus(message);
      onShowSnackbar?.(message);
    }
  };

  const resetAll = () => {
    setShowResetConfirm(true);
  };

  return (
    <div className="space-y-3 pb-12 sm:space-y-5 sm:pb-20">
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="重置本地编辑"
        message="确定要重置所有修改吗？这将丢失您当前尚未保存的本地编辑。"
        confirmText="重置"
        destructive
        onConfirm={() => setLocalMetadata(buildCardLibrary(metadata))}
        onClose={() => setShowResetConfirm(false)}
      />

      <div className="ancient-book-bg relative overflow-hidden space-y-1.5 rounded-[1.15rem] border border-forest-accent/6 p-2 shadow-[0_12px_42px_-42px_rgba(62,58,54,0.45)] sm:space-y-4 sm:rounded-[1.6rem] sm:p-6">
        <MysticWatermark variant="book" className="-right-8 -top-10 h-32 w-32 text-forest-accent opacity-[0.028] sm:h-44 sm:w-44 sm:opacity-[0.035]" />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-accent/8 text-forest-accent sm:h-12 sm:w-12 sm:rounded-2xl">
              <Book size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-semibold text-forest-accent sm:text-3xl">塔罗牌库</h2>
              <p className="text-[10px] text-forest-muted font-kai italic sm:text-xs">78 张牌 · 牌义笔记</p>
              {modifiedCount > 0 && (
                <p className="mt-0.5 text-[10px] font-medium text-forest-pink sm:mt-1 sm:text-xs">
                  已自定义 {modifiedCount} 张牌的注解
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-4 gap-1 sm:flex sm:items-center sm:justify-end sm:gap-2">
            <button 
              onClick={() => {
                setAnnotationEditorCardId(undefined);
                setShowAnnotationEditor(true);
              }}
              aria-label="批量编辑单牌牌义"
                className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-accent/86 px-2 text-[11px] font-medium text-white transition-colors hover:bg-forest-accent sm:px-4 sm:text-sm"
            >
              <Edit3 size={14} /> 批量
            </button>
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-forest-pink/80 px-2 text-[11px] font-medium text-white transition-all hover:bg-forest-pink sm:w-auto sm:gap-2 sm:rounded-full sm:px-5 sm:text-sm"
                aria-expanded={isExportMenuOpen}
                aria-haspopup="menu"
                aria-label="撰录成册"
              >
                <Download size={14} /> 成册
              </button>
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[1.2rem] border border-forest-accent/7 bg-white/88 p-3 text-left shadow-[0_16px_44px_-36px_rgba(62,58,54,0.52)] backdrop-blur-md"
                    role="menu"
                  >
                    <div className="mb-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest-muted">导出牌义注疏</p>
                      <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                        可导出当前筛选，也可导出完整 78 张牌库。
                      </p>
                    </div>
                    {([
                      { scope: 'current' as const, label: getCardLibraryScopeLabel('current', filteredExportItems.length) },
                      { scope: 'all' as const, label: getCardLibraryScopeLabel('all', exportItems.length) },
                    ]).filter((_, index) => index === 0 || filteredExportItems.length !== exportItems.length).map(item => (
                      <div key={item.scope} className="space-y-2 border-t border-forest-accent/8 py-2 first:border-t-0">
                        <p className="text-[11px] font-medium text-forest-ink">{item.label}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportCards(item.scope, 'pdf')}
                            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-forest-accent/8 px-2 text-[11px] font-medium text-forest-accent transition-colors hover:bg-forest-accent/14"
                            role="menuitem"
                          >
                            <FileText size={14} /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCards(item.scope, 'csv')}
                            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-forest-bg/70 px-2 text-[11px] font-medium text-forest-ink transition-colors hover:bg-forest-accent/8"
                            role="menuitem"
                          >
                            <Table2 size={14} /> 表格
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCards(item.scope, 'markdown')}
                            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-forest-bg/70 px-2 text-[11px] font-medium text-forest-ink transition-colors hover:bg-forest-accent/8"
                            role="menuitem"
                          >
                            <Book size={14} /> MD
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={resetAll}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-forest-accent/7 bg-white/36 px-2 text-[11px] font-medium text-forest-muted transition-colors hover:bg-forest-accent/5 hover:text-forest-accent sm:gap-2 sm:px-4 sm:text-sm"
            >
              <RotateCcw size={14} /> 重置
            </button>
            <button 
              onClick={saveAll}
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-forest-accent/8 bg-white/56 px-2 text-[11px] font-medium text-forest-accent transition-colors hover:bg-forest-accent/5 sm:gap-2 sm:px-4 sm:text-sm"
            >
              <Save size={14} /> 保存
            </button>
        </div>
        {exportStatus && (
          <p className="rounded-2xl border border-forest-accent/8 bg-white/42 px-3 py-2 text-xs text-forest-muted">
            {exportStatus}
          </p>
        )}

        <div className="relative flex flex-nowrap items-center gap-1.5 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted sm:left-4" size={16} />
            <input 
              type="text" 
              placeholder="搜索牌名..."
              className="h-11 w-full rounded-xl border border-forest-accent/8 bg-white/62 pl-9 pr-3 text-xs shadow-none focus:ring-2 focus:ring-forest-accent/18 sm:h-auto sm:rounded-2xl sm:py-3 sm:pl-12 sm:pr-4 sm:text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 rounded-xl border border-forest-accent/8 bg-white/42 p-0.5 sm:rounded-2xl">
            {([
              { id: 'grid' as const, label: '网格', icon: LayoutGrid },
              { id: 'list' as const, label: '列表', icon: List },
            ]).map(option => {
              const Icon = option.icon;
              const active = libraryViewMode === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLibraryViewMode(option.id)}
                  aria-pressed={active}
                  aria-label={option.label}
                  className={`flex h-11 min-w-10 items-center justify-center gap-1 rounded-xl px-1.5 text-[10px] font-medium transition-all sm:min-w-0 sm:px-3 ${
                    active
                      ? 'bg-forest-accent/88 text-white'
                      : 'text-forest-muted hover:bg-white/60 hover:text-forest-accent'
                  }`}
                >
                  <Icon size={12} />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(['all', 'major', 'wands', 'cups', 'swords', 'pentacles'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`min-h-11 whitespace-nowrap rounded-full border px-3 text-[10px] font-medium tracking-[0.08em] transition-all sm:px-4 sm:py-2 ${
                  filterType === type 
                    ? 'bg-forest-accent/90 text-white border-forest-accent/70'
                    : 'bg-white/58 text-forest-muted border-forest-accent/8 hover:bg-forest-accent/5'
                }`}
              >
                {type === 'all' ? '全部' : type === 'major' ? '大牌' : type === 'wands' ? '权杖' : type === 'cups' ? '圣杯' : type === 'swords' ? '宝剑' : '星币'}
              </button>
            ))}
        </div>
      </div>

      <div className={
        libraryViewMode === 'grid'
          ? 'grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4 sm:gap-3'
          : 'grid grid-cols-1 gap-2.5 md:grid-cols-2 sm:gap-3'
      }>
        {filteredCards.map(card => {
          const insights = getDetailedInsights(card.name);
          const personalKeywordStats = getCardKeywordMemory(card.name).slice(0, 8);
          const dailyFortuneGroup = dailyFortuneGroupMap.get(card.name);
          return (
            <motion.div 
              key={card.id}
              className={`relative flex flex-col overflow-hidden border border-forest-accent/6 bg-white/58 shadow-none transition-all hover:border-forest-accent/18 ${
                libraryViewMode === 'grid' ? 'rounded-[1rem] sm:rounded-[1.2rem]' : 'rounded-[1.15rem] sm:rounded-[1.35rem]'
              }`}
            >
              <div
                className={`flex w-full items-stretch ${
                  libraryViewMode === 'grid'
                    ? 'flex-col'
                    : 'flex-row'
                }`}
              >
              <button
                type="button"
                className={`flex min-w-0 flex-1 cursor-pointer text-left ${
                  libraryViewMode === 'grid'
                    ? 'flex-col items-center gap-1.5 p-2 text-center sm:gap-2 sm:p-3'
                    : 'items-center gap-3 p-3 pr-1 sm:gap-4 sm:p-4 sm:pr-2'
                }`}
                onClick={() => handleOpenCard(card.id)}
              >
                <div className={`flex-shrink-0 overflow-hidden border border-forest-accent/10 bg-forest-bg shadow-inner ${
                  libraryViewMode === 'grid'
                    ? 'h-20 w-[3.35rem] rounded-lg sm:h-28 sm:w-[4.5rem] sm:rounded-xl'
                    : 'h-20 w-14 rounded-xl sm:h-24 sm:w-16'
                }`}>
                  <TarotCardImage
                    src={getCardImageUrl(card.id)} 
                    alt={card.name} 
                    name={card.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className={`min-w-0 ${libraryViewMode === 'grid' ? 'w-full' : 'flex-1'}`}>
                  <h4 className={`${libraryViewMode === 'grid' ? 'text-center text-[13px] leading-snug sm:text-base' : 'truncate text-base sm:text-lg'} font-serif font-semibold text-forest-ink`}>{card.name}</h4>
                  <p className={`${libraryViewMode === 'grid' ? 'text-center' : ''} mb-1 truncate text-[8px] uppercase tracking-widest text-forest-muted sm:mb-2 sm:text-[10px]`}>{card.english}</p>
                  <div className={`flex flex-wrap gap-1 ${libraryViewMode === 'grid' ? 'justify-center' : ''}`}>
                    {card.astrology?.planet && <span className="rounded-full border border-forest-accent/10 bg-forest-accent/5 px-1.5 py-0.5 text-[7.5px] text-forest-accent sm:px-2 sm:text-[8px]">{card.astrology.planet}</span>}
                    {card.astrology?.zodiac && <span className="rounded-full border border-forest-accent/10 bg-forest-accent/5 px-1.5 py-0.5 text-[7.5px] text-forest-accent sm:px-2 sm:text-[8px]">{card.astrology.zodiac}</span>}
                    {card.astrology?.element && <span className="rounded-full border border-forest-accent/10 bg-forest-accent/5 px-1.5 py-0.5 text-[7.5px] text-forest-accent sm:px-2 sm:text-[8px]">{card.astrology.element}</span>}
                  </div>
                  {insights.length > 0 && (
                    <div className={`mt-1 flex items-center gap-1 text-[8.5px] font-medium text-forest-accent sm:mt-2 sm:text-[9px] ${
                      libraryViewMode === 'grid' ? 'justify-center' : ''
                    }`}>
                      <Sparkles size={10} />
                      <span>{insights.length} 条研习记录</span>
                    </div>
                  )}
                  {dailyFortuneGroup && (
                    <div className={`mt-1 flex flex-wrap gap-1 sm:mt-2 ${
                      libraryViewMode === 'grid' ? 'justify-center' : ''
                    }`}>
                      <span className="rounded-full border border-forest-accent/10 bg-forest-accent/10 px-1.5 py-0.5 text-[7.5px] text-forest-accent sm:px-2 sm:text-[8px]">
                        日运 ×{dailyFortuneGroup.totalCount}
                      </span>
                      {dailyFortuneGroup.currentMonthCount > 0 && (
                        <span className="rounded-full border border-forest-accent/10 bg-forest-bg px-1.5 py-0.5 text-[7.5px] text-forest-muted sm:px-2 sm:text-[8px]">
                          本月 ×{dailyFortuneGroup.currentMonthCount}
                        </span>
                      )}
                      {dailyFortuneGroup.savedToAnnotationCount > 0 && (
                        <span className="rounded-full border border-forest-pink/10 bg-forest-pink/10 px-1.5 py-0.5 text-[7.5px] text-forest-pink sm:px-2 sm:text-[8px]">
                          例证 ×{dailyFortuneGroup.savedToAnnotationCount}
                        </span>
                      )}
                    </div>
                  )}
                  {personalKeywordStats.length > 0 && (
                    <div className="mt-1.5 hidden flex-wrap gap-1 sm:mt-2 sm:flex">
                      {personalKeywordStats.slice(0, 3).map(item => (
                        <span key={item.keyword} className="text-[8px] px-2 py-0.5 bg-forest-pink/10 rounded-full text-forest-pink border border-forest-pink/10">
                          {item.keyword} ×{item.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={event => handleToggleCardDetails(card.id, event)}
                aria-label={`查看${card.name}研习资料`}
                className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center text-forest-muted transition-colors hover:bg-forest-accent/5 hover:text-forest-accent ${
                  libraryViewMode === 'grid'
                    ? 'absolute bottom-1 right-1 rounded-full bg-white/44 text-[10px]'
                    : 'rounded-l-none rounded-r-[1.15rem] sm:rounded-r-[1.35rem]'
                }`}
              >
                <ChevronRight
                  size={18}
                  className="transition-transform"
                />
                <span className="sr-only">研习资料</span>
              </button>
              </div>

            </motion.div>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <QuietEmptyState
          icon={<Book size={24} />}
          title="典籍中暂时没有匹配的牌"
          description="换一个牌类或关键词，再看看这页书。"
          className="py-8 sm:py-12"
        />
      )}

      <AnimatePresence>
        {detailCard && (
          <motion.div
            className="fixed inset-0 z-[500] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="关闭牌义详情"
              className="absolute inset-0 bg-forest-ink/18 backdrop-blur-[3px]"
              onClick={closeCardDetail}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label={`${detailCard.name}研习资料`}
              initial={{ y: 36, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 28, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.6rem] border border-forest-accent/10 bg-[#FFFCF7]/95 shadow-[0_24px_70px_-38px_rgba(62,58,54,0.65)] backdrop-blur-md sm:max-h-[84vh] sm:rounded-[1.7rem]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-forest-accent/8 bg-[#FFFCF7]/90 p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-forest-accent/12 bg-forest-bg shadow-inner">
                    <TarotCardImage
                      src={getCardImageUrl(detailCard.id)}
                      alt={detailCard.name}
                      name={detailCard.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest-accent">牌义注疏</p>
                    <h3 className="font-serif text-xl font-semibold leading-tight text-forest-ink sm:text-2xl">{detailCard.name}</h3>
                    <p className="truncate text-[10px] uppercase tracking-[0.18em] text-forest-muted">{detailCard.english}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {detailCard.astrology?.planet && (
                        <span className="rounded-full border border-forest-accent/10 bg-forest-accent/6 px-2 py-0.5 text-[9px] text-forest-accent">{detailCard.astrology.planet}</span>
                      )}
                      {detailCard.astrology?.zodiac && (
                        <span className="rounded-full border border-forest-accent/10 bg-forest-accent/6 px-2 py-0.5 text-[9px] text-forest-accent">{detailCard.astrology.zodiac}</span>
                      )}
                      {detailCard.astrology?.element && (
                        <span className="rounded-full border border-forest-accent/10 bg-forest-accent/6 px-2 py-0.5 text-[9px] text-forest-accent">{detailCard.astrology.element}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCardDetail}
                  aria-label="关闭牌义详情"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-forest-muted transition-colors hover:bg-forest-accent/8 hover:text-forest-ink"
                >
                  ×
                </button>
              </div>

              <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-4 sm:p-4">
                <button
                  type="button"
                  onClick={() => {
                    setAnnotationEditorCardId(detailCard.id);
                    setShowAnnotationEditor(true);
                    closeCardDetail();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest-accent/9 to-forest-pink/9 text-xs font-medium text-forest-accent transition-colors hover:from-forest-accent/14 hover:to-forest-pink/14"
                >
                  <Edit3 size={15} />
                  编辑这张牌义
                </button>

                <CardNumerologyCard
                  cardName={detailCard.name}
                  isLoggedIn={isLoggedIn || false}
                  userId={userId}
                />

                {detailKeywordStats.length > 0 && (
                  <section className="space-y-2 rounded-[1.2rem] border border-forest-pink/8 bg-white/40 p-3">
                    <h4 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-forest-pink">
                      <Sparkles size={12} />
                      高频理解
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {detailKeywordStats.map(item => (
                        <button
                          key={item.keyword}
                          type="button"
                          onClick={() => appendKeywordToPersonalMeaning(detailCard.name, item.keyword)}
                          className="flex min-h-10 items-center gap-1.5 rounded-full border border-forest-pink/10 bg-forest-pink/5 px-3 py-1.5 text-[11px] font-medium text-forest-pink transition-colors hover:bg-forest-pink/10"
                        >
                          <Plus size={12} />
                          {item.keyword}
                          <span className="text-[9px] opacity-70">×{item.count}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-2 rounded-[1.2rem] border border-forest-accent/8 bg-white/42 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-forest-accent">
                      <Book size={12} />
                      我的牌义笔记
                    </h4>
                    <button
                      type="button"
                      onClick={() => savePersonalMeaning(detailCard.name)}
                      disabled={isSaving}
                      className="flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[10px] font-medium text-forest-pink transition-colors hover:bg-forest-pink/5 disabled:opacity-50"
                    >
                      <Save size={10} />
                      保存
                    </button>
                  </div>
                  <AutoResizeTextarea
                    minRows={2}
                    maxRows={8}
                    className="w-full rounded-xl border border-forest-accent/8 bg-white/62 px-3 py-2.5 text-xs leading-relaxed shadow-none focus:ring-2 focus:ring-forest-accent/18"
                    placeholder="在此记录你对这张牌的独特见解、私人感悟或研习心得..."
                    value={personalMeanings[detailCard.name] || ''}
                    onChange={e => handlePersonalMeaningChange(detailCard.name, e.target.value)}
                  />
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-[1.2rem] border border-forest-accent/8 bg-white/38 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-forest-accent">
                        <Sparkles size={12} />
                        日运例证
                      </h4>
                      {detailDailyFortuneExamples.length > 0 && (
                        <span className="rounded-full bg-forest-accent/10 px-2 py-0.5 text-[9px] font-medium text-forest-accent">
                          {detailDailyFortuneExamples.length} 条
                        </span>
                      )}
                    </div>
                    {detailDailyFortuneExamples.length > 0 ? (
                      <div className="custom-scrollbar max-h-44 space-y-2 overflow-y-auto pr-1">
                        {detailDailyFortuneExamples.map(fortune => {
                          const parts = getDailyReflectionParts(fortune);
                          return (
                            <div key={fortune.id} className="rounded-xl border border-forest-accent/10 bg-forest-bg/45 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-medium text-forest-accent">{fortune.date}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                  fortune.isReversed ? 'bg-red-50 text-red-400' : 'bg-forest-accent/10 text-forest-accent'
                                }`}>
                                  {fortune.isReversed ? '逆位' : '正位'}
                                </span>
                              </div>
                              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-forest-ink/80">
                                {parts.initialImpression || parts.dailyReview || fortune.reflection || fortune.interpretation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <QuietEmptyState
                        title="还没有日运例证"
                        description="从日运复盘归入后，会在这里留下精选样本。"
                        className="px-3 py-2.5"
                      />
                    )}
                  </div>

                  <div className="space-y-2 rounded-[1.2rem] border border-forest-accent/8 bg-white/38 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-forest-accent">
                        <History size={12} />
                        日运历史
                      </h4>
                      {detailDailyFortuneGroup && (
                        <span className="rounded-full bg-forest-bg px-2 py-0.5 text-[9px] font-medium text-forest-muted">
                          历史 {detailDailyFortuneGroup.totalCount} · 本月 {detailDailyFortuneGroup.currentMonthCount}
                        </span>
                      )}
                    </div>
                    {detailDailyFortuneHistory.length > 0 ? (
                      <div className="custom-scrollbar max-h-44 space-y-2 overflow-y-auto pr-1">
                        {detailDailyFortuneHistory.map(fortune => {
                          const parts = getDailyReflectionParts(fortune);
                          return (
                            <div key={fortune.id} className="rounded-xl border border-forest-accent/5 bg-forest-bg/35 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-medium text-forest-muted">{fortune.date}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                  fortune.isReversed ? 'bg-red-50 text-red-400' : 'bg-forest-accent/10 text-forest-accent'
                                }`}>
                                  {fortune.isReversed ? '逆位' : '正位'}
                                </span>
                              </div>
                              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-forest-text/75">
                                {parts.initialImpression || parts.dailyReview || fortune.reflection || fortune.interpretation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <QuietEmptyState
                        title="暂无日运历史"
                        description="这张牌出现在日运记录后，会自动汇到这里。"
                        className="px-3 py-2.5"
                      />
                    )}
                  </div>
                </section>

                <section className="rounded-[1.2rem] border border-forest-accent/8 bg-white/38 p-3">
                  <h4 className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-forest-accent">
                    <History size={12} />
                    研习历程
                  </h4>
                  {detailInsights.length > 0 ? (
                    <div className="custom-scrollbar max-h-56 space-y-2 overflow-y-auto pr-1">
                      {detailInsights.map(item => (
                        <div key={item.id} className="rounded-xl border border-forest-accent/5 bg-white/58 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-forest-muted">{new Date(item.date).toLocaleDateString()}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                              item.isReversed ? 'bg-red-50 text-red-400' : 'bg-forest-accent/10 text-forest-accent'
                            }`}>
                              {item.isReversed ? '逆位' : '正位'}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs font-medium text-forest-ink">{item.question}</p>
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-forest-ink/70">{item.insight}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <QuietEmptyState
                      title="暂无研习记录"
                      description="相关手记出现后，会在这里形成这张牌的研习历程。"
                      className="py-2.5"
                    />
                  )}
                </section>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

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
