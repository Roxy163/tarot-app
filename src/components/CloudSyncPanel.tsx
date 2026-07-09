import React from 'react';
import { AlertTriangle, CheckCircle, ChevronRight, LogIn, RefreshCw } from 'lucide-react';
import type { CloudSyncInfo } from '../hooks/useReadings';

interface CloudSyncPanelProps {
  session: { uid?: string } | null;
  cloudSyncInfo: CloudSyncInfo;
  isCloudSyncPaused: boolean;
  readingCount: number;
  customSpreadCount: number;
  todayCount: number;
  onManualSync: () => void | Promise<void>;
  onLogin: () => void;
  onOpenLibrary: () => void;
  onStartReading: () => void;
}

const formatSyncTime = (syncedAt: string | null) => (
  syncedAt
    ? new Date(syncedAt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '尚未同步'
);

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  session,
  cloudSyncInfo,
  isCloudSyncPaused,
  readingCount,
  customSpreadCount,
  todayCount,
  onManualSync,
  onLogin,
  onOpenLibrary,
  onStartReading,
}) => {
  const statusText = !session
    ? '访客本机暂存'
    : cloudSyncInfo.status === 'loading'
      ? '正在读取云端'
      : cloudSyncInfo.status === 'syncing'
        ? '正在同步'
        : (isCloudSyncPaused || cloudSyncInfo.status === 'error')
          ? '同步需要重试'
          : '云端已同步';
  const lastTimeText = formatSyncTime(cloudSyncInfo.lastSyncedAt);
  const cloudReadingsCountText = cloudSyncInfo.cloudReadingsCount === null
    ? '待读取'
    : `${cloudSyncInfo.cloudReadingsCount} 条`;
  const isBusy = cloudSyncInfo.status === 'loading' || cloudSyncInfo.status === 'syncing';
  const tone = !session
    ? 'muted'
    : (isCloudSyncPaused || cloudSyncInfo.status === 'error')
      ? 'warning'
      : 'success';

  return (
    <section className="rounded-2xl bg-forest-bg/70 border border-forest-accent/10 p-4 space-y-3" data-testid="cloud-sync-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-forest-muted font-bold uppercase tracking-widest">数据保险箱</p>
          <p className="text-sm text-forest-ink font-bold mt-1">{statusText}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          tone === 'success'
            ? 'bg-forest-accent/10 text-forest-accent'
            : tone === 'warning'
              ? 'bg-amber-100 text-amber-600'
              : 'bg-forest-muted/10 text-forest-muted'
        }`}>
          {isBusy
            ? <RefreshCw size={18} className="animate-spin" />
            : tone === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        </div>
      </div>

      <div className="rounded-xl bg-white/75 border border-forest-accent/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-forest-muted">最近同步</span>
          <span className="font-bold text-forest-ink">{lastTimeText}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-forest-bg/70 border border-forest-accent/5 px-2 py-2">
            <p className="font-serif text-lg font-bold text-forest-accent">{readingCount}</p>
            <p className="text-[9px] font-bold text-forest-muted">本机典籍</p>
          </div>
          <div className="rounded-lg bg-forest-bg/70 border border-forest-accent/5 px-2 py-2">
            <p className="font-serif text-lg font-bold text-forest-accent">{cloudReadingsCountText}</p>
            <p className="text-[9px] font-bold text-forest-muted">云端典籍</p>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed text-forest-muted">
          {session
            ? '会合并云端与本机记录，避免新设备空数据覆盖旧典籍。'
            : '当前记录只在这台设备，登录后可同步到云端。'}
        </p>
        {cloudSyncInfo.lastError && tone === 'warning' && (
          <p className="rounded-lg bg-amber-50 border border-amber-100 px-2 py-1.5 text-[10px] leading-relaxed text-amber-700">
            {cloudSyncInfo.lastError}
          </p>
        )}
        {session ? (
          <button
            type="button"
            onClick={() => { void onManualSync(); }}
            disabled={isBusy}
            className="w-full min-h-11 rounded-xl bg-white border border-forest-accent/15 text-forest-accent text-xs font-bold hover:bg-forest-accent/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
            {isBusy ? '同步中' : '重新同步'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="w-full min-h-11 rounded-xl bg-white border border-forest-accent/15 text-forest-accent text-xs font-bold hover:bg-forest-accent/5 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={14} />
            登录开启同步
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-white/70 border border-forest-accent/5 p-2">
          <p className="font-serif text-lg font-bold text-forest-accent">{customSpreadCount}</p>
          <p className="text-[9px] font-bold text-forest-muted">自建牌阵</p>
        </div>
        <div className="rounded-xl bg-white/70 border border-forest-accent/5 p-2">
          <p className="font-serif text-lg font-bold text-forest-accent">{todayCount}</p>
          <p className="text-[9px] font-bold text-forest-muted">今日</p>
        </div>
      </div>

      <button
        type="button"
        onClick={readingCount > 0 ? onOpenLibrary : onStartReading}
        className="w-full min-h-11 px-4 rounded-xl bg-forest-accent text-white text-sm font-bold hover:bg-forest-accent/90 transition-colors flex items-center justify-center gap-2"
      >
        {readingCount > 0 ? '进入典籍复盘' : '写第一条手记'}
        <ChevronRight size={16} />
      </button>
    </section>
  );
};
