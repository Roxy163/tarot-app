import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from './FeedbackModal';

describe('FeedbackModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('展示微信、邮箱和隐私说明', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);

    expect(screen.getByText('反馈与建议')).toBeInTheDocument();
    expect(screen.getByText('juben6868')).toBeInTheDocument();
    expect(screen.getByText(/roxy163@outlook\.com/)).toBeInTheDocument();
    expect(screen.getByText(/不会附带账号、手记或牌阵数据/)).toBeInTheDocument();
  });

  it('可以复制微信号', async () => {
    const user = userEvent.setup();
    const onSent = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={onSent} />);

    await user.click(screen.getByRole('button', { name: '复制微信号 juben6868' }));

    expect(writeText).toHaveBeenCalledWith('juben6868');
    expect(onSent).toHaveBeenCalledWith('已复制微信号：juben6868');
  });

  it('送出成功后关闭并显示成功提示', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    render(<FeedbackModal isOpen onClose={onClose} onSent={onSent} />);

    await user.type(
      screen.getByPlaceholderText(/哪里不顺手/),
      '希望日运入口在手机上再紧凑一点',
    );
    await user.click(screen.getByRole('button', { name: '送出建议' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSent).toHaveBeenCalledWith('建议已送出，谢谢你帮研习阁变得更好。');
  });

  it('邮箱转发服务需要确认时保留弹窗并提示微信兜底', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Please activate your form by clicking the link sent to your email' }),
    }));

    render(<FeedbackModal isOpen onClose={onClose} onSent={onSent} />);

    const textarea = screen.getByPlaceholderText(/哪里不顺手/);
    await user.type(textarea, '希望能直接把建议送到作者邮箱');
    await user.click(screen.getByRole('button', { name: '送出建议' }));

    expect(await screen.findByText(/邮箱转发服务还需要作者确认/)).toBeInTheDocument();
    expect(screen.getByText(/如果比较着急，可以复制微信号 juben6868/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制微信' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /邮箱发送/ })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('希望能直接把建议送到作者邮箱');
  });

  it('送出失败时保留内容并提示微信兜底', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    render(<FeedbackModal isOpen onClose={vi.fn()} onSent={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/哪里不顺手/);
    await user.type(textarea, '这条反馈在断网时也不应该丢失');
    await user.click(screen.getByRole('button', { name: '送出建议' }));

    expect(await screen.findByText('暂时没能送出，内容已保存在本机。')).toBeInTheDocument();
    expect(screen.getByText(/如果比较着急，可以复制微信号 juben6868/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制微信' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /邮箱发送/ })).not.toBeInTheDocument();
    expect(textarea).toHaveValue('这条反馈在断网时也不应该丢失');
  });
});
