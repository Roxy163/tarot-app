import { render, screen } from '@testing-library/react';
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
    customSpreadCount: 1,
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
    expect(screen.getByText('访客本机暂存')).toBeInTheDocument();
    expect(screen.getByText('当前记录只在这台设备，登录后可同步到云端。')).toBeInTheDocument();
    expect(screen.getByText('待读取')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '登录开启同步' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText('本机典籍')).toBeInTheDocument();
    expect(screen.getByText('云端典籍')).toBeInTheDocument();
    expect(screen.getByText('5 条')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新同步' }));
    expect(onManualSync).toHaveBeenCalledTimes(1);
  });

  it('shows retry status and keeps the retry button available after sync error', () => {
    renderPanel({
      session: { uid: 'user-1' },
      isCloudSyncPaused: true,
      cloudSyncInfo: {
        ...baseSyncInfo,
        status: 'error',
        lastError: 'Missing or insufficient permissions.',
      },
    });

    expect(screen.getByText('同步需要重试')).toBeInTheDocument();
    expect(screen.getByText('Missing or insufficient permissions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新同步' })).toBeEnabled();
  });
});
