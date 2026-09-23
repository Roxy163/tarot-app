import { readJsonRecordWithBackup, writeJsonWithBackup } from './safeLocalStorage';
import { normalizeFeedbackAttachments } from '../../shared/feedbackAttachments.js';
export {
  FEEDBACK_ATTACHMENT_ACCEPT,
  FEEDBACK_ATTACHMENT_MAX_COUNT,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES,
  resolveFeedbackAttachmentType,
  validateFeedbackAttachment,
} from '../../shared/feedbackAttachments.js';

export const FEEDBACK_EMAIL = 'roxy163@outlook.com';
export const FEEDBACK_WECHAT_ID = 'juben6868';
export const FEEDBACK_MESSAGE_MAX_LENGTH = 1200;
export const FEEDBACK_CONTACT_MAX_LENGTH = 100;

const FEEDBACK_DRAFT_KEY = 'tarot_feedback_draft_v1';
const FEEDBACK_LAST_SENT_KEY = 'tarot_feedback_last_sent_at';
const FEEDBACK_GUEST_ID_KEY = 'tarot_feedback_guest_id_v1';
const FEEDBACK_COOLDOWN_MS = 30_000;
const FEEDBACK_ENDPOINT = '/api/feedback';

export const FEEDBACK_CATEGORIES = [
  { value: 'feature', label: '产品建议' },
  { value: 'bug', label: 'bug 反馈' },
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

export interface FeedbackUserContext {
  authState?: 'signed-in' | 'guest';
  uid?: string;
  publicId?: string;
  email?: string | null;
  displayName?: string | null;
}

export interface FeedbackSubmission extends FeedbackDraft {
  deviceType?: '手机端' | '电脑端';
  honeypot?: string;
  attachments?: FeedbackAttachment[];
  userContext?: FeedbackUserContext;
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

const createGuestFeedbackId = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = globalThis.crypto?.randomUUID?.().replace(/-/g, '')
    || Math.random().toString(36).slice(2, 12);
  return `GUEST-${datePart}-${randomPart.slice(0, 8).toUpperCase()}`;
};

const getGuestFeedbackId = () => {
  try {
    const saved = localStorage.getItem(FEEDBACK_GUEST_ID_KEY);
    if (saved) return saved.slice(0, 40);

    const nextId = createGuestFeedbackId();
    localStorage.setItem(FEEDBACK_GUEST_ID_KEY, nextId);
    return nextId;
  } catch {
    return 'GUEST-LOCAL';
  }
};

export const loadFeedbackDraft = (): FeedbackDraft | null => {
  const saved = readJsonRecordWithBackup<Record<string, unknown>>(FEEDBACK_DRAFT_KEY);
  if (!saved) return null;
  const category = saved.category === 'experience' ? 'feature' : saved.category;
  if (!isFeedbackCategory(category)) return null;

  return {
    category,
    message: typeof saved.message === 'string' ? saved.message.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH) : '',
    contact: typeof saved.contact === 'string' ? saved.contact.slice(0, FEEDBACK_CONTACT_MAX_LENGTH) : '',
  };
};

export const saveFeedbackDraft = (draft: FeedbackDraft) => {
  writeJsonWithBackup(FEEDBACK_DRAFT_KEY, {
    category: isFeedbackCategory(draft.category) ? draft.category : 'feature',
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

const cleanContextText = (value: string | null | undefined, maxLength = 160) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const createFeedbackUserPayload = (userContext?: FeedbackUserContext) => {
  const isSignedIn = userContext?.authState === 'signed-in' || Boolean(userContext?.uid || userContext?.email);
  const payload: Record<string, string> = {
    登录状态: isSignedIn ? '已登录' : '游客',
  };
  const publicId = cleanContextText(userContext?.publicId, 80);
  const uid = cleanContextText(userContext?.uid, 120);
  const email = cleanContextText(userContext?.email, 160);
  const displayName = cleanContextText(userContext?.displayName, 80);

  if (publicId) payload.公开ID = publicId;
  if (uid) payload.用户ID = uid;
  if (email) payload.登录邮箱 = email;
  if (displayName) payload.昵称 = displayName;
  if (!isSignedIn) payload.游客反馈ID = getGuestFeedbackId();

  return payload;
};

const sanitizeAttachments = (attachments: FeedbackAttachment[] = []) => {
  try {
    return normalizeFeedbackAttachments(attachments);
  } catch (error) {
    throw new FeedbackSubmissionError('invalid', error instanceof Error ? error.message : '附件读取失败，请重新选择。');
  }
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
  提交时间: new Date(now).toLocaleString('zh-CN', { hour12: false }),
  附件数量: String(attachments.length),
  用户识别: createFeedbackUserPayload(submission.userContext),
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
