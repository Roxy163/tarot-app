import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from './FeedbackModal';

describe('FeedbackModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('展示站内邮箱直达、截图说明和底部联系方式', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);

    expect(screen.getByText('反馈与建议')).toBeInTheDocument();
    expect(screen.getByText('站内邮箱直达')).toBeInTheDocument();
    expect(screen.getByText('roxy163@outlook.com')).toBeInTheDocument();
    expect(screen.getByText(/可以直接发送文字和截图/)).toBeInTheDocument();
    expect(screen.getByText(/截图最好包含出问题的页面/)).toBeInTheDocument();
    expect(screen.getByText(/最多 3 张，每张不超过 3MB/)).toBeInTheDocument();
    expect(screen.getByText(/微信：juben6868/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /复制微信/ })).not.toBeInTheDocument();
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

    render(<FeedbackModal isOpen onClose={onClose} onSent={onSent} />);

    await user.click(screen.getByRole('button', { name: '遇到问题' }));
    await user.type(
      screen.getByPlaceholderText(/哪个页面/),
      '删除自定义牌阵时弹窗被底部导航挡住',
    );
    await user.upload(
      screen.getByLabelText('添加反馈截图'),
      new File(['image-content'], 'bug.png', { type: 'image/png' }),
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
      反馈类型: '遇到问题',
      反馈内容: '删除自定义牌阵时弹窗被底部导航挡住',
      截图数量: '1',
    });
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

    await user.type(screen.getByPlaceholderText(/哪个页面/), '希望反馈入口更清楚');
    await user.click(screen.getByRole('button', { name: '发送给作者' }));

    expect(await screen.findByText(/邮件服务还没配置完成/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开邮箱手动发' })).toHaveAttribute('href', expect.stringContaining('mailto:roxy163@outlook.com'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
