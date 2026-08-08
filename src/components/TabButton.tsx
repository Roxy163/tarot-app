interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  id?: string;
  ariaLabel?: string;
}

export const TabButton = ({ active, onClick, icon: Icon, label, id, ariaLabel }: TabButtonProps) => (
  <button 
    id={id}
    onClick={onClick}
    aria-label={ariaLabel || label}
    aria-current={active ? 'page' : undefined}
    className={`min-h-11 min-w-11 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 transition-all border-b-2 ${active ? 'text-forest-accent border-forest-accent font-semibold' : 'text-forest-muted border-transparent hover:text-forest-text'}`}
  >
    <Icon size={18} className="shrink-0" />
    <span className="text-[10px] sm:text-[13px] whitespace-nowrap">{label}</span>
  </button>
);
