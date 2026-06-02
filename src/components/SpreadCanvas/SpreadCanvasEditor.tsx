import React from 'react';
import { ToolPanel } from './ToolPanel';
import { Canvas } from './Canvas';
import { CardModal } from './CardModal';

export const SpreadCanvasEditor: React.FC = () => {
  return (
    <div className="flex h-screen bg-[#1a1a2e]">
      <ToolPanel />
      <div className="flex-1 relative">
        <Canvas />
      </div>
      <CardModal />
    </div>
  );
};