import { Download, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

export function PwaInstallPrompt({ onOpenGuide, hidden = false }: { onOpenGuide: () => void; hidden?: boolean }) {
  const { canInstall, dismiss, install, isIos, shouldShow } = usePwaInstallPrompt();
  const promptText = canInstall
    ? '放到桌面后，下次可以直接打开。安装方法和提醒设置都在菜单的“添加到桌面”里。'
    : isIos
      ? '在 Safari 点分享，再选“添加到主屏幕”。也可在菜单的“添加到桌面”里关闭提醒。'
      : '安装方法和提醒设置都在菜单的“添加到桌面”里；已有图标可以选择不再提醒。';

  return (
    <AnimatePresence>
      {shouldShow && !hidden && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[120] mx-auto max-w-md rounded-2xl border border-forest-accent/15 bg-white/95 p-2.5 shadow-xl shadow-forest-accent/10 backdrop-blur-md sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
          role="status"
        >
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent">
              {isIos && !canInstall ? <Share2 size={16} /> : <Download size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-forest-ink">把研习阁放到桌面</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-forest-muted">
                {promptText}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={dismiss} className="min-h-11 rounded-full px-3.5 text-xs font-medium text-forest-muted transition-colors hover:bg-forest-accent/5 hover:text-forest-ink">
              不再提醒
            </button>
            {canInstall ? (
              <button
                type="button"
                onClick={install}
                className="min-h-11 rounded-full bg-forest-accent px-3.5 text-[11px] font-bold text-white shadow-sm shadow-forest-accent/15"
              >
                现在添加
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenGuide}
                className="min-h-11 rounded-full bg-forest-accent/10 px-3.5 text-[11px] font-bold text-forest-accent"
              >
                查看添加方法
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
