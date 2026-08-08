import React from 'react';
import { motion } from 'motion/react';
import { TarotReading, TarotCardMetadata, UserProfile } from '../../types';
import { ProfileView } from '../ProfileView';

interface ProfileTabProps {
  authorName: string;
  profile: UserProfile | null;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  email?: string | null;
  isLoggedIn?: boolean;
  isEmailVerified?: boolean;
  onLogin?: () => void;
  onLogout: () => void;
  onOpenSecurity?: () => void;
  onBackHome?: () => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  authorName,
  profile,
  readings,
  cardMetadata,
  email,
  isLoggedIn,
  isEmailVerified,
  onLogin,
  onLogout,
  onOpenSecurity,
  onBackHome,
  onUpdateProfile,
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
        onLogin={onLogin}
        onOpenSecurity={onOpenSecurity}
        onBackHome={onBackHome}
        onUpdateProfile={onUpdateProfile}
        readings={readings} 
        cardMetadata={cardMetadata}
        email={email}
        isLoggedIn={isLoggedIn}
        isEmailVerified={isEmailVerified}
      />
    </motion.div>
  );
};
