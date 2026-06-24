export interface ReadingSlotData {
  name: string;
  isReversed: boolean;
  position?: string;
  label?: string;
  isRotated?: boolean;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}

export interface UserProfile {
  id: string;
  user_public_id?: string; // Formatted ID: TAROT-YYMMDD-XXXXXXXX
  nickname?: string;      // Legacy field
  display_name?: string;  // New personalized name
  signature?: string;     // Legacy field
  bio?: string;           // New personalized signature
  avatar_url?: string;
  password?: string;
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
  keywords?: string[];
  meaning?: string;
  reversedMeaning?: string;
}

export interface ReadingKeywordCandidate {
  id: string;
  cardName: string;
  keyword: string;
  sourceText?: string;
}

export interface CardKeywordMemoryEntry {
  keyword: string;
  count: number;
  readingIds: string[];
  examples: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CardKeywordMemory {
  cardName: string;
  keywords: CardKeywordMemoryEntry[];
  updatedAt: string;
}

export type AiInspirationMode = 'angle' | 'questions' | 'shadow';

export interface AiInspirationRequest {
  cardName: string;
  isReversed: boolean;
  slotLabel: string;
  question: string;
  spread: string;
  category?: string;
  currentInsight?: string;
  combinationContext?: string;
  personalKeywords?: string[];
  cardKeywords?: string[];
  cardCorrespondences?: string[];
  cardMeaning?: string;
  reversedMeaning?: string;
  mode: AiInspirationMode;
}

export interface CardAnnotation {
  cardId: string;
  userId: string;
  numerology: string | null;
  planet: string | null;
  zodiac: string | null;
  house: string | null;
  element: string | null;
  uprightMeaning: string;
  reversedMeaning: string;
  keywords: string[];
  personalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficialCardAnnotation {
  cardId: string;
  arcana: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  cardNumber: number | null;
  courtNumber?: 11 | 12 | 13 | 14;
  numerology: string | null;
  planet: string | null;
  zodiac: string | null;
  house: string | null;
  element: string | null;
  uprightMeaning: string;
  reversedMeaning: string;
  keywords: string[];
}

export interface UserAnnotationData {
  userId: string;
  annotations: Record<string, Partial<CardAnnotation>>;
  version: number;
  lastUpdated: string;
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
    numerologyInfluence?: string;
    astrologyInfluence?: string;
    houseInfluence?: string;
    elementInfluence?: string;
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
  processedByAi?: boolean;
  skipAi?: boolean;
  showSlotNumbers?: boolean;
  updatedAt?: string;
}

export interface FreePosition {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}

export interface SpreadDefinition {
  name: string;
  layout: string;
  slots: string[];
  slotPositions?: string[];
  rotatedSlots?: number[];
  gridCols?: number;
  gridRows?: number;
  freePositions?: FreePosition[];
}

export interface LayoutTemplate {
  name: string;
  class: string;
  itemClasses: string[];
  defaultSlots: string[];
}

export interface ReadingFormData {
  question: string;
  spread: string;
  layoutType: string;
  cardInput: string;
  interpretation: {
    singleCard: string;
    combination: string;
    numerologyInfluence?: string;
    astrologyInfluence?: string;
    houseInfluence?: string;
    elementInfluence?: string;
  };
  isAnonymous: boolean;
  isPublic: boolean;
  isForClient: boolean;
  clientName: string;
  clientFeedback: string;
  userFeedback: string;
  readingDate: string;
  isTimePrecise: boolean;
  category: string;
  skipAi: boolean;
  cards: ReadingSlotData[];
  cardInterpretations: string[];
  slotLabels: string[];
  slotPositions: string[];
  rotatedSlots: number[];
}

export interface DailyFortune {
  id: string;
  userId: string;
  date: string;
  cardName: string;
  isReversed: boolean;
  interpretation: string;
  keywords: string[];
  reflection?: string;
  createdAt: string;
  isRevealed?: boolean;
  isLocked?: boolean;
}

export interface FortuneSummary {
  period: string;
  periodType: 'day' | 'week' | 'month' | 'year' | 'season';
  cards: string[];
  insights: {
    mostFrequentCard: string;
    reversedCount: number;
    keyThemes: string[];
    advice: string;
  };
  startDate: string;
  endDate: string;
}
