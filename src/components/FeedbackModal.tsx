import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, MessageSquareText, Send, X } from 'lucide-react';
import { Modal } from './Modal';
import {
  clearFeedbackDraft,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CONTACT_MAX_LENGTH,
  FEEDBACK_EMAIL,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_WECHAT_ID,
  FeedbackDraft,
  FeedbackSubmissionError,
  loadFeedbackDraft,
  saveFeedbackDraft,
  submitFeedback,
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

export function FeedbackModal({ isOpen, onClose, onSent }: FeedbackModalProps) {
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [honeypot, setHoneypot] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [hasCopiedWechat, setHasCopiedWechat] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(loadFeedbackDraft() || EMPTY_DRAFT);
    setHoneypot('');
    setErrorMessage('');
    setNoticeMessage('');
    setHasCopiedWechat(false);
  }, [isOpen]);

  const updateDraft = (patch: Partial<FeedbackDraft>) => {
    setDraft(current => {
      const next = { ...current, ...patch };
      saveFeedbackDraft(next);
      return next;
    });
    setErrorMessage('');
    setNoticeMessage('');
  };

  const handleCopyWechat = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_WECHAT_ID);
      setHasCopiedWechat(true);
      onSent(`已复制微信号：${FEEDBACK_WECHAT_ID}`);
      window.setTimeout(() => setHasCopiedWechat(false), 1800);
    } catch {
      setNoticeMessage(`如果复制失败，请手动添加微信：${FEEDBACK_WECHAT_ID}`);
    }
  };

  const handleSubmit = async () => {
    setIsSending(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      const result = await submitFeedback({
        ...draft,
        honeypot,
        pagePath: window.location.pathname,
        deviceType: window.matchMedia?.('(max-width: 640px)').matches ? '手机端' : '电脑端',
      });

      if (result.deliveryState === 'needs-activation') {
        setNoticeMessage('邮箱转发服务还需要作者确认一次收件地址；内容已保存在本机。可以复制微信号直接发我。');
        return;
      }

      clearFeedbackDraft();
      setDraft(EMPTY_DRAFT);
      onClose();
      onSent('建议已送出，谢谢你帮研习阁变得更好。');
    } catch (error) {
      setErrorMessage(
        error instanceof FeedbackSubmissionError
          ? error.message
          : '暂时没能送出，内容已保存在本机。',
      );
    } finally {
      setIsSending(false);
    }
  };

  const feedbackNotice = errorMessage || noticeMessage;

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
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium text-forest-accent">微信反馈</p>
              <p className="font-serif text-[1.05rem] font-bold leading-6 tracking-wide text-forest-ink">
                {FEEDBACK_WECHAT_ID}
              </p>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleCopyWechat}
              aria-label={`复制微信号 ${FEEDBACK_WECHAT_ID}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-forest-accent/10 bg-white/58 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-white/80"
            >
              {hasCopiedWechat ? <Check size={14} /> : <Copy size={14} />}
              {hasCopiedWechat ? '已复制' : '复制'}
            </motion.button>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-forest-muted">
            如果邮箱没有送达，可以直接加微信说明问题，截图也可以发。
          </p>
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
          <span className="text-xs font-medium text-forest-ink">想告诉作者什么？</span>
          <textarea
            value={draft.message}
            onChange={event => updateDraft({ message: event.target.value })}
            maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
            rows={4}
            placeholder="哪里不顺手、想加什么功能，或只是使用感受……"
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
            placeholder="邮箱或其他方便联系你的方式"
            className="min-h-11 w-full rounded-full border border-forest-accent/10 bg-white/56 px-3.5 text-sm text-forest-ink outline-none transition focus:border-forest-accent/30 focus:ring-2 focus:ring-forest-accent/8"
          />
        </label>

        <div hidden aria-hidden="true">
          <label>
            请勿填写
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={event => setHoneypot(event.target.value)}
            />
          </label>
        </div>

        <AnimatePresence initial={false}>
          {feedbackNotice && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={`rounded-xl border px-3 py-2.5 text-xs leading-5 text-forest-ink ${
                errorMessage
                  ? 'border-forest-pink/18 bg-forest-pink/7'
                  : 'border-forest-accent/14 bg-forest-accent/7'
              }`}
              role="status"
            >
              <p>{feedbackNotice}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-forest-muted">
                  如果比较着急，可以复制微信号 {FEEDBACK_WECHAT_ID} 直接发我。
                </span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCopyWechat}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/58 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-white/78"
                >
                  {hasCopiedWechat ? <Check size={14} /> : <Copy size={14} />}
                  {hasCopiedWechat ? '已复制' : '复制微信'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] leading-4 text-forest-muted/80">
          只发送这里填写的内容，不会附带账号、手记或牌阵数据。未送出的内容会保存在本机。
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
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSending}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest-accent px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-forest-accent/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            ) : (
              <Send size={15} />
            )}
            {isSending ? '正在送出…' : '送出建议'}
          </motion.button>
        </div>

        <p className="text-center text-[10px] text-forest-muted/70">
          邮箱：{FEEDBACK_EMAIL} · 微信：{FEEDBACK_WECHAT_ID}
        </p>
      </div>
    </Modal>
  );
}
