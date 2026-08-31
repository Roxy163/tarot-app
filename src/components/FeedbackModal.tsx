import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, Mail, MessageSquareText, X } from 'lucide-react';
import { Modal } from './Modal';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CONTACT_MAX_LENGTH,
  FEEDBACK_EMAIL,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_WECHAT_ID,
  FeedbackDraft,
  loadFeedbackDraft,
  saveFeedbackDraft,
} from '../lib/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}

const EMPTY_DRAFT: FeedbackDraft = {
  category: 'experience',
  message: '',
  contact: '',
};

const getCategoryLabel = (categoryValue: FeedbackDraft['category']) => (
  FEEDBACK_CATEGORIES.find(category => category.value === categoryValue)?.label || '其他'
);

const getDeviceType = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches
    ? '手机端'
    : '电脑端'
);

const createFeedbackEmailHref = (draft: FeedbackDraft) => {
  const categoryLabel = getCategoryLabel(draft.category);
  const message = draft.message.trim();
  const contact = draft.contact.trim();
  const pagePath = typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
  const subject = `[塔罗研习阁反馈] ${categoryLabel}`;
  const body = [
    '请在邮件里附上问题截图，并保留下面的文字说明。',
    '',
    `反馈类型：${categoryLabel}`,
    '截图：请添加问题页面、报错提示或异常状态截图',
    `文字说明：${message || '（请描述在哪里、做了什么、发生了什么）'}`,
    contact ? `联系方式：${contact}` : '联系方式：（可选）',
    `使用端：${getDeviceType()}`,
    `页面：${pagePath}`,
  ].join('\n');

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export function FeedbackModal({ isOpen, onClose, onSent }: FeedbackModalProps) {
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const emailHref = useMemo(() => createFeedbackEmailHref(draft), [draft]);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(loadFeedbackDraft() || EMPTY_DRAFT);
  }, [isOpen]);

  const updateDraft = (patch: Partial<FeedbackDraft>) => {
    setDraft(current => {
      const next = { ...current, ...patch };
      saveFeedbackDraft(next);
      return next;
    });
  };

  const handleOpenEmail = () => {
    saveFeedbackDraft(draft);
    onSent('已打开邮箱，请附上截图和文字说明后发送。');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="反馈与建议"
      icon={<MessageSquareText size={18} />}
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭反馈"
          className="absolute right-4 top-4 grid min-h-11 min-w-11 place-items-center rounded-full text-forest-muted transition-colors hover:bg-white/58 hover:text-forest-ink"
        >
          <X size={17} />
        </button>

        <div className="rounded-[1.15rem] border border-forest-accent/10 bg-forest-accent/5 p-2.5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/58 text-forest-accent">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-forest-accent">优先邮箱反馈</p>
              <p className="font-serif text-[1.05rem] font-bold leading-6 tracking-wide text-forest-ink">
                {FEEDBACK_EMAIL}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-forest-muted">
                请带上截图和文字说明；打开邮箱后可以直接添加截图。
              </p>
            </div>
          </div>
          <div className="mt-2 flex gap-2 rounded-xl bg-white/46 px-2.5 py-2 text-[10px] leading-4 text-forest-muted">
            <Camera size={14} className="mt-0.5 shrink-0 text-forest-accent" />
            <span>截图最好包含出问题的页面、弹窗或报错，以及你刚点过的按钮。</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-full border border-forest-accent/7 bg-white/32 p-1" aria-label="反馈类型">
          {FEEDBACK_CATEGORIES.map(category => {
            const isActive = draft.category === category.value;
            return (
              <motion.button
                key={category.value}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => updateDraft({ category: category.value })}
                className={`min-h-11 rounded-full px-1 text-[11px] font-medium transition-colors sm:text-xs ${
                  isActive
                    ? 'bg-forest-accent text-white shadow-sm'
                    : 'text-forest-muted hover:bg-white/62 hover:text-forest-ink'
                }`}
              >
                {category.label}
              </motion.button>
            );
          })}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-forest-ink">文字说明（会带入邮件）</span>
          <textarea
            value={draft.message}
            onChange={event => updateDraft({ message: event.target.value })}
            maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
            rows={4}
            placeholder="哪个页面、点了什么、发生了什么？截图请在邮箱里添加。"
            className="min-h-24 w-full resize-y rounded-[1.15rem] border border-forest-accent/10 bg-white/56 px-3.5 py-2.5 text-sm leading-5 text-forest-ink outline-none transition focus:border-forest-accent/30 focus:ring-2 focus:ring-forest-accent/8"
          />
          <span className="block text-right text-[10px] text-forest-muted/70">
            {draft.message.length}/{FEEDBACK_MESSAGE_MAX_LENGTH}
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-forest-ink">联系方式（选填）</span>
          <input
            type="text"
            value={draft.contact}
            onChange={event => updateDraft({ contact: event.target.value })}
            maxLength={FEEDBACK_CONTACT_MAX_LENGTH}
            autoComplete="email"
            placeholder="不方便邮箱往返时，可留微信或其他方式"
            className="min-h-11 w-full rounded-full border border-forest-accent/10 bg-white/56 px-3.5 text-sm text-forest-ink outline-none transition focus:border-forest-accent/30 focus:ring-2 focus:ring-forest-accent/8"
          />
        </label>

        <p className="text-[10px] leading-4 text-forest-muted/80">
          站内不会自动发送账号、手记或牌阵数据，也不会自动附带截图；这里填写的内容会保存为本机草稿。
        </p>

        <div className="grid grid-cols-[0.85fr_1.5fr] gap-2 pt-0.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="min-h-11 rounded-full border border-forest-accent/10 bg-white/38 px-4 text-sm font-medium text-forest-muted transition-colors hover:bg-white/66 hover:text-forest-ink"
          >
            稍后再写
          </motion.button>
          <motion.a
            whileTap={{ scale: 0.98 }}
            href={emailHref}
            onClick={handleOpenEmail}
            aria-label={`写邮件到 ${FEEDBACK_EMAIL}，请附截图和文字说明`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest-accent px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-forest-accent/90"
          >
            <Mail size={15} />
            写邮件反馈
          </motion.a>
        </div>

        <p className="select-text text-center text-[10px] text-forest-muted/70">
          邮箱：{FEEDBACK_EMAIL} · 微信：{FEEDBACK_WECHAT_ID}
        </p>
      </div>
    </Modal>
  );
}
