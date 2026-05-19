import React from 'react';
import { motion } from 'motion/react';
import { Globe } from 'lucide-react';
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
        <div className="text-center py-20 text-forest-muted">
          <Globe className="mx-auto mb-4 opacity-20" size={48} />
          <p>广场空空如也，去分享你的研习心得吧</p>
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
