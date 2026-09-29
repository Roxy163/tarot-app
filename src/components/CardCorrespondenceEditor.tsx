import { useState } from 'react';
import { Save } from 'lucide-react';
import { TarotCardMetadata } from '../types';
import { PageView } from './PageView';
import { ConfirmDialog } from './ConfirmDialog';

interface CardCorrespondenceEditorProps {
  card: { name: string; isReversed: boolean };
  metadata: TarotCardMetadata;
  onUpdate: (updated: TarotCardMetadata) => void;
  onClose: () => void;
}

export function CardCorrespondenceEditor({ card, metadata, onUpdate, onClose }: CardCorrespondenceEditorProps) {

  const [localMetadata, setLocalMetadata] = useState<TarotCardMetadata>(metadata);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const requestBack = () => {
    if (JSON.stringify(localMetadata) !== JSON.stringify(metadata)) setShowLeaveConfirm(true);
    else onClose();
  };

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
    <PageView isOpen onBack={requestBack} title={`编辑对应 · ${card.name}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">行星</label>
              <input 
                className="min-h-11 w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：月亮、水星..."
                value={localMetadata.astrology?.planet || ''}
                onChange={e => handleChange('planet', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">星座</label>
              <input 
                className="min-h-11 w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：双鱼座、白羊座..."
                value={localMetadata.astrology?.zodiac || ''}
                onChange={e => handleChange('zodiac', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">先天宫位</label>
              <input 
                className="min-h-11 w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：第一宫、第十二宫..."
                value={localMetadata.astrology?.house || ''}
                onChange={e => handleChange('house', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forest-muted uppercase tracking-wider">四元素</label>
              <input 
                className="min-h-11 w-full px-3 py-2 bg-forest-bg border border-forest-accent/10 rounded-lg focus:ring-2 focus:ring-forest-accent/20 text-sm"
                placeholder="如：水、火、风、土..."
                value={localMetadata.astrology?.element || ''}
                onChange={e => handleChange('element', e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => {
                try { onUpdate(localMetadata); onClose(); }
                catch { setSaveError('保存失败，内容仍在此页，请稍后重试。'); }
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
      {saveError && <p role="alert" className="mt-3 text-sm text-forest-ink">{saveError}</p>}
      <ConfirmDialog isOpen={showLeaveConfirm} title="离开对应关系编辑" message="还有未保存的修改。" confirmText="放弃修改并返回" cancelText="继续编辑" onConfirm={onClose} onClose={() => setShowLeaveConfirm(false)} />
    </PageView>
  );
}
