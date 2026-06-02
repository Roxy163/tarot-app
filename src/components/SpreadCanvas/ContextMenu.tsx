import React from 'react';
import { useSpreadCanvasStore } from '../../store/spreadCanvasStore';
import { FileText, Trash2, Download } from 'lucide-react';

export const ContextMenu: React.FC = () => {
  const {
    showContextMenu,
    contextMenuPosition,
    hideContextMenu,
    clearSpread,
    exportSpread
  } = useSpreadCanvasStore();

  const handleExport = () => {
    const json = exportSpread();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarot-spread-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    hideContextMenu();
  };

  const handleClear = () => {
    if (confirm('确定要清空所有牌吗？')) {
      clearSpread();
    }
    hideContextMenu();
  };

  if (!showContextMenu) return null;

  return (
    <div
      className="fixed z-50 bg-[#1a1a2e] border border-[#d4af37] rounded-lg shadow-xl py-2 min-w-[160px]"
      style={{
        left: contextMenuPosition.x,
        top: contextMenuPosition.y
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={handleExport}
        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#2d1f47] flex items-center gap-2"
      >
        <Download size={16} />
        导出牌阵
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#2d1f47] flex items-center gap-2"
      >
        <FileText size={16} />
        添加便签
      </button>
      <div className="border-t border-gray-700 my-1" />
      <button
        onClick={handleClear}
        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2d1f47] flex items-center gap-2"
      >
        <Trash2 size={16} />
        清空牌阵
      </button>
    </div>
  );
};