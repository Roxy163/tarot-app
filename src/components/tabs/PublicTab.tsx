import React from 'react';
import { motion } from 'motion/react';
import { Globe, Sparkles } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../../types';
import { ReadingCard } from '../ReadingCard';

interface PublicTabProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onTagClick: (tag: string) => void;
  onAuthorClick: (author: string) => void;
  onProcessAi: (id: string) => void;
}

export const PublicTab: React.FC<PublicTabProps> = ({
  readings,
  cardMetadata,
  onTagClick,
  onAuthorClick,
  onProcessAi
}) => {
  const publicReadings = readings.filter(r => r.isPublic);

  return (
    <motion.div 
      key="public" 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }} 
      className="space-y-6"
    >
      {publicReadings.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-forest-accent/10 flex items-center justify-center">
            <Globe className="text-forest-accent/40" size={40} />
          </div>
          <h3 className="text-xl font-serif font-bold text-forest-ink mb-2">广场静候佳音</h3>
          <p className="text-forest-muted text-sm mb-6 max-w-xs mx-auto">
            这里是研习者分享心得的公共空间。完成占卜后，将记录设为公开，与同好交流感悟。
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-forest-accent/5 text-forest-accent rounded-full text-sm font-medium">
            <Sparkles size={14} />
            <span>成为第一个分享者</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publicReadings.map(reading => (
            <ReadingCard 
              key={reading.id} 
              reading={reading} 
              isPublicView 
              cardMetadata={cardMetadata}
              onTagClick={onTagClick}
              onAuthorClick={onAuthorClick}
              onProcessAi={onProcessAi}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};
