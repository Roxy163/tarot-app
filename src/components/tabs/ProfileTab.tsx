import React from 'react';
import { motion } from 'motion/react';
import { TarotReading, TarotCardMetadata, UserProfile } from '../../types';
import { ProfileView } from '../ProfileView';

interface ProfileTabProps {
  authorName: string;
  profile: UserProfile | null;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onLogout: () => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onTagClick: (tag: string) => void;
  onViewAll: () => void;
  onEditReading: (reading: TarotReading) => void;
  onDeleteReading: (id: string) => void;
  onTogglePublic: (id: string) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  authorName,
  profile,
  readings,
  cardMetadata,
  onLogout,
  onUpdateProfile,
  onTagClick,
  onViewAll,
  onEditReading,
  onDeleteReading,
  onTogglePublic
}) => {
  return (
    <motion.div 
      key="profile" 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <ProfileView 
        authorName={authorName} 
        profile={profile}
        onLogout={onLogout}
        onUpdateProfile={onUpdateProfile}
        readings={readings} 
        cardMetadata={cardMetadata}
        onTagClick={onTagClick}
        onViewAll={onViewAll}
        onEditReading={onEditReading}
        onDeleteReading={onDeleteReading}
        onTogglePublic={onTogglePublic}
      />
    </motion.div>
  );
};
