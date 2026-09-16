import { useMemo } from 'react';
import { CheckCircle2, Copy, Download, Monitor, Share2, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal } from './Modal';

type InstallDevice = 'ios' | 'android' | 'desktop';

interface PwaInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  canAutoInstall?: boolean;
  onTryInstall?: () => void | Promise<void>;
  onNotice?: (message: string) => void;
}

const detectInstallDevice = (): InstallDevice => {
  if (typeof navigator === 'undefined') return 'desktop';

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  const isTouchMac = platform.includes('mac') && navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(userAgent) || isTouchMac) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'desktop';
};

const installSteps: Record<InstallDevice, { title: string; icon: LucideIcon; steps: string[]; autoStep?: string }> = {
  ios: {
    title: 'iPhone / iPad',
    icon: Share2,
    steps: [
      '用 Safari 打开塔罗研习阁。',
      '点浏览器里的分享按钮。',
      '选择“添加到主屏幕”。',
      '点“添加”，桌面上就会出现研习阁图标。',
    ],
  },
  android: {
    title: '安卓手机',
    icon: Smartphone,
    autoStep: '点“现在安装”，按浏览器提示确认。',
    steps: [
      '点浏览器右上角菜单。',
      '选择“安装应用”或“添加到主屏幕”。',
      '确认添加后，就能像 App 一样打开。',
    ],
  },
  desktop: {
    title: '电脑浏览器',
    icon: Monitor,
    autoStep: '点“现在安装”，按浏览器提示确认。',
    steps: [
      '看地址栏右侧是否有安装图标。',
      '如果没有，打开浏览器菜单，选择“安装”或“创建快捷方式”。',
      '安装后会出现在桌面或应用列表里。',
    ],
  },
};

export function PwaInstallGuideModal({
  isOpen,
  onClose,
  canAutoInstall = false,
  onTryInstall,
  onNotice,
}: PwaInstallGuideModalProps) {
  const currentDevice = useMemo(() => detectInstallDevice(), [isOpen]);
  const currentGuide = installSteps[currentDevice];
  const currentSteps = canAutoInstall && currentGuide.autoStep
    ? [currentGuide.autoStep, ...currentGuide.steps]
    : currentGuide.steps;
  const CurrentIcon = currentGuide.icon;
  const installUrl = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? window.location.origin
    : 'https://tarot-pavilion.pages.dev';

  const copyInstallUrl = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(installUrl);
      onNotice?.('已复制研习阁网址，可以发给自己或朋友再添加到桌面。');
    } catch {
      onNotice?.('当前浏览器不能自动复制，请手动复制地址栏网址。');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="下载安装到桌面"
      icon={<Download size={20} />}
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-forest-muted">
          塔罗研习阁是网页应用，不用应用商店；添加到桌面后会像 App 一样独立打开。
        </p>

        <div className={`grid gap-2 ${canAutoInstall && currentDevice !== 'ios' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canAutoInstall && currentDevice !== 'ios' && (
            <button
              type="button"
              onClick={() => void onTryInstall?.()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-forest-accent px-3 text-xs font-semibold text-white shadow-sm shadow-forest-accent/15 transition-all active:scale-[0.98]"
            >
              <Download size={15} />
              现在安装
            </button>
          )}
          <button
            type="button"
            onClick={() => void copyInstallUrl()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-forest-accent/8 bg-white/46 px-3 text-xs font-semibold text-forest-accent transition-all hover:bg-white/70 active:scale-[0.98]"
          >
            <Copy size={15} />
            复制网址
          </button>
        </div>

        <section className="rounded-[1.15rem] border border-forest-accent/8 bg-white/32 p-3">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-accent/8 text-forest-accent">
              <CurrentIcon size={17} />
            </span>
            <div>
              <p className="text-sm font-semibold text-forest-ink">{currentGuide.title}</p>
              <p className="text-[10px] text-forest-muted">当前设备推荐流程</p>
            </div>
          </div>

          <ol className="space-y-2">
            {currentSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-2 rounded-xl bg-white/38 px-2.5 py-2">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-accent/10 text-[10px] font-bold text-forest-accent">
                  {index + 1}
                </span>
                <span className="text-xs leading-relaxed text-forest-ink/78">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="rounded-[1.05rem] border border-forest-accent/7 bg-forest-bg/28 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-forest-accent">
            <CheckCircle2 size={14} />
            安装成功后
          </p>
          <p className="mt-1 text-xs leading-relaxed text-forest-muted">
            桌面图标会直接打开研习阁；登录后，同步、反馈和广场功能照常使用。
          </p>
        </div>
      </div>
    </Modal>
  );
}
