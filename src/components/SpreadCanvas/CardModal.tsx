import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, FlipVertical } from 'lucide-react';
import { useSpreadCanvasStore, getCardMeaning, getCardData } from '../../store/spreadCanvasStore';

export const CardModal: React.FC = () => {
  const {
    showCardModal,
    selectedCardForModal,
    closeCardModal,
    flipCard,
    updateCard,
    removeCard
  } = useSpreadCanvasStore();

  const [activeTab, setActiveTab] = useState<'upright' | 'reversed'>('upright');

  if (!selectedCardForModal) return null;

  const cardData = getCardData(selectedCardForModal.cardId);
  const meanings = getCardMeaning(selectedCardForModal.cardId, selectedCardForModal.isReversed);

  const handleFlip = () => {
    if (selectedCardForModal.id) {
      flipCard(selectedCardForModal.id);
    }
  };

  const handleRotate = (delta: number) => {
    if (selectedCardForModal.id) {
      updateCard(selectedCardForModal.id, { rotation: selectedCardForModal.rotation + delta });
    }
  };

  const handleScale = (delta: number) => {
    if (selectedCardForModal.id) {
      const newScale = Math.max(0.5, Math.min(2, selectedCardForModal.scale + delta));
      updateCard(selectedCardForModal.id, { scale: newScale });
    }
  };

  const handleDelete = () => {
    if (confirm('确定要删除这张牌吗？') && selectedCardForModal.id) {
      removeCard(selectedCardForModal.id);
      closeCardModal();
    }
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedCardForModal.id) {
      updateCard(selectedCardForModal.id, { label: e.target.value });
    }
  };

  return (
    <AnimatePresence>
      {showCardModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeCardModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-2xl bg-[#1a1a2e] border border-[#d4af37] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#d4af37]/20 flex items-center justify-center">
                  <span className="text-[#d4af37] font-bold text-lg">{cardData?.name?.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">
                    {cardData?.name || '未知卡牌'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedCardForModal.isReversed ? '逆位' : '正位'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCardModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                  <div
                    className="w-32 h-48 rounded-lg overflow-hidden border-2 border-[#d4af37]/30 shadow-lg"
                    style={{
                      transform: `rotate(${selectedCardForModal.rotation}deg) scale(${selectedCardForModal.scale})`
                    }}
                  >
                    <img
                      src={`https://tarot-copilot.bytedance.net/api/cards/${selectedCardForModal.cardId}`}
                      alt={cardData?.name}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => handleRotate(-15)}
                      className="px-3 py-1.5 bg-[#2d1f47] text-[#d4af37] rounded-lg text-xs font-bold hover:bg-[#3d2a5c] transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={14} /> -15°
                    </button>
                    <button
                      onClick={handleFlip}
                      className="px-3 py-1.5 bg-[#d4af37] text-[#1a1a2e] rounded-lg text-xs font-bold hover:bg-[#e4bf47] transition-colors flex items-center gap-1"
                    >
                      <FlipVertical size={14} /> 翻转
                    </button>
                    <button
                      onClick={() => handleRotate(15)}
                      className="px-3 py-1.5 bg-[#2d1f47] text-[#d4af37] rounded-lg text-xs font-bold hover:bg-[#3d2a5c] transition-colors flex items-center gap-1"
                    >
                      +15° <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleScale(-0.1)}
                      className="px-2 py-1 bg-white/5 text-white text-xs rounded hover:bg-white/10"
                    >
                      -
                    </button>
                    <span className="text-xs text-gray-400">
                      {(selectedCardForModal.scale * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => handleScale(0.1)}
                      className="px-2 py-1 bg-white/5 text-white text-xs rounded hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">位置标签</label>
                    <input
                      type="text"
                      value={selectedCardForModal.label}
                      onChange={handleLabelChange}
                      placeholder="输入位置标签..."
                      className="w-full px-3 py-2 bg-[#2d1f47] border border-[#d4af37]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('upright')}
                      className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                        activeTab === 'upright'
                          ? 'bg-[#d4af37] text-[#1a1a2e]'
                          : 'bg-[#2d1f47] text-gray-400 hover:text-white'
                      }`}
                    >
                      正位解读
                    </button>
                    <button
                      onClick={() => setActiveTab('reversed')}
                      className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                        activeTab === 'reversed'
                          ? 'bg-[#d4af37] text-[#1a1a2e]'
                          : 'bg-[#2d1f47] text-gray-400 hover:text-white'
                      }`}
                    >
                      逆位解读
                    </button>
                  </div>

                  <div className="bg-[#2d1f47] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-[#d4af37] mb-2">
                      {activeTab === 'upright' ? '正位含义' : '逆位含义'}
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {activeTab === 'upright' ? meanings.upright : meanings.reversed}
                    </p>
                  </div>

                  {cardData?.keywords && cardData.keywords.length > 0 && (
                    <div className="bg-[#2d1f47] rounded-lg p-4">
                      <h4 className="text-sm font-bold text-[#d4af37] mb-2">关键词</h4>
                      <div className="flex flex-wrap gap-2">
                        {cardData.keywords.map((keyword, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-[#d4af37]/20 text-[#d4af37] text-xs rounded-full"
                          >
                            {keyword.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-400 text-sm font-bold hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  删除卡牌
                </button>
                <button
                  onClick={closeCardModal}
                  className="px-4 py-2 bg-[#d4af37] text-[#1a1a2e] text-sm font-bold rounded-lg hover:bg-[#e4bf47] transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};