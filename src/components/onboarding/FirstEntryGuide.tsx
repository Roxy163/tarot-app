import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, PenLine, ChevronRight, X } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';

const FIRST_ENTRY_STEPS = [
  {
    title: '入阁敕令',
    subtitle: '开启您的塔罗研习之旅',
    content: '今有问道者一人，于虚无中开辟一方灵台，赐号"塔罗研习阁"。汝为第一任阁主。愿汝勤加研习，自注牌义，成一家之言。',
    icon: Sparkles,
    action: '开始导览',
    showSkip: true,
  },
  {
    title: '研习台',
    subtitle: '每日灵见的起点',
    content: '研习台是您的每日入口，展示箴言、快捷抽牌和研习模块。在这里开启您的每日灵见之旅。',
    icon: BookOpen,
    action: '了解更多',
    showSkip: true,
  },
  {
    title: '抽牌手记',
    subtitle: '记录每一次灵见',
    content: '选择牌阵、抽取卡牌、撰写解读，完整记录您的占卜之旅。长按卡牌可快速清空。',
    icon: PenLine,
    action: '开始研习',
    showSkip: true,
  },
];

export const FirstEntryGuide: React.FC = () => {
  const { state, nextStep, completeFirstEntry, skipFirstEntry } = useOnboarding();
  const currentStep = FIRST_ENTRY_STEPS[state.currentStep];

  if (!currentStep) {
    completeFirstEntry();
    return null;
  }

  const isLastStep = state.currentStep === FIRST_ENTRY_STEPS.length - 1;

  const handleAction = () => {
    if (isLastStep) {
      completeFirstEntry();
    } else {
      nextStep();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-forest-text/40 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="max-w-lg w-full p-8 rounded-[2rem] shadow-2xl border-4 border-forest-accent/10 text-center space-y-8 relative overflow-hidden bg-white"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-forest-accent/30 to-transparent" />

        {currentStep.showSkip && (
          <button
            onClick={skipFirstEntry}
            aria-label="跳过新手导览"
            className="absolute top-4 right-4 p-2 text-forest-muted hover:text-forest-accent transition-colors"
          >
            <X size={20} />
          </button>
        )}

        <div className="flex justify-center gap-2">
          {FIRST_ENTRY_STEPS.map((_, index) => (
            <motion.div
              key={index}
              initial={{ width: 8 }}
              animate={{ width: index === state.currentStep ? 24 : 8 }}
              transition={{ duration: 0.3 }}
              className={`h-1.5 rounded-full ${
                index === state.currentStep ? 'bg-forest-accent' : 'bg-forest-border'
              }`}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-forest-accent/20 to-forest-pink/20 flex items-center justify-center"
        >
          <currentStep.icon className="text-forest-accent" size={40} />
        </motion.div>

        <div className="space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl sm:text-3xl font-serif text-forest-accent"
          >
            {currentStep.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-forest-muted font-medium"
          >
            {currentStep.subtitle}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-base text-forest-text leading-relaxed font-serif italic"
          >
            {currentStep.content}
          </motion.p>
        </div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={handleAction}
          className="w-full px-10 py-4 bg-forest-pink text-white rounded-full font-bold text-lg hover:bg-forest-pink/90 transition-all shadow-xl shadow-forest-pink/30 flex items-center justify-center gap-2"
        >
          <span>{currentStep.action}</span>
          {!isLastStep && <ChevronRight size={20} />}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};