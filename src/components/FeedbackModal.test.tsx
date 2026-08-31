import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from './FeedbackModal';

describe('FeedbackModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('优先展示邮箱反馈和截图说明，微信只保留在底部联系方式', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);

    expect(screen.getByText('反馈与建议')).toBeInTheDocument();
    expect(screen.getByText('优先邮箱反馈')).toBeInTheDocument();
    expect(screen.getByText('roxy163@outlook.com')).toBeInTheDocument();
    expect(screen.getByText(/请带上截图和文字说明/)).toBeInTheDocument();
    expect(screen.getByText(/截图最好包含出问题的页面/)).toBeInTheDocument();
    expect(screen.getByText(/微信：juben6868/)).toBeInTheDocument();
    expect(screen.getByText(/站内不会自动发送账号、手记或牌阵数据/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /复制微信/ })).not.toBeInTheDocument();
  });

  it('把用户填写的说明带入邮箱草稿', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '遇到问题' }));
    await user.type(
      screen.getByPlaceholderText(/哪个页面/),
      '删除自定义牌阵时弹窗被底部导航挡住',
    );
    await user.type(
      screen.getByPlaceholderText(/不方便邮箱往返/),
      '微信 juben6868',
    );

    const emailLink = screen.getByRole('link', { name: /写邮件到 roxy163@outlook\.com/ });
    const href = decodeURIComponent(emailLink.getAttribute('href') || '');

    expect(href).toContain('mailto:roxy163@outlook.com');
    expect(href).toContain('subject=[塔罗研习阁反馈] 遇到问题');
    expect(href).toContain('截图：请添加问题页面、报错提示或异常状态截图');
    expect(href).toContain('文字说明：删除自定义牌阵时弹窗被底部导航挡住');
    expect(href).toContain('联系方式：微信 juben6868');
  });

  it('点击邮箱反馈时提示用户附上截图和文字说明', async () => {
    const user = userEvent.setup();
    const onSent = vi.fn();
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={onSent} />);

    await user.type(screen.getByPlaceholderText(/哪个页面/), '希望反馈入口更清楚');

    const emailLink = screen.getByRole('link', { name: /写邮件到 roxy163@outlook\.com/ });
    emailLink.addEventListener('click', event => event.preventDefault());
    emailLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onSent).toHaveBeenCalledWith('已打开邮箱，请附上截图和文字说明后发送。');
  });
});
