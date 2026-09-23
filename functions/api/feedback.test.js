import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './feedback.js';
import { PNG_CONTENT } from '../../src/test/feedbackFixtures';

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
  提交时间: '2026/09/01 01:40:00',
  附件数量: '1',
  用户识别: {
    登录状态: '已登录',
    公开ID: 'TAROT-260901-ABCD1234',
    用户ID: 'uid-123',
    登录邮箱: 'reader@example.com',
    昵称: '阿月',
  },
  attachments: [{
    filename: 'bug.png',
    contentType: 'image/png',
    content: PNG_CONTENT,
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
        content: PNG_CONTENT,
        content_type: 'image/png',
      }],
    });
    expect(resendPayload.text).toContain('反馈内容：删除自定义牌阵时弹窗被挡住');
    expect(resendPayload.text).toContain('用户状态：已登录');
    expect(resendPayload.text).toContain('用户ID：uid-123');
    expect(resendPayload.text).toContain('登录邮箱：reader@example.com');
    expect(resendPayload.text).not.toContain('页面：');
    expect(resendPayload.html).toContain('附件数量');
    expect(resendPayload.html).toContain('公开ID');
  });

  it('拒绝伪报为图片的可执行文件', async () => {
    const response = await onRequestPost({
      request: createRequest(createPayload({
        attachments: [{
          filename: 'debug.exe',
          contentType: 'image/png',
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
    expect(body.message).toContain('附件支持');
  });

  it('拒绝超过总大小的截图附件', async () => {
    const response = await onRequestPost({
      request: createRequest(createPayload({
        attachments: Array.from({ length: 9 }, (_, index) => ({
          filename: `bug-${index}.png`,
          contentType: 'image/png',
          content: PNG_CONTENT,
          size: 3 * 1024 * 1024,
        })),
      }), '203.0.113.14'),
      env: {
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_EMAIL: 'Tarot Pavilion <feedback@example.com>',
      },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain('附件总大小不能超过 24MB');
  });

  it('把 PDF 和文本完整传给邮件服务，并对邮件文字转义', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'test' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const attachments = [
      { filename: '说明.pdf', contentType: 'application/pdf', content: btoa('%PDF-1.4\n%%EOF'), size: 14 },
      { filename: '步骤.txt', contentType: 'text/plain', content: btoa('reproduction steps'), size: 18 },
    ];
    const response = await onRequestPost({
      request: createRequest(createPayload({ 反馈内容: '<script>test</script>', 附件数量: '999', attachments }), '203.0.113.15'),
      env: { RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'feedback@example.com' },
    });
    expect(response.status).toBe(200);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.attachments).toEqual(attachments.map(({ filename, contentType, content }) => ({ filename, content, content_type: contentType })));
    expect(payload.text).toContain('附件数量：2');
    expect(payload.html).toContain('&lt;script&gt;');
    expect(payload.html).not.toContain('<script>');
  });

  it.each([
    ['假 PDF', { filename: 'debug.pdf', contentType: 'application/pdf', content: btoa('MZ executable'), size: 13 }],
    ['损坏的编码', { filename: 'debug.txt', contentType: 'text/plain', content: 'broken==encoding', size: 1 }],
    ['谎报大小', { filename: 'debug.txt', contentType: 'text/plain', content: btoa('a'.repeat(3 * 1024 * 1024 + 1)), size: 1 }],
  ])('在接收端拦截%s，避免仅依赖前端检查', async (name, attachment) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequestPost({
      request: createRequest(createPayload({ attachments: [attachment] }), `test-${encodeURIComponent(name)}`),
      env: { RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'feedback@example.com' },
    });
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
