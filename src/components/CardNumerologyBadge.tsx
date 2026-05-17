import React from 'react';
import { useCardNumerology } from '../hooks/useCardNumerology';

interface CardNumerologyBadgeProps {
  cardName: string;
  isLoggedIn: boolean;
  userId?: string;
}

export const CardNumerologyBadge: React.FC<CardNumerologyBadgeProps> = ({ cardName, isLoggedIn, userId }) => {
  const { numerology } = useCardNumerology(cardName, isLoggedIn, userId);
  return (
    <span className="text-[9px] text-forest-muted bg-forest-bg px-1 rounded border border-forest-accent/5 font-bold">
      灵数: {numerology !== null ? numerology : '未设置'}
    </span>
  );
};
