import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { TAROT_CARDS, getCardImageUrl } from '../constants';

interface CardPickerProps {
  onSelect: (card: typeof TAROT_CARDS[0], isReversed: boolean) => void;
  onClose: () => void;
  excludeCards?: string[];
}

export function CardPicker({ onSelect, onClose, excludeCards = [] }: CardPickerProps) {
  const [search, setSearch] = useState('');
  const [isReversed, setIsReversed] = useState(false);

  const filteredCards = TAROT_CARDS.filter(c => 
    c.name.includes(search) || c.english.toLowerCase().includes(search.toLowerCase())
  );

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-forest-accent/20 text-forest-accent font-bold">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-forest-accent/10 flex items-center justify-between bg-forest-bg/30">
          <h3 className="font-serif text-lg text-forest-accent">选择塔罗牌</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input 
                type="checkbox" 
                checked={isReversed} 
                onChange={e => setIsReversed(e.target.checked)}
                className="accent-forest-accent"
              />
              逆位
            </label>
            <button onClick={onClose} className="p-1 hover:bg-forest-accent/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-4 border-b border-forest-accent/5">
          <input 
            autoFocus
            className="w-full px-4 py-2 bg-forest-bg border-none rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
            placeholder="搜索牌名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {filteredCards.map(card => {
            const isExcluded = excludeCards.includes(card.name);
            return (
              <button
                key={card.id}
                disabled={isExcluded}
                onClick={() => onSelect(card, isReversed)}
                className={`group flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                  isExcluded ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-forest-accent/5 active:scale-95'
                }`}
              >
                <div className={`aspect-[2/3.5] w-full bg-forest-bg rounded-lg overflow-hidden border border-forest-accent/10 group-hover:border-forest-accent/30 ${isReversed ? 'rotate-180' : ''}`}>
                  <img 
                    src={getCardImageUrl(card.id)} 
                    alt={card.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[10px] text-forest-ink font-medium truncate w-full text-center">
                  {highlightMatch(card.name, search)}
                  {isExcluded && <span className="block text-[8px] text-forest-accent mt-0.5">(已选)</span>}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
