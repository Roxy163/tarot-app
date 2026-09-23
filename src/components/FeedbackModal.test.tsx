import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from './FeedbackModal';
import { PNG_BYTES } from '../test/feedbackFixtures';

describe('FeedbackModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('保留简洁表单，按需展开发送说明和联系方式', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '支持与反馈' })).toBeInTheDocument();
    expect(screen.queryByText('优先附截图说明')).not.toBeInTheDocument();
    expect(screen.queryByText(/VPN/)).not.toBeInTheDocument();
    expect(screen.getByText('图片、PDF、TXT · 单个不超过 3MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '产品建议' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'bug 反馈' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '其他' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '使用感受' })).not.toBeInTheDocument();
    expect(screen.queryByText(/邮箱：roxy163@outlook/)).not.toBeInTheDocument();
    const details = screen.getByRole('button', { name: '发送说明与联系作者' });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    await user.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByText(/会附带登录状态和用户识别信息/)).toBeVisible());
    expect(screen.getByText(/邮箱：roxy163@outlook\.com/)).toBeInTheDocument();
    expect(screen.getByText(/微信：juben6868/)).toBeInTheDocument();
    await user.click(details);
    expect(screen.queryByRole('link', { name: '用邮箱联系作者' })).not.toBeInTheDocument();
  });

  it('把用户填写的说明和截图发送到反馈接口', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ deliveryState: 'sent', message: 'sent' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <FeedbackModal
        isOpen
        onClose={onClose}
        onSent={onSent}
        userContext={{
          authState: 'signed-in',
          uid: 'uid-123',
          publicId: 'TAROT-260901-ABCD1234',
          email: 'reader@example.com',
          displayName: '阿月',
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'bug 反馈' }));
    await user.type(
      screen.getByPlaceholderText(/分享你的想法/),
      '删除自定义牌阵时弹窗被底部导航挡住',
    );
    await user.upload(
      screen.getByLabelText('上传反馈附件'),
      new File([PNG_BYTES], 'bug.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('bug.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '发送给作者' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSent).toHaveBeenCalledWith('反馈已发送到作者邮箱，谢谢你帮研习阁变得更好。');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));

    expect(url).toBe('/api/feedback');
    expect(payload).toMatchObject({
      反馈类型: 'bug 反馈',
      反馈内容: '删除自定义牌阵时弹窗被底部导航挡住',
      附件数量: '1',
      用户识别: {
        登录状态: '已登录',
        公开ID: 'TAROT-260901-ABCD1234',
        用户ID: 'uid-123',
        登录邮箱: 'reader@example.com',
        昵称: '阿月',
      },
    });
    expect(payload).not.toHaveProperty('页面');
    expect(payload.attachments[0]).toEqual(expect.objectContaining({
      filename: 'bug.png',
      contentType: 'image/png',
      content: expect.any(String),
      size: expect.any(Number),
    }));
  });

  it('邮件服务未配置时保留草稿并提供手动邮箱兜底', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        deliveryState: 'needs-configuration',
        message: '邮件服务还没配置完成。',
      }),
    }));

    render(<FeedbackModal isOpen onClose={onClose} onSent={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/分享你的想法/), '希望反馈入口更清楚');
    await user.click(screen.getByRole('button', { name: '发送给作者' }));

    expect(await screen.findByText(/暂时无法直接发送，草稿已保留/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开邮箱手动发' })).toHaveAttribute('href', expect.stringContaining('mailto:roxy163@outlook.com'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('支持 PDF 和 TXT 附件，移除后不会发送被移除的文件', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ deliveryState: 'sent' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<FeedbackModal isOpen onClose={onClose} onSent={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: /反馈内容/ }), '这是附件上传的反馈内容');
    await user.upload(screen.getByLabelText('上传反馈附件'), [
      new File(['%PDF-1.4\n%%EOF'], '说明.pdf', { type: 'application/pdf' }),
      new File(['复现步骤：打开设置'], '说明.txt', { type: 'text/plain' }),
    ]);
    expect(await screen.findByText('说明.pdf')).toBeInTheDocument();
    expect(await screen.findByText('说明.txt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '移除附件 说明.pdf' }));
    expect(screen.queryByText('说明.pdf')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '发送给作者' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.附件数量).toBe('1');
    expect(payload.attachments).toEqual([expect.objectContaining({ filename: '说明.txt', contentType: 'text/plain' })]);
  });

  it('拒绝伪装为图片的附件，保留反馈内容', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: /反馈内容/ }), '这段反馈需要保留');
    await user.upload(screen.getByLabelText('上传反馈附件'), new File(['not a png'], '假图片.png', { type: 'image/png' }));
    expect(await screen.findByText(/附件内容与文件格式不符/)).toBeInTheDocument();
    expect(screen.queryByText('假图片.png')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /反馈内容/ })).toHaveValue('这段反馈需要保留');
  });

  it('读取附件时暂缓发送，关闭后完成的旧读取不会混入新表单', async () => {
    const readers: Array<{ result: string; onload: (() => void) | null }> = [];
    vi.stubGlobal('FileReader', class {
      result = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() { readers.push(this); }
    });
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onSent: vi.fn() };
    const { rerender } = render(<FeedbackModal {...props} isOpen />);
    await user.upload(screen.getByLabelText('上传反馈附件'), new File(['text'], '旧附件.txt', { type: 'text/plain' }));
    expect(screen.getByRole('button', { name: '发送给作者' })).toBeDisabled();
    rerender(<FeedbackModal {...props} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('main', { name: '支持与反馈' })).not.toBeInTheDocument());
    rerender(<FeedbackModal {...props} isOpen />);
    await act(async () => {
      readers[0].result = 'data:text/plain;base64,dGV4dA==';
      readers[0].onload?.();
    });
    expect(screen.queryByText('旧附件.txt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送给作者' })).toBeEnabled();
  });

  it('关闭再打开时恢复文字草稿，并可用键盘访问折叠说明', async () => {
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onSent: vi.fn() };
    const { rerender } = render(<FeedbackModal {...props} isOpen />);
    await user.type(screen.getByRole('textbox', { name: /反馈内容/ }), '保留原有风格，只收纳次要入口');
    rerender(<FeedbackModal {...props} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('main', { name: '支持与反馈' })).not.toBeInTheDocument());
    rerender(<FeedbackModal {...props} isOpen />);
    expect(screen.getByRole('textbox', { name: /反馈内容/ })).toHaveValue('保留原有风格，只收纳次要入口');
    const details = screen.getByRole('button', { name: '发送说明与联系作者' });
    details.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('link', { name: '用邮箱联系作者' })).toBeVisible());
  });
});
