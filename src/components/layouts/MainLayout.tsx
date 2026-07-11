import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, History, Plus, BookOpen, Globe, User, LogIn } from 'lucide-react';
import { TabButton } from '../TabButton';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

type TabType = 'home' | 'add' | 'private' | 'public' | 'metadata' | 'profile';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  session: { uid?: string; email?: string } | null;
  profile?: { display_name?: string; nickname?: string } | null;
  selectedAuthor: string | null;
  setSelectedAuthor: (author: string | null) => void;
  onShowAuth: () => void;
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
  session,
  profile,
  selectedAuthor,
  setSelectedAuthor,
  onShowAuth,
  sidebarContent
}) => {
  useBodyScrollLock(isSidebarOpen);

  return (
    <div className="min-h-screen bg-forest-bg flex flex-col max-w-4xl mx-auto px-4 py-6 sm:py-5 relative overflow-x-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-forest-bg/35 backdrop-blur-[1px] z-[105] overscroll-contain"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-[110] flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {sidebarContent}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <header className="mb-5 sm:mb-6 text-center relative">
        <div className="absolute left-0 top-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-11 h-11 bg-forest-accent/5 text-forest-accent rounded-full hover:bg-forest-accent/10 transition-all border border-forest-accent/10 flex items-center justify-center"
            aria-label="打开菜单"
            title="打开菜单"
          >
            <Menu size={20} />
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex max-w-[260px] flex-col items-center gap-2 sm:max-w-none"
        >
          <img
            src="/app-icon.svg"
            alt="塔罗研习阁图标"
            className="h-12 w-12 rounded-2xl shadow-lg shadow-forest-accent/10 sm:h-12 sm:w-12"
            draggable={false}
          />
          <div className="space-y-0.5">
            <h1 className="font-serif text-3xl text-forest-accent sm:text-3xl">
              塔罗研习阁
            </h1>
            <p className="text-[11px] font-bold tracking-[0.18em] text-forest-muted">
              观牌，也观心
            </p>
          </div>
        </motion.div>
      </header>

      <main className="flex-1 pb-24">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-forest-accent/10 z-[100] px-2 py-1 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around items-center max-w-lg mx-auto h-16">
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
          {session ? (
            <TabButton 
              id="tab-profile" 
              active={activeTab === 'profile'} 
              onClick={() => {
                setSelectedAuthor(profile?.display_name || profile?.nickname || session.email?.split('@')[0] || '研习阁主');
                setActiveTab('profile');
              }} 
              icon={User} 
              label="印鉴" 
              ariaLabel="查看个人印鉴"
            />
          ) : (
            <button 
              id="tab-login"
              onClick={onShowAuth}
              className="min-h-11 min-w-11 flex flex-col items-center gap-1 px-3 py-2 text-forest-muted hover:text-forest-accent transition-all"
              aria-label="执印入阁登录"
            >
              <LogIn size={20} />
              <span className="text-[10px] font-bold whitespace-nowrap">执印入阁</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};
