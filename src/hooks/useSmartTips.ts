import { useEffect, useState, useCallback } from 'react';
import { useOnboarding } from '../context/OnboardingContext';

export interface SmartTip {
  id: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

const SMART_TIPS: SmartTip[] = [
  {
    id: 'no-readings',
    message: '🌙 还没有研习记录？点击下方"手记"写下第一条抽牌手记吧！',
    actionLabel: '写第一条手记',
  },
  {
    id: 'empty-question',
    message: '💡 建议添加一个问题，这样能让解读更有针对性。',
    actionLabel: '添加问题',
  },
  {
    id: 'long-press-hint',
    message: '🔄 长按卡牌空位可以快速清空已选的卡牌哦！',
  },
  {
    id: 'try-spread',
    message: '🎴 试试不同的牌阵吧！三牌阵和凯尔特十字都是不错的选择。',
    actionLabel: '浏览牌阵',
  },
  {
    id: 'daily-reading',
    message: '🌅 记录今日一张牌，把牌义和真实生活对应起来。',
    actionLabel: '日运记录',
  },
];

export function useSmartTips(readingsCount: number, hasQuestion: boolean, hasCards: boolean) {
  const { state } = useOnboarding();
  const [currentTip, setCurrentTip] = useState<SmartTip | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const shouldShowTip = useCallback((): SmartTip | null => {
    if (!state.hasCompletedFirstEntry) return null;
    
    const hasSeenLongPress = localStorage.getItem('saw_longpress_hint');
    
    if (readingsCount === 0) {
      return SMART_TIPS.find(t => t.id === 'no-readings') || null;
    }
    
    if (!hasQuestion && hasCards) {
      return SMART_TIPS.find(t => t.id === 'empty-question') || null;
    }
    
    if (!hasSeenLongPress && readingsCount >= 1) {
      return SMART_TIPS.find(t => t.id === 'long-press-hint') || null;
    }
    
    const today = new Date().toDateString();
    const lastTipDate = localStorage.getItem('last_tip_date');
    if (lastTipDate !== today && readingsCount >= 2) {
      const randomTip = SMART_TIPS.filter(t => 
        t.id !== 'no-readings' && 
        t.id !== 'empty-question' && 
        t.id !== 'long-press-hint'
      );
      return randomTip[Math.floor(Math.random() * randomTip.length)] || null;
    }
    
    return null;
  }, [readingsCount, hasQuestion, hasCards, state.hasCompletedFirstEntry]);

  useEffect(() => {
    const tip = shouldShowTip();
    if (tip) {
      setCurrentTip(tip);
      setIsVisible(true);
      localStorage.setItem('last_tip_date', new Date().toDateString());
      
      if (tip.id === 'long-press-hint') {
        localStorage.setItem('saw_longpress_hint', 'true');
      }
    }
  }, [shouldShowTip]);

  const dismissTip = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => setCurrentTip(null), 300);
  }, []);

  return {
    currentTip,
    isVisible,
    dismissTip,
  };
}
