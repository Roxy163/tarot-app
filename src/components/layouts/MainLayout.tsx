import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, History, Plus, BookOpen, Globe, User, LogIn } from 'lucide-react';
import { TabButton } from '../TabButton';

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
  return (
    <div className="min-h-screen bg-forest-bg flex flex-col max-w-4xl mx-auto px-4 py-6 sm:py-8 relative overflow-x-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-forest-text/20 backdrop-blur-sm z-[105]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-[110] flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto">
                {sidebarContent}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <header className="mb-8 sm:mb-12 text-center relative">
        <div className="absolute left-0 top-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-forest-accent/5 text-forest-accent rounded-full hover:bg-forest-accent/10 transition-all border border-forest-accent/10"
            title="打开菜单"
          >
            <Menu size={20} />
          </button>
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="text-3xl sm:text-5xl font-serif mb-2 text-forest-accent"
        >
          塔罗研习阁
        </motion.h1>
      </header>

      <main className="flex-1 pb-24">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-forest-accent/10 z-[100] px-2 py-1 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around items-center max-w-lg mx-auto h-16">
          <TabButton 
            id="tab-home" 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
            icon={History} 
            label="研习台" 
          />
          <TabButton 
            id="tab-add" 
            active={activeTab === 'add'} 
            onClick={() => setActiveTab('add')} 
            icon={Plus} 
            label="手记" 
          />
          <TabButton 
            id="tab-private" 
            active={activeTab === 'private'} 
            onClick={() => setActiveTab('private')} 
            icon={BookOpen} 
            label="典籍" 
          />
          <TabButton 
            id="tab-public" 
            active={activeTab === 'public'} 
            onClick={() => setActiveTab('public')} 
            icon={Globe} 
            label="广场" 
          />
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
            />
          ) : (
            <button 
              id="tab-login"
              onClick={onShowAuth}
              className="flex flex-col items-center gap-1 px-3 py-2 text-forest-muted hover:text-forest-accent transition-all"
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
