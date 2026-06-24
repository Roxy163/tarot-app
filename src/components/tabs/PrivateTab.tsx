import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, X, BookOpen, CheckCircle2, Circle, ChevronDown, Filter } from 'lucide-react';
import { ReadingKeywordCandidate, TarotReading, TarotCardMetadata } from '../../types';
import { ReadingCard } from '../ReadingCard';
import { useProgressiveList } from '../../hooks/useProgressiveList';

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
  cardMetadata
}) => {
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [isReviewFilterOpen, setIsReviewFilterOpen] = useState(false);

  const filteredReadings = useMemo(() => readings.filter(r => {
    const hasFeedback = !!r.userFeedback?.trim();
    if (reviewFilter === 'reviewed' && !hasFeedback) return false;
    if (reviewFilter === 'unreviewed' && hasFeedback) return false;

    if (!searchQuery && searchTags.length === 0) return true;
    
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q || 
      r.id.toLowerCase().includes(q) ||
      r.question.toLowerCase().includes(q) ||
      r.keywords.some(k => k.toLowerCase().includes(q)) ||
      r.authorName.toLowerCase().includes(q);
    
    const matchesTags = searchTags.length === 0 || 
      searchTags.every(tag => r.keywords.includes(tag));
    
    return matchesQuery && matchesTags;
  }), [readings, reviewFilter, searchQuery, searchTags]);

  const {
    hasMore,
    sentinelRef,
    visibleItems: visibleReadings,
  } = useProgressiveList(filteredReadings);

  const handleClearFilters = () => {
    setSearchQuery('');
    setReviewFilter('all');
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
      
      {(searchQuery || searchTags.length > 0 || reviewFilter !== 'all') && (
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
            开始抽牌
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
    </motion.div>
  );
};
