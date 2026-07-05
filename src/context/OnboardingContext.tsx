import React, { createContext, useContext, useReducer, useEffect, ReactNode, useState } from 'react';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  threshold: number;
  icon: string;
  unlockedAt?: Date;
}

export interface OnboardingState {
  showFirstEntry: boolean;
  currentStep: number;
  activeGuide: string | null;
  completedGuides: string[];
  achievements: Achievement[];
  lastTipShown: Date | null;
  hasCompletedFirstEntry: boolean;
}

type OnboardingAction =
  | { type: 'START_FIRST_ENTRY' }
  | { type: 'NEXT_STEP' }
  | { type: 'COMPLETE_FIRST_ENTRY' }
  | { type: 'SKIP_FIRST_ENTRY' }
  | { type: 'START_GUIDE'; payload: string }
  | { type: 'COMPLETE_GUIDE'; payload: string }
  | { type: 'UNLOCK_ACHIEVEMENT'; payload: Achievement }
  | { type: 'SHOW_TIP' }
  | { type: 'LOAD_STATE'; payload: Partial<OnboardingState> };

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_reading', title: '初窥门径', description: '完成第一次抽牌手记', threshold: 1, icon: 'Sparkles' },
  { id: 'seven_readings', title: '登堂入室', description: '完成七次研习记录', threshold: 7, icon: 'BookOpen' },
  { id: 'multi_card_master', title: '融会贯通', description: '使用复杂牌阵（3张以上）完成占卜', threshold: 3, icon: 'Layers' },
  { id: 'public_share', title: '传道授业', description: '首次将研习分享到广场', threshold: 1, icon: 'Globe' },
  { id: 'ai_insight', title: '人机合一', description: '使用AI深度解析5次', threshold: 5, icon: 'Brain' },
  { id: 'daily_streak', title: '持之以恒', description: '连续七天进行研习', threshold: 7, icon: 'Calendar' },
];

const initialState: OnboardingState = {
  showFirstEntry: false,
  currentStep: 0,
  activeGuide: null,
  completedGuides: [],
  achievements: INITIAL_ACHIEVEMENTS,
  lastTipShown: null,
  hasCompletedFirstEntry: false,
};

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'START_FIRST_ENTRY':
      return { ...state, showFirstEntry: true, currentStep: 0 };
    
    case 'NEXT_STEP':
      return { ...state, currentStep: state.currentStep + 1 };
    
    case 'COMPLETE_FIRST_ENTRY':
      return { 
        ...state, 
        showFirstEntry: false, 
        hasCompletedFirstEntry: true,
        currentStep: 0 
      };
    
    case 'SKIP_FIRST_ENTRY':
      return { 
        ...state, 
        showFirstEntry: false, 
        hasCompletedFirstEntry: true 
      };
    
    case 'START_GUIDE':
      return { ...state, activeGuide: action.payload };
    
    case 'COMPLETE_GUIDE':
      return { 
        ...state, 
        activeGuide: null,
        completedGuides: [...state.completedGuides, action.payload] 
      };
    
    case 'UNLOCK_ACHIEVEMENT':
      return {
        ...state,
        achievements: state.achievements.map(ach =>
          ach.id === action.payload.id
            ? { ...ach, unlockedAt: new Date() }
            : ach
        )
      };
    
    case 'SHOW_TIP':
      return { ...state, lastTipShown: new Date() };
    
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

interface OnboardingContextType {
  state: OnboardingState;
  startFirstEntry: () => void;
  nextStep: () => void;
  completeFirstEntry: () => void;
  skipFirstEntry: () => void;
  startGuide: (guideId: string) => void;
  completeGuide: (guideId: string) => void;
  unlockAchievement: (achievement: Achievement) => void;
  checkAndUnlockAchievements: (readingCount: number, hasPublic: boolean, aiCount: number, streak: number) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);
  const [hasLoadedStoredState, setHasLoadedStoredState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tarot_onboarding_state');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        dispatch({
          type: 'LOAD_STATE',
          payload: {
            ...parsed,
            showFirstEntry: false,
            currentStep: 0,
            hasCompletedFirstEntry: true,
          },
        });
      } catch (e) {
        console.error('Failed to load onboarding state:', e);
        dispatch({ type: 'LOAD_STATE', payload: { showFirstEntry: false, currentStep: 0, hasCompletedFirstEntry: true } });
      }
    } else {
      dispatch({ type: 'LOAD_STATE', payload: { showFirstEntry: false, currentStep: 0, hasCompletedFirstEntry: true } });
    }

    localStorage.setItem('has_seen_first_entry_scroll', 'true');
    setHasLoadedStoredState(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredState) return;

    const stateToSave = {
      hasCompletedFirstEntry: state.hasCompletedFirstEntry,
      completedGuides: state.completedGuides,
      achievements: state.achievements,
    };
    localStorage.setItem('tarot_onboarding_state', JSON.stringify(stateToSave));
  }, [hasLoadedStoredState, state.hasCompletedFirstEntry, state.completedGuides, state.achievements]);

  const startFirstEntry = () => dispatch({ type: 'START_FIRST_ENTRY' });
  const nextStep = () => dispatch({ type: 'NEXT_STEP' });
  const completeFirstEntry = () => {
    dispatch({ type: 'COMPLETE_FIRST_ENTRY' });
    localStorage.setItem('has_seen_first_entry_scroll', 'true');
  };
  const skipFirstEntry = () => {
    dispatch({ type: 'SKIP_FIRST_ENTRY' });
    localStorage.setItem('has_seen_first_entry_scroll', 'true');
  };
  const startGuide = (guideId: string) => dispatch({ type: 'START_GUIDE', payload: guideId });
  const completeGuide = (guideId: string) => dispatch({ type: 'COMPLETE_GUIDE', payload: guideId });
  const unlockAchievement = (achievement: Achievement) => dispatch({ type: 'UNLOCK_ACHIEVEMENT', payload: achievement });

  const checkAndUnlockAchievements = (readingCount: number, hasPublic: boolean, aiCount: number, streak: number) => {
    state.achievements.forEach(ach => {
      if (ach.unlockedAt) return;
      
      let shouldUnlock = false;
      switch (ach.id) {
        case 'first_reading':
          shouldUnlock = readingCount >= ach.threshold;
          break;
        case 'seven_readings':
          shouldUnlock = readingCount >= ach.threshold;
          break;
        case 'multi_card_master':
          shouldUnlock = readingCount >= ach.threshold;
          break;
        case 'public_share':
          shouldUnlock = hasPublic;
          break;
        case 'ai_insight':
          shouldUnlock = aiCount >= ach.threshold;
          break;
        case 'daily_streak':
          shouldUnlock = streak >= ach.threshold;
          break;
      }
      
      if (shouldUnlock) {
        unlockAchievement(ach);
      }
    });
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        startFirstEntry,
        nextStep,
        completeFirstEntry,
        skipFirstEntry,
        startGuide,
        completeGuide,
        unlockAchievement,
        checkAndUnlockAchievements,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
