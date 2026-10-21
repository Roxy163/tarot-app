import { useEffect, useRef, useState } from 'react';
import { CloudDownload, Download, FileUp, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { PageView } from './PageView';
import { MAX_BACKUP_BYTES, parseTarotBackup } from '../lib/tarotBackup';
import { downloadTextFile } from '../lib/downloadFile';
import type { TarotBackup } from '../types';

interface BackupPageProps {
  isOpen: boolean;
  onBack: () => void;
  ready: boolean;
  restoreReady?: boolean;
  onRefreshNumerology?: () => Promise<void>;
  getBackup: () => Promise<TarotBackup>;
  onRestore: (backup: TarotBackup) => Promise<void>;
}

export function BackupPage({ isOpen, onBack, ready, restoreReady = ready, onRefreshNumerology, getBackup, onRestore }: BackupPageProps) {
  const [preview, setPreview] = useState<TarotBackup | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(false);
  const refreshVersion = useRef(0);
  useEffect(() => {
    current.current = isOpen;
    refreshVersion.current += 1;
    setRefreshing(false); setRefreshNotice('');
    return () => { current.current = false; refreshVersion.current += 1; };
  }, [isOpen]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (failure) { if (current.current) setError(failure instanceof Error ? failure.message : '操作未完成，请稍后重试。'); }
    finally { if (current.current) setBusy(false); }
  };

  return <PageView isOpen={isOpen} onBack={onBack} title="备份与恢复" backDisabled={busy}>
    <div className="space-y-6">
      <section className="space-y-3 border-b border-forest-accent/10 pb-6">
        <h2 className="font-serif text-lg font-bold text-forest-ink">导出备份</h2>
        <p>导出已保存在本机的手记、日运、牌阵、牌义注疏、灵数缓存、关键词和练习记录。不包含登录凭据、账号资料和未保存草稿。</p>
        {onRefreshNumerology && <div className="space-y-2 text-xs">
          <p>灵数使用当前账号的本机缓存，可能不含其他设备上的最新修改。需要补全时可单独读取云端，不影响本机导出。</p>
          <button type="button" disabled={!ready || refreshing} className="flex min-h-11 items-center gap-2 text-forest-accent disabled:opacity-50" onClick={async () => {
            const version = refreshVersion.current;
            setRefreshing(true); setRefreshNotice('');
            try { await onRefreshNumerology(); if (current.current && version === refreshVersion.current) setRefreshNotice('云端灵数已缓存，可重新导出备份。'); }
            catch (failure) { if (current.current && version === refreshVersion.current) setRefreshNotice(failure instanceof Error ? failure.message : '云端暂不可用，本机仍可正常导出。'); }
            finally { if (current.current && version === refreshVersion.current) setRefreshing(false); }
          }}>{refreshing ? <LoaderCircle size={17} className="animate-spin" /> : <CloudDownload size={17} />}读取云端灵数</button>
          {refreshNotice && <p role="status">{refreshNotice}</p>}
        </div>}
        <p className="flex items-start gap-2 text-xs"><ShieldCheck size={17} className="shrink-0 text-forest-accent" />备份可能包含私人问题和客户记录，请妥善保管，不要公开分享文件。</p>
        <button type="button" disabled={!ready || busy} onClick={() => void run(async () => {
          const backup = await getBackup();
          if (!current.current) return;
          downloadTextFile(`塔罗研习阁-备份-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
          setNotice('备份已生成，请检查浏览器下载记录。');
        })} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest-accent px-4 py-2 text-white disabled:opacity-50"><Download size={18} />导出 JSON 备份</button>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-bold text-forest-ink">从备份恢复</h2>
        <p>只补充当前账号缺少的资料，不覆盖已有内容。恢复的手记默认私密，不会自动发布到广场。</p>
        <input ref={input} type="file" accept=".json,application/json" aria-label="选择备份文件" className="hidden" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setPreview(null); setFileName('');
          void run(async () => {
            if (file.size > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 20MB。');
            const backup = parseTarotBackup(await file.text());
            if (!current.current) return;
            setPreview(backup); setFileName(file.name);
          });
        }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex min-h-11 items-center gap-2 rounded-lg border border-forest-accent/20 px-4 py-2 text-forest-accent disabled:opacity-50"><FileUp size={18} />选择备份文件</button>
        {preview && <div className="space-y-4 border-y border-forest-accent/10 py-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><p className="break-all font-medium text-forest-ink">{fileName}</p><p className="mt-1 text-xs">导出于 {new Date(preview.exportedAt).toLocaleString('zh-CN')}</p></div>
            <button type="button" title="取消恢复" aria-label="取消恢复" disabled={busy} onClick={() => setPreview(null)} className="flex h-11 w-11 shrink-0 items-center justify-center text-forest-muted"><X size={18} /></button>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              ['手记', preview.data.readings.filter(item => !item.isExample).length], ['日运', preview.data.fortunes.length],
              ['牌阵', preview.data.spreads.length], ['牌面资料', preview.data.cardMetadata.length],
              ['牌义注疏', Object.keys(preview.data.annotations).length], ['自定义灵数', Object.keys(preview.data.numerology).length],
              ['关键词记录', preview.data.cardKeywordMemory.length], ['练习记录', preview.data.quizMemory.length],
            ].map(([label, count]) => <div key={label} className="flex items-center justify-between gap-2"><dt>{label}</dt><dd className="font-medium text-forest-ink">{count}</dd></div>)}
          </dl>
          <p className="text-xs">以上为文件中的数量；与现有资料重复的项目会跳过。同名但布局不同的自定义牌阵会另存。</p>
          <p className="text-xs">{preview.numerologyCoverage === 'local' ? '灵数来自导出时的本机资料。' : preview.numerologyCoverage === 'cached' ? `灵数来自本机缓存${preview.numerologyCheckedAt ? `，最近完整读取云端于 ${new Date(preview.numerologyCheckedAt).toLocaleString('zh-CN')}` : '，未记录完整云端读取时间'}，不保证包含其他设备的最新修改。` : '此旧版备份未标注灵数覆盖范围。'}</p>
          <button type="button" disabled={!restoreReady || busy} onClick={() => void run(async () => {
            await onRestore(preview);
            if (!current.current) return;
            setPreview(null); setNotice('恢复完成，原有资料已保留。登录后的新增资料会继续同步到云端。');
          })} className="flex min-h-11 items-center gap-2 rounded-lg bg-forest-accent px-4 py-2 text-white disabled:opacity-50"><FileUp size={18} />确认合并恢复</button>
        </div>}
      </section>
      {!ready && <p role="status" className="text-xs">正在读取当前账号的本机资料，请稍等片刻。</p>}
      {ready && !restoreReady && <p role="status" className="text-xs">同步尚未结束，可以先导出本机备份；合并恢复需等待同步完成。</p>}
      {busy && <p role="status" className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" />处理中，请不要关闭页面…</p>}
      {error && <p role="alert" className="break-words text-forest-pink">{error}</p>}
      {notice && <p role="status" className="text-forest-accent">{notice}</p>}
    </div>
  </PageView>;
}
