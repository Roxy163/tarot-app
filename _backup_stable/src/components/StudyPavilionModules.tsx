import React, { useState, useMemo } from 'react';
import { History, BookOpen, Book, ArrowRight, History as HistoryIcon, RefreshCw, TrendingUp } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

interface StudyPavilionModulesProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
}

export const StudyPavilionModules: React.FC<StudyPavilionModulesProps> = ({
  readings,
  cardMetadata,
  setActiveTab,
  setSearchQuery,
}) => {
  const userReadings = readings.filter(r => !r.isExample);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  // Initialize or handle review reading selection
  const reviewReading = useMemo(() => {
    if (userReadings.length === 0) return null;
    
    // If we haven't picked one yet or the list changed
    const sorted = [...userReadings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (reviewIndex === null) {
      const initialIndex = Math.floor(Math.pow(Math.random(), 1.5) * sorted.length);
      setReviewIndex(initialIndex);
      return sorted[initialIndex];
    }
    
    // Safety check for bounds
    const idx = Math.min(reviewIndex, sorted.length - 1);
    return sorted[idx];
  }, [userReadings, reviewIndex]);

  const handleRefreshReview = () => {
    if (userReadings.length <= 1) return;
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * userReadings.length);
    } while (nextIndex === reviewIndex);
    setReviewIndex(nextIndex);
  };

  // Weekly Stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weekReadings = userReadings.filter(r => new Date(r.readingDate || r.date) >= oneWeekAgo);
    
    const counts: Record<string, number> = {};
    weekReadings.forEach(r => {
      r.cards.forEach(c => {
        counts[c.name] = (counts[c.name] || 0) + 1;
      });
    });
    
    let topCard = '';
    let maxCount = 0;
    Object.entries(counts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCard = name;
      }
    });
    
    return {
      count: weekReadings.length,
      topCard,
      topCardCount: maxCount
    };
  }, [userReadings]);

  if (userReadings.length === 0) {
    return (
      <div className="ancient-book-bg p-8 rounded-[2rem] border border-forest-border text-center space-y-4 bg-white/50">
        <div className="w-12 h-12 mx-auto rounded-full bg-forest-accent/5 flex items-center justify-center text-forest-accent/40">
          <Book size={24} />
        </div>
        <p className="text-forest-muted font-serif italic">✨ 开启今日手记，召唤本周牌魂</p>
        <button 
          onClick={() => setActiveTab('add')}
          className="px-6 py-2 bg-forest-accent text-white rounded-full text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
        >
          开始抽牌
        </button>
      </div>
    );
  }

  // Calculate pending annotations
  const cardCounts: Record<string, number> = {};
  userReadings.forEach(r => {
    (r.cards || []).forEach(c => {
      if (c && c.name) {
        cardCounts[c.name] = (cardCounts[c.name] || 0) + 1;
      }
    });
  });

  const pendingCards = Object.entries(cardCounts)
    .filter(([name, count]) => {
      const meta = cardMetadata.find(m => m.name === name);
      return count >= 3 && (!meta || !meta.personal_meaning);
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-6 px-1">
      {reviewReading && (
        <motion.div 
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 rounded-[2rem] border border-forest-border overflow-hidden shadow-sm hover:shadow-md transition-shadow relative"
        >
          <div className="p-4 border-b border-forest-accent/5 flex items-center justify-between bg-forest-accent/5">
            <div className="flex items-center gap-2">
              <HistoryIcon size={14} className="text-forest-accent" />
              <h3 className="text-xs font-bold text-forest-accent">今日回顾</h3>
              <span className="text-[10px] text-forest-muted font-mono bg-white/50 px-2 py-0.5 rounded-full border border-forest-accent/5">
                {new Date(reviewReading.readingDate || reviewReading.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <button 
              onClick={handleRefreshReview}
              className="p-1.5 hover:bg-forest-accent/10 rounded-full transition-colors text-forest-accent/60"
              title="换一条"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3 items-center shrink-0">
                {(reviewReading.cards || []).slice(0, 3).map((c, i) => {
                  const cardData = TAROT_CARDS.find(tc => tc.name === c.name);
                  return (
                    <div 
                      key={i} 
                      className={`relative w-8 h-12 rounded shadow-sm border border-forest-accent/10 overflow-hidden bg-white ${c.isReversed ? 'rotate-180' : ''}`}
                      style={{ zIndex: 3 - i }}
                    >
                      <img 
                        src={getCardImageUrl(cardData?.id || 'ar00')} 
                        alt={c.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-forest-ink truncate">
                  {(reviewReading.cards || []).map(c => `${c.name}${c.isReversed ? '(逆)' : ''}`).join(' · ')}
                </p>
                <p className="text-[10px] text-forest-muted truncate mt-0.5">{reviewReading.question}</p>
              </div>
            </div>
            <div className="relative">
              <p className="text-xs text-forest-text/70 leading-relaxed italic line-clamp-2">
                “ {(() => {
                  const rawContent = (reviewReading.interpretation?.summary || reviewReading.interpretation?.combination || '');
                  // Filter out obvious numerology patterns like [数字] or (数字) if any, though usually summary is clean
                  const cleanContent = rawContent.replace(/\[\d+\]/g, '').trim();
                  return cleanContent.length > 30 ? cleanContent.slice(0, 30) + '...' : cleanContent;
                })()} ”
              </p>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={() => {
                  setSearchQuery(reviewReading.id);
                  setActiveTab('private');
                }}
                className="px-4 py-1.5 bg-forest-accent/5 text-forest-accent rounded-full text-[10px] font-bold hover:bg-forest-accent hover:text-white transition-all flex items-center gap-1 group"
              >
                回顾全文 <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 本周研习预览 */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-forest-pink/5 rounded-[2rem] border border-forest-pink/10 p-5 shadow-sm"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-forest-ink flex items-center gap-2">
              <TrendingUp size={16} className="text-forest-pink" /> 本周研习预览
            </h3>
            <p className="text-[10px] text-forest-muted tracking-wide">近7日的记录回顾</p>
          </div>
          <button 
            onClick={() => setActiveTab('private')}
            className="text-[10px] font-bold text-forest-pink flex items-center gap-1 hover:underline"
          >
            查看周报 <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/60 p-3 rounded-2xl border border-forest-pink/5 text-center">
            <p className="text-[10px] text-forest-muted mb-1">记录次数</p>
            <p className="text-lg font-serif font-bold text-forest-ink">{weeklyStats.count} <span className="text-[10px] font-normal">次</span></p>
          </div>
          <div className="bg-white/60 p-3 rounded-2xl border border-forest-pink/5 text-center flex flex-col justify-center min-h-[54px]">
            {weeklyStats.topCard ? (
              <>
                <p className="text-[10px] text-forest-muted mb-1">本周牌魂</p>
                <p className="text-xs font-bold text-forest-ink truncate">{weeklyStats.topCard}</p>
                <p className="text-[9px] text-forest-pink/60 mt-0.5">出现 {weeklyStats.topCardCount} 次</p>
              </>
            ) : (
              <p className="text-[10px] text-forest-pink/70 font-medium">✨ 尚未起运</p>
            )}
          </div>
        </div>
      </motion.div>

      {pendingCards.length > 0 && (
        <div className="bg-white/80 rounded-[2rem] border border-forest-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-forest-accent/5 flex items-center justify-between bg-forest-accent/5">
            <h3 className="text-sm font-bold text-forest-accent flex items-center gap-2">
              <BookOpen size={16} /> 待补注疏
            </h3>
            <span className="text-[10px] text-forest-muted">已有灵见，尚未落笔</span>
          </div>
          <div className="p-4 space-y-3">
            {pendingCards.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-forest-bg/50 rounded-2xl border border-forest-accent/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-forest-accent/10 flex items-center justify-center text-forest-accent font-bold text-[10px] text-center p-1">
                    {name}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-forest-ink">{name}</p>
                    <p className="text-[10px] text-forest-muted">记录次数: {count}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const card = TAROT_CARDS.find(c => c.name === name);
                    if (card) {
                      setActiveTab('metadata');
                    }
                  }}
                  className="px-4 py-1.5 bg-white text-forest-accent border border-forest-accent/20 rounded-lg text-[10px] font-bold hover:bg-forest-accent hover:text-white transition-all"
                >
                  前往撰写
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
