import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, History, Plus, BookOpen, Globe, X } from 'lucide-react';
import { TabButton } from '../TabButton';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { PwaInstallPrompt } from '../PwaInstallPrompt';

type TabType = 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  sidebarContent: React.ReactNode;
}

const NAV_ITEMS = [
  { tab: 'home' as const, id: 'tab-home', icon: History, label: '研习台', ariaLabel: '前往研习台' },
  { tab: 'add' as const, id: 'tab-add', icon: Plus, label: '记录', ariaLabel: '新增抽牌手记' },
  { tab: 'private' as const, id: 'tab-private', icon: BookOpen, label: '典籍', ariaLabel: '查看私人典籍' },
  { tab: 'public' as const, id: 'tab-public', icon: Globe, label: '广场', ariaLabel: '查看研习广场' },
];

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  sidebarContent
}) => {
  useBodyScrollLock(isSidebarOpen);

  return (
    <div className="min-h-screen bg-forest-bg flex flex-col max-w-5xl mx-auto px-3 pb-0 pt-2 sm:px-5 sm:pb-4 sm:pt-4 relative overflow-x-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-forest-bg/25 backdrop-blur-[1px] z-[105] overscroll-contain"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white/92 shadow-xl backdrop-blur-md z-[110] flex flex-col overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="absolute right-3 top-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-forest-accent/8 bg-white/48 text-forest-muted transition-colors hover:bg-white/76 hover:text-forest-accent"
                aria-label="关闭菜单"
                title="关闭菜单"
              >
                <X size={16} />
              </button>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {sidebarContent}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <header className="mb-2 text-center relative sm:mb-4">
        <div className="absolute left-0 top-1 sm:top-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-11 h-11 bg-white/35 text-forest-accent rounded-full hover:bg-white/65 transition-all border border-forest-accent/8 flex items-center justify-center"
            aria-label="打开菜单"
            title="打开菜单"
          >
            <Menu size={20} />
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex max-w-[220px] flex-col items-center gap-1 sm:max-w-none sm:gap-1.5"
        >
          <img
            src="/app-icon-192.png"
            alt="塔罗研习阁图标"
            className="h-9 w-9 rounded-2xl shadow-sm shadow-forest-accent/10 sm:h-11 sm:w-11"
            draggable={false}
          />
          <div className="space-y-0.5">
            <h1 className="font-serif text-[1.45rem] font-bold leading-tight text-forest-accent/90 sm:text-[1.85rem]">
              塔罗研习阁
            </h1>
            <p className="text-[11px] font-bold tracking-[0.18em] text-forest-muted">
              观牌，也观心
            </p>
          </div>
        </motion.div>
      </header>

      <main className="flex-1 pb-[3.75rem] sm:pb-[3.5rem]">
        {children}
      </main>

      <PwaInstallPrompt />

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] border-t border-forest-accent/8 bg-white/88 px-3 py-0.5 shadow-[0_-8px_24px_-26px_rgba(62,58,54,0.38)] backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex h-14 max-w-xl items-center justify-around sm:h-[3.35rem] sm:max-w-2xl">
          {NAV_ITEMS.map(item => (
            <TabButton
              key={item.id}
              id={item.id}
              active={activeTab === item.tab}
              onClick={() => setActiveTab(item.tab)}
              icon={item.icon}
              label={item.label}
              ariaLabel={item.ariaLabel}
            />
          ))}
        </div>
      </nav>
    </div>
  );
};
