import React from 'react';
import { motion } from 'motion/react';
import { Search, X, BookOpen } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../../types';
import { ReadingCard } from '../ReadingCard';

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
  onAuthorClick: (author: string) => void;
  onProcessAi: (id: string) => void;
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
  onAuthorClick,
  onProcessAi,
  cardMetadata
}) => {
  const filteredReadings = readings.filter(r => {
    if (!searchQuery && searchTags.length === 0) return true;
    
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q || 
      r.question.toLowerCase().includes(q) ||
      r.keywords.some(k => k.toLowerCase().includes(q)) ||
      r.authorName.toLowerCase().includes(q);
    
    const matchesTags = searchTags.length === 0 || 
      searchTags.every(tag => r.keywords.includes(tag));
    
    return matchesQuery && matchesTags;
  });

  const handleClearFilters = () => {
    setSearchQuery('');
  };

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

      <div className="relative group shadow-sm bg-white rounded-full">
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
      
      {(searchQuery || searchTags.length > 0) && (
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
          {filteredReadings.map(reading => (
            <ReadingCard 
              key={reading.id} 
              reading={reading} 
              onTogglePublic={() => onTogglePublic(reading.id)} 
              onDelete={() => onDelete(reading.id)}
              onEdit={() => onEdit(reading)}
              onTagClick={onToggleTag}
              activeTags={searchTags}
              cardMetadata={cardMetadata}
              onAuthorClick={onAuthorClick}
              onProcessAi={onProcessAi}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};
