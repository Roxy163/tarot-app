import React from 'react';
import { motion } from 'motion/react';
import { TarotReading, SpreadDefinition, TarotCardMetadata } from '../../types';
import { AddReadingForm } from '../AddReadingForm';

interface AddTabProps {
  onSubmit: (reading: any) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  userId?: string;
  spreads: SpreadDefinition[];
  onUpdateSpreads: (spreads: SpreadDefinition[]) => void;
  cardMetadata: TarotCardMetadata[];
  onUpdateCardMetadata: (metadata: TarotCardMetadata[]) => void;
  initialData?: TarotReading | null;
  onCancel: () => void;
}

export const AddTab: React.FC<AddTabProps> = ({
  onSubmit,
  isLoading,
  isLoggedIn,
  userId,
  spreads,
  onUpdateSpreads,
  cardMetadata,
  onUpdateCardMetadata,
  initialData,
  onCancel
}) => {
  return (
    <motion.div 
      key="add" 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }} 
      className="space-y-6"
    >
      <AddReadingForm 
        onSubmit={onSubmit} 
        isLoading={isLoading} 
        isLoggedIn={isLoggedIn}
        userId={userId}
        spreads={spreads} 
        onUpdateSpreads={onUpdateSpreads} 
        cardMetadata={cardMetadata}
        onUpdateCardMetadata={onUpdateCardMetadata}
        initialData={initialData}
        onCancel={onCancel}
      />
    </motion.div>
  );
};
