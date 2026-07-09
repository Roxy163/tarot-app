import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, Layers, Globe, Brain, Calendar, Lock } from 'lucide-react';
import { Achievement } from '../../context/OnboardingContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface AchievementDisplayProps {
  achievements: Achievement[];
  onViewAll?: () => void;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sparkles,
  BookOpen,
  Layers,
  Globe,
  Brain,
  Calendar,
};

export const AchievementDisplay: React.FC<AchievementDisplayProps> = ({
  achievements,
  onViewAll,
}) => {
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Achievement | null>(null);
  useBodyScrollLock(Boolean(recentlyUnlocked));

  useEffect(() => {
    const unlocked = achievements.filter(a => a.unlockedAt).sort((a, b) => 
      new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime()
    );
    
    if (unlocked.length > 0) {
      const latest = unlocked[0];
      const unlockTime = new Date(latest.unlockedAt!);
      const now = new Date();
      
      if (now.getTime() - unlockTime.getTime() < 5000) {
        setRecentlyUnlocked(latest);
        setTimeout(() => setRecentlyUnlocked(null), 4000);
      }
    }
  }, [achievements]);

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;

  return (
    <>
      <AnimatePresence>
        {recentlyUnlocked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-forest-text/30 backdrop-blur-xl cursor-pointer overscroll-contain"
            onClick={() => setRecentlyUnlocked(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="text-center space-y-6 cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative inline-block">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 bg-forest-accent/20 rounded-full blur-3xl scale-150"
                />
                <div className="relative p-8 bg-white/80 rounded-full border-4 border-forest-accent shadow-2xl">
                  {(() => {
                    const Icon = iconMap[recentlyUnlocked.icon];
                    return Icon ? <Icon size={64} className="text-forest-accent" /> : <Sparkles size={64} className="text-forest-accent" />;
                  })()}
                </div>
              </div>
              
              <div className="space-y-2">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-serif text-forest-accent font-bold tracking-widest"
                >
                  成就达成
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-forest-text font-serif"
                >
                  恭喜获得成就 <span className="text-forest-accent underline underline-offset-8 decoration-wavy font-bold">"{recentlyUnlocked.title}"</span>
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-forest-muted"
                >
                  {recentlyUnlocked.description}
                </motion.p>
              </div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-sm text-forest-muted animate-bounce"
              >
                点击任意处继续研习
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-serif text-forest-ink font-bold">🏆 研习成就</h3>
          {unlockedCount > 0 && onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm text-forest-accent hover:underline transition-colors"
            >
              查看全部 ({unlockedCount}/{achievements.length})
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {achievements.slice(0, 6).map((achievement, index) => {
            const Icon = iconMap[achievement.icon] || Sparkles;
            const isUnlocked = !!achievement.unlockedAt;
            
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-4 rounded-2xl border transition-all ${
                  isUnlocked 
                    ? 'bg-gradient-to-br from-forest-accent/5 to-forest-pink/5 border-forest-accent/20' 
                    : 'bg-white border-forest-border/30 opacity-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${
                  isUnlocked ? 'bg-forest-accent/10' : 'bg-forest-border/20'
                }`}>
                  {isUnlocked ? (
                    <Icon size={20} className="text-forest-accent" />
                  ) : (
                    <Lock size={16} className="text-forest-muted" />
                  )}
                </div>
                <p className={`text-xs font-bold text-center ${
                  isUnlocked ? 'text-forest-ink' : 'text-forest-muted'
                }`}>
                  {isUnlocked ? achievement.title : '???'}
                </p>
                {!isUnlocked && (
                  <p className="text-[10px] text-forest-muted/50 text-center mt-1">
                    {achievement.threshold}次
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
};
