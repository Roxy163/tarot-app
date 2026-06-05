import React, { useState } from 'react';
import { useSpreadCanvasStore, TAROT_CARDS } from '../../store/spreadCanvasStore';
import { Grid3X3, Upload, Download, RotateCcw, Plus } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';

export const ToolPanel: React.FC = () => {
  const {
    templates,
    loadTemplate,
    exportSpread,
    importSpread,
    clearSpread,
    undo,
    redo,
    addCard
  } = useSpreadCanvasStore();

  const [showCardPicker, setShowCardPicker] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleExport = () => {
    const json = exportSpread();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarot-spread-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      importSpread(json);
    };
    reader.readAsText(file);
    setImportFile(null);
  };

  const handleAddCard = (cardId: string) => {
    addCard(cardId, 0, 0);
    setShowCardPicker(false);
  };

  return (
    <div className="w-64 bg-[#1a1a2e] border-r border-[#d4af37]/30 flex flex-col h-full">
      <div className="p-4 border-b border-[#d4af37]/30">
        <h2 className="text-lg font-serif font-bold text-[#d4af37]">牌阵工作台</h2>
        <p className="text-xs text-gray-500 mt-1">自由画布模式</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <Grid3X3 size={14} />
            牌阵模板
          </h3>
          <div className="space-y-2">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => loadTemplate(template.id)}
                className="w-full px-3 py-2 bg-[#2d1f47] hover:bg-[#3d2a5c] text-left rounded-lg transition-colors"
              >
                <p className="text-sm font-bold text-white">{template.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <Plus size={14} />
            添加卡牌
          </h3>
          <button
            onClick={() => setShowCardPicker(!showCardPicker)}
            className="w-full px-3 py-2 bg-[#d4af37] hover:bg-[#e4bf47] text-[#1a1a2e] font-bold rounded-lg transition-colors"
          >
            {showCardPicker ? '收起牌库' : '从牌库添加'}
          </button>

          {showCardPicker && (
            <div className="mt-2 max-h-48 overflow-y-auto grid grid-cols-4 gap-2">
              {TAROT_CARDS.slice(0, 22).map(card => (
                <button
                  key={card.id}
                  onClick={() => handleAddCard(card.id)}
                  className="aspect-[2/3] bg-[#2d1f47] hover:bg-[#3d2a5c] rounded-lg p-1 flex flex-col items-center justify-center transition-colors"
                  title={card.name}
                >
                  <span className="text-[10px] text-[#d4af37] font-bold">{card.id.replace('ma', '').replace('ar', '')}</span>
                  <span className="text-[8px] text-gray-400 text-center mt-1 truncate w-full">{card.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-300 mb-3">操作</h3>
          <div className="space-y-2">
            <button
              onClick={undo}
              className="w-full px-3 py-2 bg-[#2d1f47] hover:bg-[#3d2a5c] text-left rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw size={14} className="rotate-180" />
              <span className="text-sm text-gray-300">撤销</span>
            </button>
            <button
              onClick={redo}
              className="w-full px-3 py-2 bg-[#2d1f47] hover:bg-[#3d2a5c] text-left rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw size={14} />
              <span className="text-sm text-gray-300">重做</span>
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-300 mb-3">导入/导出</h3>
          <div className="space-y-2">
            <label className="w-full px-3 py-2 bg-[#2d1f47] hover:bg-[#3d2a5c] cursor-pointer text-left rounded-lg transition-colors flex items-center gap-2">
              <Upload size={14} />
              <span className="text-sm text-gray-300">导入牌阵</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExport}
              className="w-full px-3 py-2 bg-[#2d1f47] hover:bg-[#3d2a5c] text-left rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={14} />
              <span className="text-sm text-gray-300">导出牌阵</span>
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg transition-colors"
        >
          清空牌阵
        </button>
      </div>

      <div className="p-4 border-t border-[#d4af37]/30">
        <p className="text-[10px] text-gray-600 text-center">
          拖拽画布 | Ctrl+滚轮缩放 | Delete删除
        </p>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="清空牌阵"
        message="确定要清空所有牌吗？"
        confirmText="清空"
        destructive
        onConfirm={clearSpread}
        onClose={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
