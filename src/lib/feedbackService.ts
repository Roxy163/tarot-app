import { readJsonRecordWithBackup, writeJsonWithBackup } from './safeLocalStorage';

export const FEEDBACK_EMAIL = 'roxy163@outlook.com';
export const FEEDBACK_WECHAT_ID = 'juben6868';
export const FEEDBACK_MESSAGE_MAX_LENGTH = 1200;
export const FEEDBACK_CONTACT_MAX_LENGTH = 100;

const FEEDBACK_DRAFT_KEY = 'tarot_feedback_draft_v1';
const FEEDBACK_LAST_SENT_KEY = 'tarot_feedback_last_sent_at';
const FEEDBACK_COOLDOWN_MS = 30_000;
const FEEDBACK_ENDPOINT = '/api/feedback';
const FEEDBACK_DIRECT_ENDPOINT = `https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`;

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

export interface FeedbackSubmission extends FeedbackDraft {
  pagePath?: string;
  deviceType?: '手机端' | '电脑端';
  honeypot?: string;
}

export type FeedbackDeliveryState = 'sent' | 'needs-activation';

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

const readProviderResult = async (response: Response) => {
  try {
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json') && typeof response.json === 'function') {
      const payload = await response.json() as Record<string, unknown>;
      const providerMessage = [payload.message, payload.error, payload.success, payload.providerMessage]
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
      const deliveryState = payload.deliveryState === 'sent' || payload.deliveryState === 'needs-activation'
        ? payload.deliveryState
        : undefined;

      return { providerMessage, deliveryState };
    }

    if (typeof response.text === 'function') {
      return { providerMessage: await response.text() };
    }
  } catch {
    // 第三方服务的返回体只用于判断是否需要邮箱确认，解析失败不阻塞提交流程。
  }

  return { providerMessage: '' };
};

const needsRecipientActivation = (message: string) => (
  /activat|confirm|verif|验证|确认|激活/i.test(message)
);

const createFeedbackPayload = (
  categoryLabel: string,
  message: string,
  contact: string,
  submission: FeedbackSubmission,
  now: number,
) => ({
  _subject: `[塔罗研习阁] ${categoryLabel}`,
  _template: 'table',
  _captcha: 'false',
  _honey: '',
  反馈类型: categoryLabel,
  反馈内容: message,
  联系方式: contact || '未填写',
  使用端: submission.deviceType || '电脑端',
  页面: submission.pagePath || '/',
  提交时间: new Date(now).toLocaleString('zh-CN', { hour12: false }),
});

const postFeedback = async (url: string, payload: Record<string, string>) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(url, {
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
  const payload = createFeedbackPayload(categoryLabel, message, contact, submission, now);
  let providerMessage = '';

  try {
    const primaryResponse = await postFeedback(FEEDBACK_ENDPOINT, payload);
    const primaryResult = await readProviderResult(primaryResponse);
    providerMessage = primaryResult.providerMessage;

    if (primaryResult.deliveryState === 'needs-activation' || needsRecipientActivation(providerMessage)) {
      return { deliveryState: 'needs-activation', providerMessage };
    }

    if (primaryResponse.ok) {
      writeLastSentAt(now);
      return { deliveryState: 'sent', providerMessage };
    }
  } catch (error) {
    if (error instanceof FeedbackSubmissionError) throw error;
  }

  try {
    const fallbackResponse = await postFeedback(FEEDBACK_DIRECT_ENDPOINT, payload);
    const fallbackResult = await readProviderResult(fallbackResponse);
    providerMessage = fallbackResult.providerMessage || providerMessage;

    if (fallbackResult.deliveryState === 'needs-activation' || needsRecipientActivation(providerMessage)) {
      return { deliveryState: 'needs-activation', providerMessage };
    }

    if (!fallbackResponse.ok) {
      throw new FeedbackSubmissionError('network', '暂时没能送出，内容已保存在本机。');
    }

    writeLastSentAt(now);
    return { deliveryState: 'sent', providerMessage };
  } catch (error) {
    if (error instanceof FeedbackSubmissionError) throw error;
    throw new FeedbackSubmissionError('network', '暂时没能送出，内容已保存在本机。');
  }
}
