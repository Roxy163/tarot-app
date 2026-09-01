import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeedbackDraft,
  FEEDBACK_ATTACHMENT_MAX_COUNT,
  FEEDBACK_ATTACHMENT_MAX_BYTES,
  FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES,
  loadFeedbackDraft,
  saveFeedbackDraft,
  submitFeedback,
} from './feedbackService';

describe('feedbackService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('在本机保留未送出草稿，成功后可清理', () => {
    saveFeedbackDraft({
      category: 'feature',
      message: '希望可以增加更紧凑的记录入口',
      contact: 'user@example.com',
    });

    expect(loadFeedbackDraft()).toEqual({
      category: 'feature',
      message: '希望可以增加更紧凑的记录入口',
      contact: 'user@example.com',
    });

    clearFeedbackDraft();
    expect(loadFeedbackDraft()).toBeNull();
  });

  it('只把用户填写的反馈、截图和必要环境信息送出', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ deliveryState: 'sent', message: 'sent' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitFeedback({
      category: 'bug',
      message: '日运复盘页面偶尔无法滚动',
      contact: 'user@example.com',
      pagePath: '/library',
      deviceType: '手机端',
      attachments: [{
        filename: 'bug.png',
        contentType: 'image/png',
        content: 'aW1hZ2U=',
        size: 5,
      }],
    });

    expect(result.deliveryState).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));

    expect(url).toBe('/api/feedback');
    expect(payload).toMatchObject({
      反馈类型: '遇到问题',
      反馈内容: '日运复盘页面偶尔无法滚动',
      联系方式: 'user@example.com',
      使用端: '手机端',
      页面: '/library',
      截图数量: '1',
    });
    expect(payload.attachments[0]).toEqual(expect.objectContaining({
      filename: 'bug.png',
      contentType: 'image/png',
      content: 'aW1hZ2U=',
    }));
    expect(JSON.stringify(payload)).not.toContain('readings');
    expect(JSON.stringify(payload)).not.toContain('userId');
  });

  it('内容过短时不发起网络请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitFeedback({
      category: 'experience',
      message: '好',
      contact: '',
    })).rejects.toMatchObject({ code: 'invalid' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('邮件服务未配置时不标记为已送达', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        deliveryState: 'needs-configuration',
        message: '邮件服务还没配置完成。',
      }),
    }));

    await expect(submitFeedback({
      category: 'feature',
      message: '希望反馈可以稳定送达作者邮箱',
      contact: '',
    })).resolves.toMatchObject({ deliveryState: 'needs-configuration' });
  });

  it('限制截图数量、类型和总大小', async () => {
    const tooManyAttachments = Array.from({ length: FEEDBACK_ATTACHMENT_MAX_COUNT + 1 }, (_, index) => ({
      filename: `bug-${index}.png`,
      contentType: 'image/png',
      content: 'aW1hZ2U=',
      size: 5,
    }));

    await expect(submitFeedback({
      category: 'bug',
      message: '截图太多时应该拦住',
      contact: '',
      attachments: tooManyAttachments,
    })).rejects.toMatchObject({ code: 'invalid' });

    const oversizedBatch = Array.from({ length: FEEDBACK_ATTACHMENT_MAX_COUNT }, (_, index) => ({
      filename: `bug-${index}.png`,
      contentType: 'image/png',
      content: 'aW1hZ2U=',
      size: Math.ceil(FEEDBACK_ATTACHMENT_TOTAL_MAX_BYTES / FEEDBACK_ATTACHMENT_MAX_COUNT) + 1,
    }));

    expect(oversizedBatch[0].size).toBeLessThanOrEqual(FEEDBACK_ATTACHMENT_MAX_BYTES);

    await expect(submitFeedback({
      category: 'bug',
      message: '截图总量太大时应该拦住',
      contact: '',
      attachments: oversizedBatch,
    })).rejects.toMatchObject({
      code: 'invalid',
      message: '截图总大小不能超过 24MB。',
    });

    await expect(submitFeedback({
      category: 'bug',
      message: '不允许上传非图片附件',
      contact: '',
      attachments: [{
        filename: 'debug.txt',
        contentType: 'text/plain',
        content: 'dGV4dA==',
        size: 4,
      }],
    })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('网络失败时返回可识别的错误，便于界面保留草稿', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(submitFeedback({
      category: 'experience',
      message: '这是一条会保留的反馈内容',
      contact: '',
    })).rejects.toMatchObject({ code: 'network' });
  });
});
