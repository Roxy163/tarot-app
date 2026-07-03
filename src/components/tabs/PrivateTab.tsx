import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Archive, Search, X, BookOpen, CheckCircle2, Circle, ChevronDown, Filter, UserRound, UsersRound, Plus } from 'lucide-react';
import { DailyFortune, ReadingKeywordCandidate, ReadingFormData, TarotReading, TarotCardMetadata } from '../../types';
import { ReadingCard } from '../ReadingCard';
import { useProgressiveList } from '../../hooks/useProgressiveList';
import { useDailyFortune } from '../../hooks/useDailyFortune';
import { DailyFortuneArchiveModal } from '../DailyFortuneArchiveModal';
import { TAROT_CARDS } from '../../constants';

interface PrivateTabProps {
  readings: TarotReading[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchTags: string[];
  onToggleTag: (tag: string) => void;
  onNavigate: (tab: string) => void;
  onTogglePublic: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (reading: TarotReading) => void;
  onViewDetails: (reading: TarotReading) => void;
  onAuthorClick: (author: string) => void;
  onProcessAi: (id: string) => void;
  onExtractKeywordCandidates: (id: string) => Promise<ReadingKeywordCandidate[]>;
  onConfirmKeywordCandidates: (id: string, candidates: ReadingKeywordCandidate[]) => void;
  cardMetadata: TarotCardMetadata[];
  onAddReading?: (data: Partial<ReadingFormData>) => void;
}

export const PrivateTab: React.FC<PrivateTabProps> = ({
  readings,
  searchQuery,
  setSearchQuery,
  searchTags,
  onToggleTag,
  onNavigate,
  onTogglePublic,
  onDelete,
  onEdit,
  onViewDetails,
  onAuthorClick,
  onProcessAi,
  onExtractKeywordCandidates,
  onConfirmKeywordCandidates,
  cardMetadata,
  onAddReading
}) => {
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'self' | 'client'>('all');
  const [clientFilter, setClientFilter] = useState('');
  const [isReviewFilterOpen, setIsReviewFilterOpen] = useState(false);
  const [isDailyArchiveOpen, setIsDailyArchiveOpen] = useState(false);
  const {
    getArchivedFortunes,
    getToday,
    updateDailyFortuneReflection,
  } = useDailyFortune();
  const archivedDailyFortunes = getArchivedFortunes();
  const todayFortune = getToday();
  const todayFortuneSaved = !!todayFortune && readings.some(reading => (
    reading.category === '日运'
    && reading.readingDate?.slice(0, 10) === todayFortune.date
    && reading.cards?.some(card => card.name === todayFortune.cardName)
  ));

  const saveDailyFortuneToReading = (fortune: DailyFortune) => {
    if (!onAddReading) return;

    onAddReading({
      question: `日运 · ${fortune.date}`,
      spread: '单牌阵',
      layoutType: 'horizontal',
      readingDate: fortune.date,
      category: '日运',
      cards: [{
        name: fortune.cardName,
        isReversed: fortune.isReversed,
        label: '日运',
      }],
      slotLabels: ['日运'],
      cardInterpretations: [fortune.interpretation],
      interpretation: {
        singleCard: fortune.interpretation,
        combination: '',
      },
      isPublic: false,
      isAnonymous: false,
      isForClient: false,
      userFeedback: fortune.reflection || '',
    });
  };

  const clientNames = useMemo(() => (
    Array.from(new Set(
      readings
        .filter(reading => reading.isForClient)
        .map(reading => reading.clientName?.trim() || '未命名客户')
    )).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  ), [readings]);

  const filteredReadings = useMemo(() => readings.filter(r => {
    const hasFeedback = !!r.userFeedback?.trim();
    if (reviewFilter === 'reviewed' && !hasFeedback) return false;
    if (reviewFilter === 'unreviewed' && hasFeedback) return false;
    if (audienceFilter === 'self' && r.isForClient) return false;
    if (audienceFilter === 'client' && !r.isForClient) return false;
    if (clientFilter) {
      const name = r.clientName?.trim() || '未命名客户';
      if (!r.isForClient || name !== clientFilter) return false;
    }

    if (!searchQuery && searchTags.length === 0) return true;
    
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q || 
      r.id.toLowerCase().includes(q) ||
      r.question.toLowerCase().includes(q) ||
      r.keywords.some(k => k.toLowerCase().includes(q)) ||
      r.authorName.toLowerCase().includes(q) ||
      (r.clientName || '').toLowerCase().includes(q);
    
    const matchesTags = searchTags.length === 0 || 
      searchTags.every(tag => r.keywords.includes(tag));
    
    return matchesQuery && matchesTags;
  }), [readings, reviewFilter, audienceFilter, clientFilter, searchQuery, searchTags]);

  const {
    hasMore,
    sentinelRef,
    visibleItems: visibleReadings,
  } = useProgressiveList(filteredReadings);

  const handleClearFilters = () => {
    setSearchQuery('');
    setReviewFilter('all');
    setAudienceFilter('all');
    setClientFilter('');
    setIsReviewFilterOpen(false);
    searchTags.forEach(onToggleTag);
  };

  const reviewFilterOptions = [
    { id: 'all' as const, label: '全部', icon: BookOpen },
    { id: 'reviewed' as const, label: '已复盘', icon: CheckCircle2 },
    { id: 'unreviewed' as const, label: '未复盘', icon: Circle },
  ];
  const activeReviewFilter = reviewFilterOptions.find(option => option.id === reviewFilter) || reviewFilterOptions[0];

  return (
    <motion.div 
      key="private" 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }} 
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-2xl font-serif font-bold text-forest-accent flex items-center gap-2">
            阁中典籍
            <span className="text-[10px] font-sans font-normal text-forest-muted opacity-60 bg-forest-accent/5 px-2 py-0.5 rounded-full ring-1 ring-forest-accent/10">研精覃思，洞见未来</span>
          </h2>
        </div>
      </div>

      <section className="rounded-2xl border border-forest-accent/10 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-accent/10 text-forest-accent">
              <Archive size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-forest-ink">日运复盘</h3>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-forest-muted">
                回看每天的一张牌，把牌义和真实事件对应起来。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDailyArchiveOpen(true)}
            className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-forest-accent px-4 text-xs font-bold text-white shadow-sm hover:bg-forest-accent/90"
          >
            <BookOpen size={14} />
            查看
          </button>
        </div>
        {todayFortune && (
          <div className="mt-3 rounded-2xl border border-forest-accent/10 bg-forest-bg/60 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-forest-muted">今日日运</p>
                <p className="mt-1 text-sm font-bold text-forest-ink">
                  {todayFortune.cardName} · {todayFortune.isReversed ? '逆位' : '正位'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveDailyFortuneToReading(todayFortune)}
                disabled={todayFortuneSaved}
                className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-forest-ink px-4 text-xs font-bold text-white transition-all hover:bg-forest-accent disabled:bg-forest-accent/20 disabled:text-forest-muted"
              >
                {todayFortuneSaved ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                {todayFortuneSaved ? '已存入典籍' : '存入典籍'}
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-forest-bg/70 px-3 py-2">
            <p className="text-[10px] text-forest-muted">已归档</p>
            <p className="mt-0.5 font-serif text-lg font-bold text-forest-accent">{archivedDailyFortunes.length} 天</p>
          </div>
          <div className="rounded-xl bg-forest-bg/70 px-3 py-2">
            <p className="text-[10px] text-forest-muted">复盘状态</p>
            <p className="mt-0.5 font-serif text-lg font-bold text-forest-accent">
              {archivedDailyFortunes.filter(item => item.reflection?.trim()).length} 条
            </p>
          </div>
          <div className="col-span-2 rounded-xl bg-forest-bg/70 px-3 py-2 sm:col-span-1">
            <p className="text-[10px] text-forest-muted">入口位置</p>
            <p className="mt-1 text-xs font-bold text-forest-ink">典籍内长期复盘</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <div className="relative group shadow-sm bg-white rounded-full flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-forest-muted group-focus-within:text-forest-accent transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="🔍 搜索记录..." 
            className="w-full pl-11 pr-10 py-3 bg-white border border-forest-accent/10 rounded-full focus:outline-none focus:ring-2 focus:ring-forest-accent/20 text-sm transition-all" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-forest-muted hover:text-forest-accent transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsReviewFilterOpen(prev => !prev)}
            className={`min-h-11 px-3 sm:px-4 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
              reviewFilter === 'all'
                ? 'bg-white text-forest-muted border-forest-accent/10 hover:text-forest-accent hover:border-forest-accent/30'
                : 'bg-forest-accent text-white border-forest-accent'
            }`}
          >
            <Filter size={13} />
            <span className="hidden sm:inline">复盘</span>
            <span>{activeReviewFilter.label}</span>
            <ChevronDown size={13} className={`transition-transform ${isReviewFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isReviewFilterOpen && (
            <div className="absolute right-0 top-full mt-2 w-32 rounded-2xl bg-white border border-forest-accent/10 shadow-xl p-1.5 z-30">
              {reviewFilterOptions.map(option => {
                const Icon = option.icon;
                const active = reviewFilter === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setReviewFilter(option.id);
                      setIsReviewFilterOpen(false);
                    }}
                    className={`w-full min-h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                      active
                        ? 'bg-forest-accent text-white'
                        : 'text-forest-muted hover:text-forest-accent hover:bg-forest-accent/5'
                    }`}
                  >
                    <Icon size={13} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-forest-accent/10 bg-white/80 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all' as const, label: '全部记录', icon: BookOpen },
            { id: 'self' as const, label: '给自己', icon: UserRound },
            { id: 'client' as const, label: '客户记录', icon: UsersRound },
          ].map(option => {
            const Icon = option.icon;
            const active = audienceFilter === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setAudienceFilter(option.id);
                  if (option.id !== 'client') setClientFilter('');
                }}
                className={`min-h-10 rounded-full px-3 text-xs font-bold transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-forest-accent text-white shadow-sm'
                    : 'bg-forest-accent/5 text-forest-accent hover:bg-forest-accent/10'
                }`}
              >
                <Icon size={13} />
                {option.label}
              </button>
            );
          })}
        </div>

        {clientNames.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {clientNames.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setAudienceFilter('client');
                  setClientFilter(name === clientFilter ? '' : name);
                }}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-[10px] font-bold transition-all ${
                  clientFilter === name
                    ? 'border-forest-accent bg-forest-accent text-white'
                    : 'border-forest-accent/10 bg-white text-forest-muted hover:text-forest-accent'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </section>
      
      {(searchQuery || searchTags.length > 0 || reviewFilter !== 'all' || audienceFilter !== 'all' || clientFilter) && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span className="text-[10px] text-forest-muted">正在筛选:</span>
          {searchQuery && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              关键词: {searchQuery}
              <X size={10} className="cursor-pointer" onClick={() => setSearchQuery('')} />
            </span>
          )}
          {searchTags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-forest-accent text-white rounded-full text-[10px] font-medium flex items-center gap-1 shadow-sm">
              {tag}
              <X size={10} className="cursor-pointer" onClick={() => onToggleTag(tag)} />
            </span>
          ))}
          {reviewFilter !== 'all' && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              复盘: {reviewFilter === 'reviewed' ? '已复盘' : '未复盘'}
              <X size={10} className="cursor-pointer" onClick={() => setReviewFilter('all')} />
            </span>
          )}
          {audienceFilter !== 'all' && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              类型: {audienceFilter === 'self' ? '给自己' : '客户记录'}
              <X size={10} className="cursor-pointer" onClick={() => {
                setAudienceFilter('all');
                setClientFilter('');
              }} />
            </span>
          )}
          {clientFilter && (
            <span className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent rounded-full text-[10px] font-medium flex items-center gap-1">
              客户: {clientFilter}
              <X size={10} className="cursor-pointer" onClick={() => setClientFilter('')} />
            </span>
          )}
          <button 
            onClick={handleClearFilters}
            className="text-[10px] text-forest-muted hover:text-forest-accent underline ml-auto"
          >
            清除全部
          </button>
        </div>
      )}
      
      {filteredReadings.length === 0 ? (
        <div className="text-center py-24 text-forest-muted bg-white/50 rounded-3xl border border-dashed border-forest-accent/20 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-forest-accent/5 flex items-center justify-center text-forest-accent/30">
            <BookOpen size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">阁中暂无此类录记。</p>
            <p className="text-[10px] opacity-60">记录每一次的心灵触动与智慧微光</p>
          </div>
          <button 
            onClick={() => { onNavigate('add'); handleClearFilters(); }}
            className="px-6 py-2 bg-forest-accent text-white rounded-full text-xs font-bold hover:bg-forest-accent/90 transition-all shadow-md"
          >
            写第一条手记
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleReadings.map(reading => (
            <ReadingCard 
              key={reading.id} 
              reading={reading} 
              onTogglePublic={() => onTogglePublic(reading.id)} 
              onDelete={() => onDelete(reading.id)}
              onEdit={() => onEdit(reading)}
              onViewDetails={() => onViewDetails(reading)}
              onTagClick={onToggleTag}
              activeTags={searchTags}
              cardMetadata={cardMetadata}
              onAuthorClick={onAuthorClick}
              onProcessAi={onProcessAi}
              onExtractKeywordCandidates={onExtractKeywordCandidates}
              onConfirmKeywordCandidates={onConfirmKeywordCandidates}
            />
          ))}
          <div ref={sentinelRef} className="col-span-full h-1" aria-hidden />
        </div>
      )}
      {hasMore && (
        <div className="py-2 text-center text-[10px] font-bold text-forest-muted">
          正在继续展开典籍...
        </div>
      )}

      <DailyFortuneArchiveModal
        fortunes={archivedDailyFortunes}
        isOpen={isDailyArchiveOpen}
        onClose={() => setIsDailyArchiveOpen(false)}
        onUpdateReflection={updateDailyFortuneReflection}
      />
    </motion.div>
  );
};
