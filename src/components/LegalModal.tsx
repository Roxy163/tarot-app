import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Database, FileText, Mail, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal } from './Modal';

export type LegalTab = 'privacy' | 'terms';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

interface LegalSection {
  title: string;
  icon: LucideIcon;
  body: string;
}

const UPDATED_AT = '2026/09/15';

const privacySections: LegalSection[] = [
  {
    title: '会保存什么',
    icon: Database,
    body: '你填写的手记、日运、牌义注疏、牌阵和账号公开资料会保存在本机；登录后会同步到云端。登录邮箱由 Firebase Auth 用于身份验证。',
  },
  {
    title: '公开与匿名',
    icon: Users,
    body: '只有你主动勾选公开的手记才会进入广场。匿名公开会隐藏昵称和签名，但手记内容本身仍会被其他用户看到。',
  },
  {
    title: '反馈与截图',
    icon: Mail,
    body: '站内反馈会通过 Resend 转发到作者邮箱，内容包括你填写的文字、联系方式、手动添加的截图，以及登录状态和用户识别信息；不会自动附带私人手记或牌阵数据。发送失败时，文字草稿会留在本机。',
  },
  {
    title: '运行与统计',
    icon: BarChart3,
    body: '网页由 Cloudflare Pages 提供，登录和云端数据使用 Firebase。软件会使用 Firebase Analytics 和 Cloudflare Web Analytics 统计打开和功能使用情况；软件主动记录的统计事件不附带你填写的手记正文、密码或登录邮箱。',
  },
  {
    title: '你的控制',
    icon: ShieldCheck,
    body: '你可以编辑或删除本机记录，取消公开，也可以在账号设置里注销账号。需要人工协助时，可以通过反馈入口或底部联系邮箱联系作者。',
  },
];

const termsSections: LegalSection[] = [
  {
    title: '软件用途',
    icon: FileText,
    body: '塔罗研习阁用于记录抽牌、复盘日运、整理牌义和交流公开案例，不提供医疗、法律、投资等专业建议。',
  },
  {
    title: '账号与同步',
    icon: ShieldCheck,
    body: '请使用自己的邮箱注册登录，并妥善保管密码。云端同步依赖网络和 Firebase 服务，网络不可用时会优先保留本机数据。',
  },
  {
    title: '广场规则',
    icon: Users,
    body: '公开内容请避免泄露个人隐私、发布广告、攻击他人或上传违法不适内容。你对自己公开的内容负责。',
  },
  {
    title: '作者管理',
    icon: AlertTriangle,
    body: '作者账号可以处理举报、下架不合适的公开内容，并维护广场秩序；私人手记不会进入作者管理列表。',
  },
];

const tabButtonClass = (active: boolean) => (
  `min-h-11 flex-1 rounded-2xl text-xs font-semibold transition-all ${
    active
      ? 'bg-forest-accent text-white shadow-sm shadow-forest-accent/12'
      : 'border border-forest-accent/8 bg-white/40 text-forest-muted hover:text-forest-accent'
  }`
);

export function LegalModal({ isOpen, onClose, initialTab = 'privacy' }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  const sections = activeTab === 'privacy' ? privacySections : termsSections;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeTab === 'privacy' ? '隐私政策' : '用户协议'}
      icon={activeTab === 'privacy' ? <ShieldCheck size={20} /> : <FileText size={20} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="法律说明">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'privacy'}
            onClick={() => setActiveTab('privacy')}
            className={tabButtonClass(activeTab === 'privacy')}
          >
            隐私政策
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            onClick={() => setActiveTab('terms')}
            className={tabButtonClass(activeTab === 'terms')}
          >
            用户协议
          </button>
        </div>

        <p className="rounded-[1.05rem] border border-forest-accent/7 bg-white/32 px-3 py-2 text-[11px] leading-relaxed text-forest-muted">
          更新日期：{UPDATED_AT}。有重大调整时会在软件内更新。
        </p>

        <div className="space-y-2.5">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="rounded-[1.05rem] border border-forest-accent/7 bg-white/34 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-forest-accent/8 text-forest-accent">
                    <Icon size={15} />
                  </span>
                  <h4 className="text-sm font-semibold text-forest-ink">{section.title}</h4>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-forest-muted">{section.body}</p>
              </section>
            );
          })}
        </div>

        <p className="text-center text-[10px] leading-relaxed text-forest-muted">
          联系作者：roxy163@outlook.com · 微信：juben6868
        </p>
      </div>
    </Modal>
  );
}
