import { createContext, useCallback, useContext, useEffect, useReducer, useState } from 'react';
import type { ReactNode } from 'react';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  threshold: number;
  icon: string;
  unlockedAt?: Date;
}

export interface OnboardingState {
  achievements: Achievement[];
}

type OnboardingAction =
  | { type: 'LOAD_ACHIEVEMENTS'; payload: Achievement[] }
  | { type: 'UNLOCK_ACHIEVEMENT'; payload: string };

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_reading', title: '初窥门径', description: '完成第一次抽牌手记', threshold: 1, icon: 'Sparkles' },
  { id: 'seven_readings', title: '登堂入室', description: '完成七次研习记录', threshold: 7, icon: 'BookOpen' },
  { id: 'multi_card_master', title: '融会贯通', description: '使用复杂牌阵（3张以上）完成占卜', threshold: 3, icon: 'Layers' },
  { id: 'public_share', title: '传道授业', description: '首次将研习分享到广场', threshold: 1, icon: 'Globe' },
  { id: 'ai_insight', title: '人机合一', description: '使用AI深度解析5次', threshold: 5, icon: 'Brain' },
  { id: 'daily_streak', title: '持之以恒', description: '连续七天进行研习', threshold: 7, icon: 'Calendar' },
];

const initialState: OnboardingState = {
  achievements: INITIAL_ACHIEVEMENTS,
};

const normalizeAchievements = (storedAchievements: unknown): Achievement[] => {
  const storedList = Array.isArray(storedAchievements) ? storedAchievements : [];

  return INITIAL_ACHIEVEMENTS.map(baseAchievement => {
    const stored = storedList.find(item => (
      item
      && typeof item === 'object'
      && 'id' in item
      && item.id === baseAchievement.id
    )) as Partial<Achievement> | undefined;
    const unlockedAt = stored?.unlockedAt ? new Date(stored.unlockedAt) : undefined;

    return {
      ...baseAchievement,
      unlockedAt: unlockedAt && !Number.isNaN(unlockedAt.getTime()) ? unlockedAt : undefined,
    };
  });
};

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'LOAD_ACHIEVEMENTS':
      return { ...state, achievements: action.payload };

    case 'UNLOCK_ACHIEVEMENT':
      return {
        ...state,
        achievements: state.achievements.map(achievement => (
          achievement.id === action.payload && !achievement.unlockedAt
            ? { ...achievement, unlockedAt: new Date() }
            : achievement
        )),
      };

    default:
      return state;
  }
}

interface OnboardingContextType {
  state: OnboardingState;
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
        dispatch({ type: 'LOAD_ACHIEVEMENTS', payload: normalizeAchievements(parsed.achievements) });
      } catch (error) {
        console.error('Failed to load achievement state:', error);
        dispatch({ type: 'LOAD_ACHIEVEMENTS', payload: INITIAL_ACHIEVEMENTS });
      }
    }

    localStorage.setItem('has_seen_first_entry_scroll', 'true');
    setHasLoadedStoredState(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredState) return;

    localStorage.setItem(
      'tarot_onboarding_state',
      JSON.stringify({ achievements: state.achievements }),
    );
  }, [hasLoadedStoredState, state.achievements]);

  const checkAndUnlockAchievements = useCallback((readingCount: number, hasPublic: boolean, aiCount: number, streak: number) => {
    state.achievements.forEach(achievement => {
      if (achievement.unlockedAt) return;

      let shouldUnlock = false;
      switch (achievement.id) {
        case 'first_reading':
        case 'seven_readings':
        case 'multi_card_master':
          shouldUnlock = readingCount >= achievement.threshold;
          break;
        case 'public_share':
          shouldUnlock = hasPublic;
          break;
        case 'ai_insight':
          shouldUnlock = aiCount >= achievement.threshold;
          break;
        case 'daily_streak':
          shouldUnlock = streak >= achievement.threshold;
          break;
      }

      if (shouldUnlock) {
        dispatch({ type: 'UNLOCK_ACHIEVEMENT', payload: achievement.id });
      }
    });
  }, [state.achievements]);

  return (
    <OnboardingContext.Provider value={{ state, checkAndUnlockAchievements }}>
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
