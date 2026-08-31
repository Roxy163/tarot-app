import { readJsonRecordWithBackup, writeJsonWithBackup } from './safeLocalStorage';

export const FEEDBACK_EMAIL = 'roxy163@outlook.com';
export const FEEDBACK_WECHAT_ID = 'juben6868';
export const FEEDBACK_MESSAGE_MAX_LENGTH = 1200;
export const FEEDBACK_CONTACT_MAX_LENGTH = 100;
export const FEEDBACK_ATTACHMENT_MAX_COUNT = 3;
export const FEEDBACK_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
export const FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES = 8 * 1024 * 1024;
export const FEEDBACK_ATTACHMENT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const FEEDBACK_DRAFT_KEY = 'tarot_feedback_draft_v1';
const FEEDBACK_LAST_SENT_KEY = 'tarot_feedback_last_sent_at';
const FEEDBACK_COOLDOWN_MS = 30_000;
const FEEDBACK_ENDPOINT = '/api/feedback';

export const FEEDBACK_CATEGORIES = [
  { value: 'experience', label: '使用感受' },
  { value: 'feature', label: '功能建议' },
  { value: 'bug', label: '遇到问题' },
  { value: 'other', label: '其他' },
] as const;

export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number]['value'];

export interface FeedbackDraft {
  category: FeedbackCategory;
  message: string;
  contact: string;
}

export interface FeedbackAttachment {
  filename: string;
  contentType: string;
  content: string;
  size: number;
}

export interface FeedbackSubmission extends FeedbackDraft {
  pagePath?: string;
  deviceType?: '手机端' | '电脑端';
  honeypot?: string;
  attachments?: FeedbackAttachment[];
}

export type FeedbackDeliveryState = 'sent' | 'needs-activation' | 'needs-configuration';

export interface FeedbackSubmitResult {
  deliveryState: FeedbackDeliveryState;
  providerMessage?: string;
}

export type FeedbackErrorCode = 'invalid' | 'rate-limit' | 'network';

export class FeedbackSubmissionError extends Error {
  code: FeedbackErrorCode;

  constructor(code: FeedbackErrorCode, message: string) {
    super(message);
    this.name = 'FeedbackSubmissionError';
    this.code = code;
  }
}

const isFeedbackCategory = (value: unknown): value is FeedbackCategory => (
  FEEDBACK_CATEGORIES.some(category => category.value === value)
);

const getCategoryLabel = (category: FeedbackCategory) => (
  FEEDBACK_CATEGORIES.find(item => item.value === category)?.label || '其他'
);

const readLastSentAt = () => {
  try {
    const value = Number(localStorage.getItem(FEEDBACK_LAST_SENT_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeLastSentAt = (timestamp: number) => {
  try {
    localStorage.setItem(FEEDBACK_LAST_SENT_KEY, String(timestamp));
  } catch {
    // 频率提示是辅助能力，浏览器拒绝写入时不阻塞正常提交。
  }
};

export const loadFeedbackDraft = (): FeedbackDraft | null => {
  const saved = readJsonRecordWithBackup<Record<string, unknown>>(FEEDBACK_DRAFT_KEY);
  if (!saved || !isFeedbackCategory(saved.category)) return null;

  return {
    category: saved.category,
    message: typeof saved.message === 'string' ? saved.message.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH) : '',
    contact: typeof saved.contact === 'string' ? saved.contact.slice(0, FEEDBACK_CONTACT_MAX_LENGTH) : '',
  };
};

export const saveFeedbackDraft = (draft: FeedbackDraft) => {
  writeJsonWithBackup(FEEDBACK_DRAFT_KEY, {
    category: isFeedbackCategory(draft.category) ? draft.category : 'experience',
    message: draft.message.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH),
    contact: draft.contact.slice(0, FEEDBACK_CONTACT_MAX_LENGTH),
  });
};

export const clearFeedbackDraft = () => {
  try {
    localStorage.removeItem(FEEDBACK_DRAFT_KEY);
    localStorage.removeItem(`${FEEDBACK_DRAFT_KEY}__backup`);
    localStorage.removeItem(`${FEEDBACK_DRAFT_KEY}__latest`);
  } catch {
    // 已发送成功，清理失败不影响用户继续使用。
  }
};

const isAllowedAttachmentType = (contentType: string) => (
  FEEDBACK_ATTACHMENT_ALLOWED_TYPES.includes(contentType)
);

const getAttachmentSize = (attachment: FeedbackAttachment) => {
  const estimatedSize = Math.ceil((attachment.content || '').length * 3 / 4);
  if (Number.isFinite(attachment.size) && attachment.size > 0) {
    return Math.max(attachment.size, estimatedSize);
  }
  return estimatedSize;
};

const cleanAttachmentFilename = (filename: string, index: number) => {
  const cleaned = filename.trim().replace(/[^\w.\-\u4e00-\u9fa5]/g, '-').slice(0, 90);
  return cleaned || `screenshot-${index + 1}.png`;
};

const sanitizeAttachments = (attachments: FeedbackAttachment[] = []) => {
  if (attachments.length > FEEDBACK_ATTACHMENT_MAX_COUNT) {
    throw new FeedbackSubmissionError('invalid', `截图最多上传 ${FEEDBACK_ATTACHMENT_MAX_COUNT} 张。`);
  }

  let totalBytes = 0;

  return attachments.map((attachment, index) => {
    const contentType = String(attachment.contentType || '').toLowerCase();
    const content = String(attachment.content || '').replace(/^data:[^;]+;base64,/, '');
    const size = getAttachmentSize({ ...attachment, content });

    if (!content || !/^[a-z0-9+/=]+$/i.test(content)) {
      throw new FeedbackSubmissionError('invalid', '截图内容读取失败，请重新选择。');
    }

    if (!isAllowedAttachmentType(contentType)) {
      throw new FeedbackSubmissionError('invalid', '截图只支持 PNG、JPG、WebP 或 GIF。');
    }

    if (size > FEEDBACK_ATTACHMENT_MAX_BYTES) {
      throw new FeedbackSubmissionError('invalid', '单张截图不能超过 3MB。');
    }

    totalBytes += size;
    if (totalBytes > FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES) {
      throw new FeedbackSubmissionError('invalid', '截图总大小不能超过 8MB。');
    }

    return {
      filename: cleanAttachmentFilename(attachment.filename, index),
      contentType,
      content,
      size,
    };
  });
};

const readProviderResult = async (response: Response) => {
  try {
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json') && typeof response.json === 'function') {
      const payload = await response.json() as Record<string, unknown>;
      const providerMessage = [payload.message, payload.error, payload.success, payload.providerMessage]
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
      const deliveryState = (
        payload.deliveryState === 'sent'
        || payload.deliveryState === 'needs-activation'
        || payload.deliveryState === 'needs-configuration'
      )
        ? payload.deliveryState
        : undefined;

      return { providerMessage, deliveryState };
    }

    if (typeof response.text === 'function') {
      return { providerMessage: await response.text() };
    }
  } catch {
    // 服务端返回体只用于展示错误原因，解析失败时走统一失败提示。
  }

  return { providerMessage: '' };
};

const needsRecipientActivation = (message: string) => (
  /activat|confirm|verif|验证|确认|激活|domain|sender|from/i.test(message)
);

const createFeedbackPayload = (
  categoryLabel: string,
  message: string,
  contact: string,
  submission: FeedbackSubmission,
  attachments: FeedbackAttachment[],
  now: number,
) => ({
  _subject: `[塔罗研习阁] ${categoryLabel}`,
  _honey: submission.honeypot || '',
  反馈类型: categoryLabel,
  反馈内容: message,
  联系方式: contact || '未填写',
  使用端: submission.deviceType || '电脑端',
  页面: submission.pagePath || '/',
  提交时间: new Date(now).toLocaleString('zh-CN', { hour12: false }),
  截图数量: String(attachments.length),
  attachments,
});

const postFeedback = async (payload: Record<string, unknown>) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    return await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

export async function submitFeedback(submission: FeedbackSubmission): Promise<FeedbackSubmitResult> {
  const now = Date.now();
  const category = isFeedbackCategory(submission.category) ? submission.category : 'other';
  const message = submission.message.trim();
  const contact = submission.contact.trim();
  const attachments = sanitizeAttachments(submission.attachments || []);

  if (submission.honeypot) {
    throw new FeedbackSubmissionError('invalid', '提交内容未通过检查。');
  }

  if (message.length < 5) {
    throw new FeedbackSubmissionError('invalid', '再多写一点点，方便作者理解你的想法。');
  }

  if (message.length > FEEDBACK_MESSAGE_MAX_LENGTH || contact.length > FEEDBACK_CONTACT_MAX_LENGTH) {
    throw new FeedbackSubmissionError('invalid', '内容有些长，请稍微精简后再送出。');
  }

  const remaining = FEEDBACK_COOLDOWN_MS - (now - readLastSentAt());
  if (remaining > 0) {
    throw new FeedbackSubmissionError('rate-limit', `建议已经送出过了，${Math.ceil(remaining / 1000)} 秒后可再次提交。`);
  }

  const categoryLabel = getCategoryLabel(category);
  const payload = createFeedbackPayload(categoryLabel, message, contact, submission, attachments, now);

  try {
    const response = await postFeedback(payload);
    const result = await readProviderResult(response);
    const providerMessage = result.providerMessage;

    if (result.deliveryState === 'sent') {
      writeLastSentAt(now);
      return { deliveryState: 'sent', providerMessage };
    }

    if (
      result.deliveryState === 'needs-configuration'
      || result.deliveryState === 'needs-activation'
      || needsRecipientActivation(providerMessage)
    ) {
      return {
        deliveryState: result.deliveryState === 'needs-configuration' ? 'needs-configuration' : 'needs-activation',
        providerMessage,
      };
    }

    if (response.ok) {
      writeLastSentAt(now);
      return { deliveryState: 'sent', providerMessage };
    }

    throw new FeedbackSubmissionError('network', providerMessage || '暂时没能送出，内容已保存在本机。');
  } catch (error) {
    if (error instanceof FeedbackSubmissionError) throw error;
    throw new FeedbackSubmissionError('network', '暂时没能送出，内容已保存在本机。');
  }
}
