import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CloudSyncPanel } from './CloudSyncPanel';
import type { CloudSyncInfo } from '../hooks/useReadings';

const baseSyncInfo: CloudSyncInfo = {
  status: 'guest',
  lastSyncedAt: null,
  lastAttemptAt: null,
  cloudReadingsCount: null,
  lastError: null,
};

const renderPanel = (overrides: Partial<ComponentProps<typeof CloudSyncPanel>> = {}) => {
  const props: ComponentProps<typeof CloudSyncPanel> = {
    session: null,
    cloudSyncInfo: baseSyncInfo,
    isCloudSyncPaused: false,
    readingCount: 2,
    reviewedReadingCount: 1,
    todayCount: 0,
    onManualSync: vi.fn(),
    onLogin: vi.fn(),
    onOpenLibrary: vi.fn(),
    onStartReading: vi.fn(),
    ...overrides,
  };

  render(<CloudSyncPanel {...props} />);
  return props;
};

describe('CloudSyncPanel', () => {
  it('shows guest local storage status and login action', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    renderPanel({ onLogin });

    expect(screen.getByTestId('cloud-sync-panel')).toBeInTheDocument();
    expect(screen.getByText('本机已保存')).toBeInTheDocument();
    expect(screen.queryByText('最近同步')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '同步详情' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('手记复盘')).toBeInTheDocument();
    expect(screen.getByText('今日手记')).toBeInTheDocument();
    expect(screen.getByText('待登录')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '登录开启同步' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('keeps the card and statistics read-only; only the login button starts login', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    renderPanel({ onLogin, showPrimaryAction: false });

    await user.click(screen.getByTestId('cloud-sync-panel'));
    await user.click(screen.getByText('今日手记'));
    expect(onLogin).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '登录开启同步' }));
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it('reveals sync details on demand and supports keyboard collapse', async () => {
    const user = userEvent.setup();
    renderPanel();
    const details = screen.getByRole('button', { name: '同步详情' });
    await user.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('还没有同步记录')).toBeInTheDocument();
    expect(screen.getByText('本机记录已保留，登录后可同步到云端。')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByText('最近同步')).not.toBeInTheDocument());
  });

  it('shows signed-in cloud counts and runs manual sync', async () => {
    const user = userEvent.setup();
    const onManualSync = vi.fn();
    renderPanel({
      session: { uid: 'user-1' },
      cloudSyncInfo: {
        ...baseSyncInfo,
        status: 'synced',
        lastSyncedAt: '2026-07-09T10:30:00.000Z',
        cloudReadingsCount: 5,
      },
      readingCount: 4,
      onManualSync,
    });

    expect(screen.getByText('云端已同步')).toBeInTheDocument();
    expect(screen.getByText('本机手记')).toBeInTheDocument();
    expect(screen.getByText('云端手记')).toBeInTheDocument();
    expect(screen.getByText('5 条')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新同步' }));
    expect(onManualSync).toHaveBeenCalledTimes(1);
  });

  it('keeps real sync errors and retry visible while technical details are folded', async () => {
    const user = userEvent.setup();
    renderPanel({
      session: { uid: 'user-1' },
      isCloudSyncPaused: true,
      cloudSyncInfo: {
        ...baseSyncInfo,
        status: 'error',
        lastError: 'Missing or insufficient permissions.',
      },
    });

    expect(screen.getByText('稍后再同步')).toBeInTheDocument();
    expect(screen.getByText('云端暂时没有连上，记录已保留在本机。')).toBeInTheDocument();
    expect(screen.queryByText('Missing or insufficient permissions.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新同步' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '同步详情' }));
    expect(screen.getByText('Missing or insufficient permissions.')).toBeInTheDocument();
  });
});
