import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, ExternalLink, Paperclip, Send, Trash2, UploadCloud } from 'lucide-react';
import { PageView } from './PageView';
import {
  clearFeedbackDraft,
  FEEDBACK_ATTACHMENT_ACCEPT,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  FEEDBACK_ATTACHMENT_MAX_COUNT,
  FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CONTACT_MAX_LENGTH,
  FEEDBACK_EMAIL,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_WECHAT_ID,
  FeedbackAttachment,
  FeedbackDraft,
  FeedbackSubmissionError,
  FeedbackUserContext,
  loadFeedbackDraft,
  saveFeedbackDraft,
  submitFeedback,
  resolveFeedbackAttachmentType,
  validateFeedbackAttachment,
} from '../lib/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
  userContext?: FeedbackUserContext;
}

type SelectedFeedbackAttachment = FeedbackAttachment & {
  id: string;
};

const EMPTY_DRAFT: FeedbackDraft = {
  category: 'feature',
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

const formatFileSize = (bytes: number) => (
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`
);

const getAttachmentTotalSize = (items: SelectedFeedbackAttachment[]) => (
  items.reduce((total, item) => total + item.size, 0)
);

const createAttachmentId = (file: File) => (
  `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`
);

const readAttachmentFile = (file: File): Promise<SelectedFeedbackAttachment> => new Promise((resolve, reject) => {
  let contentType: string;
  try {
    contentType = resolveFeedbackAttachmentType(file.name, file.type);
  } catch (error) {
    reject(error);
    return;
  }

  if (file.size > FEEDBACK_ATTACHMENT_MAX_BYTES) {
    reject(new Error('单个附件不能超过 3MB。'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('附件读取失败，请重新选择。'));
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    const content = result.split(',')[1] || '';

    try {
      resolve({
        ...validateFeedbackAttachment({ filename: file.name, contentType, content, size: file.size }),
        id: createAttachmentId(file),
      });
    } catch (error) {
      reject(error);
    }
  };
  reader.readAsDataURL(file);
});

const createFeedbackEmailHref = (draft: FeedbackDraft, attachmentCount: number) => {
  const categoryLabel = getCategoryLabel(draft.category);
  const message = draft.message.trim();
  const contact = draft.contact.trim();
  const subject = `[塔罗研习阁反馈] ${categoryLabel}`;
  const attachmentLine = attachmentCount > 0
    ? `站内已选择 ${attachmentCount} 个附件，请在这封邮件里重新添加。`
    : '可按需附上图片、PDF 或 TXT 文件。';
  const body = [
    '请保留下面的文字说明，按需添加相关附件。',
    '',
    `反馈类型：${categoryLabel}`,
    `附件：${attachmentLine}`,
    `文字说明：${message || '（请描述在哪里、做了什么、发生了什么）'}`,
    contact ? `联系方式：${contact}` : '联系方式：（可选）',
    `使用端：${getDeviceType()}`,
  ].join('\n');

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export function FeedbackModal({ isOpen, onClose, onSent, userContext }: FeedbackModalProps) {
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [attachments, setAttachments] = useState<SelectedFeedbackAttachment[]>([]);
  const [honeypot, setHoneypot] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isReadingAttachments, setIsReadingAttachments] = useState(false);
  const attachmentReadVersion = useRef(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [showContactDetails, setShowContactDetails] = useState(false);
  const emailHref = useMemo(() => createFeedbackEmailHref(draft, attachments.length), [attachments.length, draft]);
  const feedbackNotice = errorMessage || noticeMessage;

  useEffect(() => {
    if (!isOpen) return;
    setDraft(loadFeedbackDraft() || EMPTY_DRAFT);
    setAttachments([]);
    setHoneypot('');
    setErrorMessage('');
    setNoticeMessage('');
    setIsSending(false);
    setIsReadingAttachments(false);
    setShowContactDetails(false);
    return () => { attachmentReadVersion.current += 1; };
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

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0 || isReadingAttachments || isSending) return;

    setErrorMessage('');
    setNoticeMessage('');

    const remainingSlots = FEEDBACK_ATTACHMENT_MAX_COUNT - attachments.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`附件最多上传 ${FEEDBACK_ATTACHMENT_MAX_COUNT} 个。`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    const readVersion = ++attachmentReadVersion.current;
    setIsReadingAttachments(true);
    const nextAttachments: SelectedFeedbackAttachment[] = [];
    let nextTotalSize = getAttachmentTotalSize(attachments);
    const issues: string[] = files.length > remainingSlots
      ? [`附件最多上传 ${FEEDBACK_ATTACHMENT_MAX_COUNT} 个。`]
      : [];

    for (const file of selectedFiles) {
      try {
        const attachment = await readAttachmentFile(file);
        if (nextTotalSize + attachment.size > FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES) {
          issues.push(`附件总大小不能超过 ${formatFileSize(FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES)}。`);
          continue;
        }

        nextTotalSize += attachment.size;
        nextAttachments.push(attachment);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : '附件读取失败，请重新选择。');
      }
    }

    if (readVersion !== attachmentReadVersion.current) return;
    setIsReadingAttachments(false);
    if (nextAttachments.length > 0) {
      setAttachments(current => [...current, ...nextAttachments]);
    }

    if (issues.length > 0) {
      setErrorMessage(issues[0]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(current => current.filter(attachment => attachment.id !== id));
    setErrorMessage('');
  };

  const handleOpenEmail = () => {
    saveFeedbackDraft(draft);
    onSent('已打开邮箱，请确认文字说明并重新添加所选附件后发送。');
  };

  const handleSubmit = async () => {
    setIsSending(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      const result = await submitFeedback({
        ...draft,
        honeypot,
        attachments,
        deviceType: getDeviceType(),
        userContext,
      });

      if (result.deliveryState === 'needs-configuration' || result.deliveryState === 'needs-activation') {
        setNoticeMessage('暂时无法直接发送，草稿已保留。你可以打开邮箱，附上文字和附件发送。');
        return;
      }

      clearFeedbackDraft();
      setDraft(EMPTY_DRAFT);
      setAttachments([]);
      onClose();
      onSent('反馈已发送到作者邮箱，谢谢你帮研习阁变得更好。');
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

  return (
    <PageView
      isOpen={isOpen}
      onBack={onClose}
      backDisabled={isSending}
      title="支持与反馈"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-1 rounded-full border border-forest-accent/7 bg-white/32 p-1" aria-label="反馈类型">
          {FEEDBACK_CATEGORIES.map(category => {
            const isActive = draft.category === category.value;
            return (
              <motion.button
                key={category.value}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => updateDraft({ category: category.value })}
                aria-pressed={isActive}
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
          <span className="text-xs font-medium text-forest-ink">反馈内容</span>
          <textarea
            value={draft.message}
            onChange={event => updateDraft({ message: event.target.value })}
            maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
            rows={6}
            placeholder="分享你的想法，或描述需要帮助的地方…"
            className="min-h-24 w-full resize-y rounded-[1.15rem] border border-forest-accent/10 bg-white/56 px-3.5 py-2.5 text-sm leading-5 text-forest-ink outline-none transition focus:border-forest-accent/30 focus:ring-2 focus:ring-forest-accent/8"
          />
          <span className="block text-right text-[10px] text-forest-muted/70">
            {draft.message.length}/{FEEDBACK_MESSAGE_MAX_LENGTH}
          </span>
        </label>

        <div className="space-y-2 rounded-[1.15rem] border border-forest-accent/8 bg-white/34 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip size={16} className="shrink-0 text-forest-accent" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-forest-ink">上传附件（选填）</p>
                <p className="text-[10px] text-forest-muted">
                  图片、PDF、TXT · 单个不超过 3MB
                </p>
              </div>
            </div>
            <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-forest-accent/10 bg-white/58 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-white/78">
              <UploadCloud size={14} />
              {isReadingAttachments ? '读取中…' : '上传'}
              <input
                type="file"
                accept={FEEDBACK_ATTACHMENT_ACCEPT}
                multiple
                disabled={isReadingAttachments || isSending}
                className="sr-only"
                aria-label="上传反馈附件"
                onChange={handleAttachmentChange}
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="grid gap-1.5">
              {attachments.map(attachment => (
                <div
                  key={attachment.id}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white/58 px-2.5 py-1.5 text-xs text-forest-ink"
                >
                  <span className="min-w-0 truncate">{attachment.filename}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] text-forest-muted">{formatFileSize(attachment.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      disabled={isReadingAttachments || isSending}
                      aria-label={`移除附件 ${attachment.filename}`}
                      className="grid min-h-11 min-w-11 place-items-center rounded-full text-forest-muted transition-colors hover:bg-forest-pink/8 hover:text-forest-pink"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-forest-ink">联系方式（选填）</span>
          <input
            type="text"
            value={draft.contact}
            onChange={event => updateDraft({ contact: event.target.value })}
            maxLength={FEEDBACK_CONTACT_MAX_LENGTH}
            autoComplete="email"
            placeholder="邮箱、微信或其他方便联系你的方式"
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
              <a
                href={emailHref}
                onClick={handleOpenEmail}
                className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/62 px-3 text-xs font-medium text-forest-accent transition-colors hover:bg-white/82"
              >
                <ExternalLink size={13} />
                打开邮箱手动发
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-0.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSending || isReadingAttachments}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-accent px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-forest-accent/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            ) : (
              <Send size={15} />
            )}
            {isSending ? '正在发送...' : '发送给作者'}
          </motion.button>
        </div>

        <div className="text-[11px] leading-5 text-forest-muted">
          <button type="button" aria-expanded={showContactDetails} aria-controls="feedback-contact-details" onClick={() => setShowContactDetails(open => !open)} className="flex min-h-11 w-full items-center gap-1.5 text-left">
            <ChevronRight size={13} aria-hidden="true" className={`transition-transform ${showContactDetails ? 'rotate-90' : ''}`} />
            发送说明与联系作者
          </button>
          {showContactDetails && <motion.div id="feedback-contact-details" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pb-1">
            <p>会附带登录状态和用户识别信息；不会自动附带账号密码、手记或牌阵数据。文字自动暂存在本机，附件仅在本次打开时保留。</p>
            <p>支持 PNG、JPG、WebP、GIF、PDF 和 UTF-8 编码的 TXT。最多 {FEEDBACK_ATTACHMENT_MAX_COUNT} 个附件，每个不超过 3MB，总计不超过 {formatFileSize(FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES)}。</p>
            <p className="select-text">邮箱：{FEEDBACK_EMAIL} · 微信：{FEEDBACK_WECHAT_ID}</p>
            <a href={emailHref} onClick={handleOpenEmail} className="inline-flex min-h-11 items-center text-forest-accent">用邮箱联系作者</a>
          </motion.div>}
        </div>
      </div>
    </PageView>
  );
}
