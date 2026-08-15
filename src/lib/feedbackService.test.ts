import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeedbackDraft,
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

  it('只把用户填写的反馈和必要环境信息送出', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitFeedback({
      category: 'bug',
      message: '日运复盘页面偶尔无法滚动',
      contact: 'user@example.com',
      pagePath: '/library',
      deviceType: '手机端',
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
    });
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

  it('邮箱转发服务要求收件确认时不标记为已送达', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Please activate your form by clicking the link sent to your email' }),
    }));

    await expect(submitFeedback({
      category: 'feature',
      message: '希望反馈可以稳定送达作者邮箱',
      contact: '',
    })).resolves.toMatchObject({ deliveryState: 'needs-activation' });
  });

  it('线上同源 API 不可用时自动尝试邮箱直连兜底', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'Not found' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ message: 'sent' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitFeedback({
      category: 'bug',
      message: '部署后的反馈接口需要自动兜底',
      contact: '',
    })).resolves.toMatchObject({ deliveryState: 'sent' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/feedback');
    expect(fetchMock.mock.calls[1][0]).toBe('https://formsubmit.co/ajax/roxy163@outlook.com');
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
