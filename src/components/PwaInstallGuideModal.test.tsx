import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PwaInstallGuideModal } from './PwaInstallGuideModal';

describe('PwaInstallGuideModal', () => {
  it('shows actionable install guidance and can request the browser install prompt', async () => {
    const user = userEvent.setup();
    const onTryInstall = vi.fn();

    render(
      <PwaInstallGuideModal
        isOpen
        onClose={vi.fn()}
        canAutoInstall
        onTryInstall={onTryInstall}
      />,
    );

    expect(screen.getByRole('heading', { name: '下载安装到桌面' })).toBeInTheDocument();
    expect(screen.getByText('当前设备推荐流程')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /现在安装/ }));

    expect(onTryInstall).toHaveBeenCalledTimes(1);
  });

  it('shows manual steps without a dead install button when the browser has no prompt', () => {
    render(<PwaInstallGuideModal isOpen onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '现在安装' })).not.toBeInTheDocument();
    expect(screen.getByText('看地址栏右侧是否有安装图标。')).toBeInTheDocument();
  });

  it('copies the public site rather than a local preview URL', async () => {
    const user = userEvent.setup();
    render(<PwaInstallGuideModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '复制网址' }));

    expect(await navigator.clipboard.readText()).toBe('https://tarot-pavilion.pages.dev');
  });
});
