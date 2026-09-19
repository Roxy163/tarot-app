import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PwaInstallGuideModal } from './PwaInstallGuideModal';

describe('PwaInstallGuideModal', () => {
  it('shows actionable install guidance and can request the browser install prompt', async () => {
    const user = userEvent.setup();
    const onTryInstall = vi.fn();

    render(
      <PwaInstallGuideModal reminderPreference="auto" onReminderPreferenceChange={vi.fn(() => true)}
        isOpen
        onClose={vi.fn()}
        canAutoInstall
        onTryInstall={onTryInstall}
      />,
    );

    expect(screen.getByRole('heading', { name: '添加到桌面' })).toBeInTheDocument();
    expect(screen.getByText('当前设备推荐流程')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /现在安装/ }));

    expect(onTryInstall).toHaveBeenCalledTimes(1);
  });

  it('shows manual steps without a dead install button when the browser has no prompt', () => {
    render(<PwaInstallGuideModal reminderPreference="auto" onReminderPreferenceChange={vi.fn(() => true)} isOpen onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '现在安装' })).not.toBeInTheDocument();
    expect(screen.getByText('看地址栏右侧是否有安装图标。')).toBeInTheDocument();
  });

  it('copies the public site rather than a local preview URL', async () => {
    const user = userEvent.setup();
    render(<PwaInstallGuideModal reminderPreference="auto" onReminderPreferenceChange={vi.fn(() => true)} isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '复制网址' }));

    expect(await navigator.clipboard.readText()).toBe('https://tarot-pavilion.pages.dev');
  });

  it('lets users stop reminders, acknowledge an existing icon and re-enable reminders', async () => {
    const user = userEvent.setup();
    const change = vi.fn(() => true);
    const props = { isOpen: true, onClose: vi.fn(), onReminderPreferenceChange: change };
    const { rerender } = render(<PwaInstallGuideModal {...props} reminderPreference="auto" />);
    await user.click(screen.getByRole('switch', { name: '不再提醒添加到桌面' }));
    expect(change).toHaveBeenLastCalledWith('never');
    await user.click(screen.getByRole('button', { name: '我已添加到桌面' }));
    expect(change).toHaveBeenLastCalledWith('installed');
    rerender(<PwaInstallGuideModal {...props} reminderPreference="installed" />);
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByText('已记住添加状态，不再主动提醒。')).toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    expect(change).toHaveBeenLastCalledWith('auto');
  });

  it('explains when a reminder setting could not be saved', async () => {
    const user = userEvent.setup();
    const notice = vi.fn();
    render(<PwaInstallGuideModal isOpen onClose={vi.fn()} reminderPreference="auto" onReminderPreferenceChange={() => false} onNotice={notice} />);
    await user.click(screen.getByRole('switch'));
    expect(notice).toHaveBeenCalledWith(expect.stringContaining('浏览器未能保存'));
  });
});
