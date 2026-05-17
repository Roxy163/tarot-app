import React from 'react';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  id?: string;
}

export const TabButton = ({ active, onClick, icon: Icon, label, id }: TabButtonProps) => (
  <button 
    id={id}
    onClick={onClick}
    className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 transition-all border-b-2 ${active ? 'text-forest-accent border-forest-accent font-medium' : 'text-forest-muted border-transparent hover:text-forest-text'}`}
  >
    <Icon size={18} className="shrink-0" />
    <span className="text-[10px] sm:text-sm whitespace-nowrap">{label}</span>
  </button>
);
