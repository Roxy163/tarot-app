import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle, ChevronRight, HardDrive, LogIn, RefreshCw } from 'lucide-react';
import type { CloudSyncInfo } from '../hooks/useReadings';

interface CloudSyncPanelProps {
  session: { uid?: string } | null;
  cloudSyncInfo: CloudSyncInfo;
  isCloudSyncPaused: boolean;
  readingCount: number;
  reviewedReadingCount: number;
  todayCount: number;
  onManualSync: () => void | Promise<void>;
  onLogin: () => void;
  onOpenLibrary: () => void;
  onStartReading: () => void;
  showLoginAction?: boolean;
  showPrimaryAction?: boolean;
}

const formatSyncTime = (syncedAt: string | null) => (
  syncedAt
    ? new Date(syncedAt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '还没有同步记录'
);

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  session,
  cloudSyncInfo,
  isCloudSyncPaused,
  readingCount,
  reviewedReadingCount,
  todayCount,
  onManualSync,
  onLogin,
  onOpenLibrary,
  onStartReading,
  showLoginAction = true,
  showPrimaryAction = true,
}) => {
  const isGuest = !session;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const statusText = !session
    ? '本机已保存'
    : cloudSyncInfo.status === 'loading'
      ? '正在读取云端'
      : cloudSyncInfo.status === 'syncing'
        ? '正在同步'
        : (isCloudSyncPaused || cloudSyncInfo.status === 'error')
          ? '稍后再同步'
          : '云端已同步';
  const lastTimeText = formatSyncTime(cloudSyncInfo.lastSyncedAt);
  const isBusy = !isGuest && (cloudSyncInfo.status === 'loading' || cloudSyncInfo.status === 'syncing');
  const tone = !session
    ? 'muted'
    : (isCloudSyncPaused || cloudSyncInfo.status === 'error')
      ? 'warning'
      : 'success';
  const cloudReadingsCountText = cloudSyncInfo.cloudReadingsCount === null
    ? !session ? '待登录' : tone === 'warning' ? '待联网' : '正在读取'
    : `${cloudSyncInfo.cloudReadingsCount} 条`;

  return (
    <section
      className="space-y-2.5 rounded-[1.35rem] border border-forest-accent/7 bg-white/26 p-3 shadow-none"
      data-testid="cloud-sync-panel"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-forest-muted">保存与同步</p>
          <p className="mt-1 text-sm font-semibold text-forest-ink">{statusText}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          tone === 'success'
            ? 'bg-forest-accent/10 text-forest-accent'
          : tone === 'warning'
              ? 'border border-amber-100/80 bg-amber-50/75 text-amber-500'
              : 'border border-forest-accent/7 bg-white/36 text-forest-muted'
        }`}>
          {isBusy
            ? <RefreshCw size={18} className="animate-spin" />
            : tone === 'success' ? <CheckCircle size={18} />
              : tone === 'warning' ? <AlertTriangle size={18} /> : <HardDrive size={18} />}
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border border-forest-accent/7 bg-white/34 px-2 py-2">
            <p className="font-serif text-lg font-semibold text-forest-accent">{readingCount}</p>
            <p className="text-[10px] font-medium text-forest-muted">本机手记</p>
          </div>
          <div className={`rounded-lg border px-2 py-2 ${
            isGuest
              ? 'border-forest-accent/7 bg-forest-bg/28 text-forest-muted'
              : 'border-forest-accent/7 bg-white/34'
          }`}>
            <p className={`${isGuest ? 'font-sans text-sm' : 'font-serif text-lg'} font-semibold text-forest-accent`}>
              {cloudReadingsCountText}
            </p>
            <p className="text-[10px] font-medium text-forest-muted">云端手记</p>
          </div>
        </div>
        {cloudSyncInfo.lastError && tone === 'warning' && (
          <p className="rounded-lg border border-amber-100/60 bg-amber-50/42 px-2.5 py-2 text-[10px] leading-relaxed text-amber-700">
            云端暂时没有连上，记录已保留在本机。
          </p>
        )}
        {session ? (
          <button
            type="button"
            onClick={() => { void onManualSync(); }}
            disabled={isBusy}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-forest-accent/8 bg-white/42 text-xs font-medium text-forest-accent transition-colors hover:bg-white/72 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
            {isBusy ? '同步中' : '重新同步'}
          </button>
        ) : showLoginAction ? (
          <button
            type="button"
            onClick={onLogin}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-accent/92"
          >
            <LogIn size={16} />
            登录开启同步
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl border border-forest-accent/7 bg-white/32 p-2">
          <p className="font-serif text-lg font-semibold text-forest-accent">{reviewedReadingCount}</p>
          <p className="text-[10px] font-medium text-forest-muted">手记复盘</p>
        </div>
        <div className="rounded-xl border border-forest-accent/7 bg-white/32 p-2">
          <p className="font-serif text-lg font-semibold text-forest-accent">{todayCount}</p>
          <p className="text-[10px] font-medium text-forest-muted">今日手记</p>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setDetailsOpen(open => !open)}
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-1 text-xs text-forest-muted transition-colors hover:text-forest-accent"
        >
          同步详情
          <motion.span animate={{ rotate: detailsOpen ? 90 : 0 }}><ChevronRight size={14} /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {detailsOpen && <motion.div
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-forest-accent/7 pt-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-forest-muted">最近同步</span>
                <span className="font-medium text-forest-ink">{lastTimeText}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-forest-muted">
                {session ? '本机与云端记录会自动合并，保留两端的更新。' : '本机记录已保留，登录后可同步到云端。'}
              </p>
              {cloudSyncInfo.lastError && tone === 'warning' && <p className="break-words text-[11px] leading-relaxed text-forest-muted">{cloudSyncInfo.lastError}</p>}
            </div>
          </motion.div>}
        </AnimatePresence>
      </div>

      {showPrimaryAction && (
        <button
          type="button"
          onClick={readingCount > 0 ? onOpenLibrary : onStartReading}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest-accent/88 px-4 text-sm font-medium text-white transition-colors hover:bg-forest-accent"
        >
          {readingCount > 0 ? '进入典籍复盘' : '写第一条手记'}
          <ChevronRight size={16} />
        </button>
      )}
    </section>
  );
};
