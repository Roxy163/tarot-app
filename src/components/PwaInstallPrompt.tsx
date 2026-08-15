import { Download, Share2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

export function PwaInstallPrompt() {
  const { canInstall, dismiss, install, isIos, shouldShow } = usePwaInstallPrompt();
  const promptText = canInstall
    ? '可以现在添加到手机桌面；之后也能从左上角菜单里的“添加到手机桌面”再打开。'
    : isIos
      ? '现在可在 Safari 点分享，再选“添加到主屏幕”；之后也能从左上角菜单找回这条提示。'
      : '现在可从浏览器菜单选择“安装应用”或“添加到主屏幕”；之后也能从左上角菜单再查看。';

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[120] mx-auto max-w-md rounded-2xl border border-forest-accent/15 bg-white/95 p-2.5 shadow-xl shadow-forest-accent/10 backdrop-blur-md sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
          role="status"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-accent/10 text-forest-accent">
              {isIos && !canInstall ? <Share2 size={16} /> : <Download size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-forest-ink">把研习阁放到桌面</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-forest-muted">
                {promptText}
              </p>
            </div>
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
                onClick={dismiss}
                className="min-h-11 rounded-full bg-forest-accent/10 px-3.5 text-[11px] font-bold text-forest-accent"
              >
                知道了
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-forest-muted hover:bg-forest-accent/10 hover:text-forest-accent"
              aria-label="暂不显示添加到桌面提示"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
