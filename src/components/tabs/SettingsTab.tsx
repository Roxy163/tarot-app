import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ChevronRight, Download, FileText, MessageSquareText, ShieldCheck } from 'lucide-react';

interface SettingsTabProps {
  onBack: () => void;
  onOpenInstallGuide: () => void;
  onOpenFeedback: () => void;
  onOpenLegal: () => void;
  onOpenModeration?: () => void;
  remindersEnabled: boolean;
}

export function SettingsTab({ onBack, onOpenInstallGuide, onOpenFeedback, onOpenLegal, onOpenModeration, remindersEnabled }: SettingsTabProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const entries = [
    { label: '添加到桌面', detail: remindersEnabled ? '安装方法 · 提醒设置' : '安装方法 · 提醒已关闭', icon: Download, onClick: onOpenInstallGuide },
    { label: '支持与反馈', icon: MessageSquareText, onClick: onOpenFeedback },
    { label: '隐私与条款', detail: '数据与公开说明', icon: FileText, onClick: onOpenLegal },
    ...(onOpenModeration ? [{ label: '作者管理', detail: '举报与下架', icon: ShieldCheck, onClick: onOpenModeration }] : []),
  ];

  return (
    <motion.section
      aria-labelledby="settings-heading"
      initial={{ opacity: 0, x: reducedMotion ? 0 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="mx-auto w-full max-w-xl pb-8"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <header className="relative mb-6 flex min-h-14 items-center justify-center sm:mb-8">
        <button type="button" onClick={onBack} aria-label="返回上一页" className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full text-forest-ink transition-colors hover:bg-forest-accent/8 focus-visible:outline-2 focus-visible:outline-forest-accent">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h1 id="settings-heading" ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold text-forest-ink outline-none">设置</h1>
      </header>

      <div className="overflow-hidden rounded-[1.5rem] border border-forest-accent/8 bg-white/40 p-2 sm:p-3">
        {entries.map(({ label, detail, icon: Icon, onClick }, index) => (
          <motion.button
            key={label}
            type="button"
            onClick={onClick}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: reducedMotion ? 0 : index * 0.035 }}
            className="group flex min-h-[4.5rem] w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/65 focus-visible:outline-2 focus-visible:outline-forest-accent sm:px-4"
          >
            <Icon size={20} className="shrink-0 text-forest-accent" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-forest-ink">{label}</span>
              {detail && <span className="mt-1 block text-xs text-forest-muted">{detail}</span>}
            </span>
            <ChevronRight size={16} className="shrink-0 text-forest-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
