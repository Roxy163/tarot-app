export interface ReadingSlotData {
  name: string;
  isReversed: boolean;
  position?: string;
  label?: string;
  isRotated?: boolean;
}

export interface UserProfile {
  id: string;
  nickname: string;
  signature: string;
  createdAt: string;
}

export interface TarotCardMetadata {
  id: string;
  name: string;
  english: string;
  default_numerology?: number | null;
  astrology?: {
    planet?: string;
    zodiac?: string;
    house?: string;
    element?: string;
  };
}

export interface TarotReading {
  id: string;
  userId: string;
  date: string;
  question: string;
  spread: string;
  cards: { name: string; isReversed: boolean }[];
  cardInterpretations?: string[];
  interpretation: {
    singleCard: string;
    combination: string;
    summary: string;
  };
  keywords: string[];
  isPublic: boolean;
  authorName: string;
  isAnonymous: boolean;
  isForClient?: boolean;
  clientName?: string;
  clientFeedback?: string;
  userFeedback?: string;
  isExample?: boolean;
  layoutType?: string;
  slotLabels?: string[];
  slotPositions?: string[];
  rotatedSlots?: number[];
  readingDate?: string;
  category?: string;
  isAiProcessed?: boolean;
  skipAi?: boolean;
}

export interface SpreadDefinition {
  name: string;
  layout: string;
  slots: string[];
  slotPositions?: string[];
  rotatedSlots?: number[];
  gridCols?: number;
  gridRows?: number;
}

export interface LayoutTemplate {
  name: string;
  class: string;
  itemClasses: string[];
  defaultSlots: string[];
}
