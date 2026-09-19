import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cardAnnotationService } from '../services/cardAnnotationService';

export function useAnnotationRevision() {
  return useSyncExternalStore(cardAnnotationService.subscribe, cardAnnotationService.getRevision);
}

export function useAnnotationSync(uid?: string, authLoading = false, localFallback = false) {
  const scope = uid || 'guest';
  const revision = useAnnotationRevision();
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'syncing' | 'synced' | 'error' | 'guest'>('loading');
  const [error, setError] = useState<string | null>(null);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const pending = useRef<{ scope: string; promise: Promise<boolean> } | null>(null);

  const sync = useCallback(async () => {
    if (!uid || localFallback) return false;
    if (pending.current?.scope === scope) return pending.current.promise;
    setStatus('syncing');
    setError(null);
    const startRevision = cardAnnotationService.getRevision();
    let timeout: ReturnType<typeof setTimeout>;
    const promise = Promise.race([
      cardAnnotationService.sync(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('同步超时')), 15000); }),
    ]).then(() => {
      if (activeScope.current === scope) setStatus(cardAnnotationService.getRevision() === startRevision ? 'synced' : 'syncing');
      return true;
    }).catch(() => {
      if (activeScope.current === scope) {
        setStatus('error');
        setError('牌义注疏尚未同步，本机内容已保留，可联网后重试。');
      }
      return false;
    }).finally(() => {
      clearTimeout(timeout);
      if (pending.current?.promise === promise) pending.current = null;
    });
    pending.current = { scope, promise };
    return promise;
  }, [uid, scope, localFallback]);

  useEffect(() => {
    if (authLoading) return;
    try { cardAnnotationService.setScope(uid); }
    catch { setError('旧注疏暂未迁移完成，原数据仍保留，请释放存储空间后重试。'); }
    setLoadedScope(scope);
    setStatus(uid ? (localFallback ? 'error' : 'loading') : 'guest');
  }, [uid, scope, authLoading, localFallback]);

  useEffect(() => {
    if (authLoading || loadedScope !== scope || !uid || localFallback) return;
    // Wait for an earlier request before sending changes made during that request.
    let cancelled = false;
    const retry = async () => {
      if (pending.current?.scope === scope) await pending.current.promise;
      if (!cancelled) await sync();
    };
    const timer = setTimeout(() => { void retry(); }, 800);
    const online = () => { void retry(); };
    window.addEventListener('online', online);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('online', online); };
  }, [revision, uid, scope, loadedScope, authLoading, localFallback, sync]);

  return { ready: !authLoading && loadedScope === scope, status, error, sync };
}
