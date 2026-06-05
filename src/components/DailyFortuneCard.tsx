import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Sparkles, ChevronDown, ChevronUp, PenLine, RefreshCw, Shuffle, Eye } from 'lucide-react';
import { DailyFortune } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';

interface FortuneChoice {
  cardNumber: number;
  cardIndex: number;
  isRevealed: boolean;
}

interface DailyFortuneCardProps {
  fortune: DailyFortune | null;
  onGenerate: () => void;
  onGenerateWithNumber: (cardNumber: number, cardIndex?: number) => void;
  onReshuffle: () => void;
  onAddReflection: (id: string, reflection: string) => void;
}

export const DailyFortuneCard: React.FC<DailyFortuneCardProps> = ({
  fortune,
  onGenerate,
  onGenerateWithNumber,
  onReshuffle,
  onAddReflection
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [showReflectionInput, setShowReflectionInput] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [showNumberInput, setShowNumberInput] = useState(false);
  const [shufflePhase, setShufflePhase] = useState<'idle' | 'shuffling' | 'selected' | 'revealed'>('idle');
  const [shuffleCount, setShuffleCount] = useState(0);
  const [fortuneChoice, setFortuneChoice] = useState<FortuneChoice | null>(null);

  const cardData = fortune ? TAROT_CARDS.find(c => c.name === fortune.cardName) : null;

  const handleShuffle = async () => {
    setShufflePhase('shuffling');
    setShuffleCount(0);
    setFortuneChoice(null);
    setShowNumberInput(false);
    
    const shuffleInterval = setInterval(() => {
      setShuffleCount(prev => {
        if (prev >= 15) {
          clearInterval(shuffleInterval);
          setTimeout(() => {
            setShufflePhase('selected');
            setShowNumberInput(true);
          }, 300);
          return prev;
        }
        return prev + 1;
      });
    }, 80);
  };

  const handleNumberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(cardNumber);
    if (num >= 1 && num <= 78) {
      const deck = [...Array(TAROT_CARDS.length).keys()];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      setFortuneChoice({
        cardNumber: num,
        cardIndex: deck[num - 1],
        isRevealed: false
      });
      setShowNumberInput(false);
      setCardNumber('');
    }
  };

  const handleReveal = () => {
    if (fortuneChoice) {
      setFortuneChoice({ ...fortuneChoice, isRevealed: true });
      setShufflePhase('revealed');
      onGenerateWithNumber(fortuneChoice.cardNumber, fortuneChoice.cardIndex);
    }
  };

  const handleRandomDraw = () => {
    const randomNum = Math.floor(Math.random() * 78) + 1;
    const deck = [...Array(TAROT_CARDS.length).keys()];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setFortuneChoice({
      cardNumber: randomNum,
      cardIndex: deck[randomNum - 1],
      isRevealed: false
    });
    setShufflePhase('selected');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-[2rem] bg-gradient-to-br from-forest-accent/10 to-forest-pink/5 border border-forest-accent/20 overflow-hidden"
    >
      {fortune ? (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sun className="text-forest-accent" size={16} />
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-forest-accent">今日运势</span>
            </div>
            <span className="text-[10px] text-forest-muted">{fortune.date}</span>
          </div>

          <div className="flex gap-4">
            <motion.div
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ duration: 0.8, type: 'spring' }}
              className={`relative w-20 h-30 rounded-xl overflow-hidden border-2 border-forest-accent/20 shadow-lg ${fortune.isReversed ? 'rotate-180' : ''}`}
            >
              <img
                src={getCardImageUrl(cardData?.id || 'ar00')}
                alt={fortune.cardName}
                className="w-full h-full object-contain bg-forest-bg"
                referrerPolicy="no-referrer"
              />
              <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold ${
                fortune.isReversed ? 'bg-red-500/80 text-white' : 'bg-green-500/80 text-white'
              }`}>
                {fortune.isReversed ? '逆位' : '正位'}
              </div>
            </motion.div>

            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-serif font-bold text-forest-ink">{fortune.cardName}</h3>
              <p className="text-sm text-forest-text/80 leading-relaxed">{fortune.interpretation}</p>
              <div className="flex flex-wrap gap-1.5">
                {fortune.keywords.map((kw, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-forest-accent/10 text-forest-accent text-[10px] rounded-full font-medium">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onReshuffle}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-3 bg-white/50 hover:bg-white rounded-xl transition-all text-xs text-forest-ink"
          >
            <RefreshCw size={14} />
            <span>重新抽牌</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-xs text-forest-muted hover:text-forest-accent transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{isExpanded ? '收起详情' : '查看详情'}</span>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-forest-accent/10 mt-4 pt-4"
              >
                {fortune.reflection ? (
                  <div className="p-3 bg-forest-bg rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine size={12} className="text-forest-accent" />
                      <span className="text-[10px] font-bold text-forest-accent uppercase tracking-wider">今日感悟</span>
                    </div>
                    <p className="text-sm text-forest-ink leading-relaxed">{fortune.reflection}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowReflectionInput(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-forest-accent/5 hover:bg-forest-accent/10 rounded-xl transition-colors"
                    >
                      <PenLine size={14} className="text-forest-accent" />
                      <span className="text-xs text-forest-accent font-medium">记录今日感悟</span>
                    </button>

                    <AnimatePresence>
                      {showReflectionInput && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-3"
                        >
                          <textarea
                            value={reflectionText}
                            onChange={(e) => setReflectionText(e.target.value)}
                            placeholder="写下今天的感悟..."
                            className="w-full p-3 bg-white border border-forest-accent/10 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-forest-accent/20"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowReflectionInput(false)}
                              className="flex-1 px-4 py-2 text-xs text-forest-muted hover:text-forest-ink transition-colors rounded-xl"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => {
                                if (reflectionText.trim()) {
                                  onAddReflection(fortune.id, reflectionText.trim());
                                  setReflectionText('');
                                  setShowReflectionInput(false);
                                }
                              }}
                              className="flex-1 px-4 py-2 bg-forest-accent text-white text-xs font-medium rounded-xl hover:bg-forest-accent/90 transition-colors"
                            >
                              保存感悟
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : fortuneChoice && shufflePhase === 'selected' && !fortuneChoice.isRevealed ? (
        <div className="p-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="w-24 h-32 mx-auto rounded-xl bg-gradient-to-br from-forest-accent/30 to-forest-pink/30 flex items-center justify-center relative border-2 border-forest-accent/20 shadow-lg">
              <div className="text-center">
                <Moon className="text-forest-accent/50 mx-auto mb-2" size={32} />
                <span className="text-[10px] text-forest-muted">牌面已封存</span>
              </div>
              <div className="absolute inset-0 rounded-xl border-2 border-dashed border-forest-accent/30" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-forest-ink font-medium">你选择了第 {fortuneChoice.cardNumber} 张牌</p>
              <p className="text-xs text-forest-muted">准备好了吗？点击下方按钮揭晓答案</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleReveal}
                className="w-full px-6 py-4 bg-forest-accent text-white rounded-full text-sm font-bold hover:bg-forest-accent/90 transition-all shadow-xl shadow-forest-accent/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-2">
                  <Eye size={18} />
                  揭晓答案
                </span>
              </button>
              
              <button
                onClick={() => {
                  setShufflePhase('idle');
                  setFortuneChoice(null);
                }}
                className="w-full px-6 py-3 bg-white/50 hover:bg-white rounded-xl text-sm text-forest-ink transition-all"
              >
                重新选择
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <AnimatePresence mode="wait">
            {shufflePhase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-forest-accent/20 to-forest-pink/20 flex items-center justify-center">
                  <Sparkles className="text-forest-accent" size={36} />
                </div>
                <h3 className="text-xl font-serif font-bold text-forest-ink">开启今日运势</h3>
                <p className="text-sm text-forest-muted">每日一抽，探索今日能量指引</p>
                
                <div className="space-y-3">
                  <button
                    onClick={handleShuffle}
                    className="w-full px-6 py-4 bg-forest-accent text-white rounded-full text-sm font-bold hover:bg-forest-accent/90 transition-all shadow-xl shadow-forest-accent/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Shuffle size={18} />
                      开始洗牌
                    </span>
                  </button>
                  
                  <button
                    onClick={handleRandomDraw}
                    className="w-full px-6 py-3 bg-white/50 hover:bg-white rounded-xl text-sm text-forest-ink transition-all"
                  >
                    🎲 随机抽牌
                  </button>
                </div>
              </motion.div>
            )}

            {shufflePhase === 'shuffling' && (
              <motion.div
                key="shuffling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <motion.div
                  className="w-24 h-24 mx-auto rounded-xl bg-gradient-to-br from-forest-accent/30 to-forest-pink/30 flex items-center justify-center relative"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                >
                  <Moon className="text-forest-accent" size={40} />
                  <motion.div
                    className="absolute inset-0 rounded-xl border-4 border-forest-accent/30"
                    animate={{ scale: [1, 1.1, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  />
                </motion.div>
                
                <motion.p 
                  className="text-lg font-serif font-bold text-forest-ink"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  洗牌中 {shuffleCount}/15
                </motion.p>
                
                <div className="w-full max-w-xs mx-auto">
                  <div className="h-2 bg-forest-accent/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-forest-accent rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(shuffleCount / 15) * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {shufflePhase === 'selected' && showNumberInput && (
              <motion.div
                key="number-input"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-forest-accent/20 to-forest-pink/20 flex items-center justify-center">
                  <Sparkles className="text-forest-accent" size={36} />
                </div>
                <h3 className="text-xl font-serif font-bold text-forest-ink">静心抽牌</h3>
                
                <div className="space-y-4 bg-forest-bg/50 rounded-2xl p-4">
                  <div className="space-y-2">
                    <p className="text-xs text-forest-muted leading-relaxed">
                      请闭上眼睛，深呼吸三次...<br/>
                      当你准备好时，在心中默念一个数字（1-78）<br/>
                      然后睁开眼睛输入这个数字
                    </p>
                    <div className="flex items-center justify-center gap-2 py-2">
                      <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-forest-accent" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} className="w-2 h-2 rounded-full bg-forest-accent" />
                      <motion.div animate={{ opacity: [0.3, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }} className="w-2 h-2 rounded-full bg-forest-accent" />
                    </div>
                  </div>
                  
                  <form onSubmit={handleNumberSubmit} className="space-y-3">
                    <input
                      type="number"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="输入你心中的数字..."
                      min="1"
                      max="78"
                      className="w-full px-4 py-3 border-2 border-forest-accent/20 rounded-xl text-center text-lg focus:outline-none focus:border-forest-accent/50 transition-colors"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShufflePhase('idle');
                          setCardNumber('');
                        }}
                        className="flex-1 px-4 py-2 text-xs text-forest-muted hover:text-forest-ink transition-colors rounded-xl"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={!cardNumber || parseInt(cardNumber) < 1 || parseInt(cardNumber) > 78}
                        className="flex-1 px-4 py-2 bg-forest-accent text-white text-xs font-bold rounded-xl hover:bg-forest-accent/90 transition-all disabled:opacity-50"
                      >
                        确认选择
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};
