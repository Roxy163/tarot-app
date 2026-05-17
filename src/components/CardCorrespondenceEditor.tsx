import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Save, Info } from 'lucide-react';
import { TarotCardMetadata } from '../types';

interface CardCorrespondenceEditorProps {
  card: { name: string; isReversed: boolean };
  metadata: TarotCardMetadata;
  onUpdate: (updated: TarotCardMetadata) => void;
  onClose: () => void;
}

export function CardCorrespondenceEditor({ card, metadata, onUpdate, onClose }: CardCorrespondenceEditorProps) {
  const [localMetadata, setLocalMetadata] = useState<TarotCardMetadata>(metadata);

  const handleChange = (field: keyof NonNullable<TarotCardMetadata['astrology']>, value: string) => {
    setLocalMetadata({
      ...localMetadata,
      astrology: {
        ...localMetadata.astrology,
        [field]: value
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-forest-accent/10 flex items-center justify-between bg-forest-bg/30">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-forest-accent" />
            <h3 className="font-serif text-lg text-forest-accent">修改牌面对应关系: {card.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-forest-accent/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">行星</label>
              <input 
                className="w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：月亮、水星..."
                value={localMetadata.astrology?.planet || ''}
                onChange={e => handleChange('planet', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">星座</label>
              <input 
                className="w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：双鱼座、白羊座..."
                value={localMetadata.astrology?.zodiac || ''}
                onChange={e => handleChange('zodiac', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">先天宫位</label>
              <input 
                className="w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：第一宫、第十二宫..."
                value={localMetadata.astrology?.house || ''}
                onChange={e => handleChange('house', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">四元素</label>
              <input 
                className="w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：水、火、风、土..."
                value={localMetadata.astrology?.element || ''}
                onChange={e => handleChange('element', e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => {
                onUpdate(localMetadata);
                onClose();
              }}
              className="w-full py-3 bg-forest-accent text-white rounded-xl font-medium hover:bg-forest-accent/90 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Save size={18} />
              保存对应关系
            </button>
          </div>
          
          <p className="text-[10px] text-forest-muted text-center italic">
            提示：修改后的对应关系将全局生效并保存在本地。
          </p>
        </div>
      </motion.div>
    </div>
  );
}
