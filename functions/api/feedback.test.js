import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './feedback.js';

const createRequest = (payload, ip = '203.0.113.10') => new Request('https://tarot-pavilion.pages.dev/api/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': ip,
  },
  body: JSON.stringify(payload),
});

const createPayload = (overrides = {}) => ({
  _subject: '[塔罗研习阁] 遇到问题',
  _honey: '',
  反馈类型: '遇到问题',
  反馈内容: '删除自定义牌阵时弹窗被挡住',
  联系方式: 'user@example.com',
  使用端: '手机端',
  页面: '/add',
  提交时间: '2026/09/01 01:40:00',
  截图数量: '1',
  attachments: [{
    filename: 'bug.png',
    contentType: 'image/png',
    content: 'aW1hZ2U=',
    size: 5,
  }],
  ...overrides,
});

describe('feedback function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('没有配置 Resend 时返回可识别状态', async () => {
    const response = await onRequestPost({
      request: createRequest(createPayload(), '203.0.113.11'),
      env: {},
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deliveryState).toBe('needs-configuration');
    expect(body.message).toContain('RESEND_API_KEY');
  });

  it('通过 Resend 发送文字和截图附件', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'email_123' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestPost({
      request: createRequest(createPayload(), '203.0.113.12'),
      env: {
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_EMAIL: 'Tarot Pavilion <feedback@example.com>',
        FEEDBACK_TO_EMAIL: 'roxy163@outlook.com',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deliveryState).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchMock.mock.calls[0];
    const resendPayload = JSON.parse(requestInit.body);

    expect(url).toBe('https://api.resend.com/emails');
    expect(requestInit.headers.Authorization).toBe('Bearer re_test_key');
    expect(resendPayload).toMatchObject({
      from: 'Tarot Pavilion <feedback@example.com>',
      to: ['roxy163@outlook.com'],
      subject: '[塔罗研习阁] 遇到问题',
      attachments: [{
        filename: 'bug.png',
        content: 'aW1hZ2U=',
        content_type: 'image/png',
      }],
    });
    expect(resendPayload.text).toContain('反馈内容：删除自定义牌阵时弹窗被挡住');
    expect(resendPayload.html).toContain('截图数量');
  });

  it('拒绝非图片附件', async () => {
    const response = await onRequestPost({
      request: createRequest(createPayload({
        attachments: [{
          filename: 'debug.txt',
          contentType: 'text/plain',
          content: 'dGV4dA==',
          size: 4,
        }],
      }), '203.0.113.13'),
      env: {
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_EMAIL: 'Tarot Pavilion <feedback@example.com>',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain('截图只支持');
  });
});
