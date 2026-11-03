import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BackupPage } from './BackupPage';
import { createTarotBackup } from '../lib/tarotBackup';
import { downloadTextFile } from '../lib/downloadFile';

vi.mock('../lib/downloadFile', () => ({ downloadTextFile: vi.fn() }));
const backup = createTarotBackup({ readings: [], fortunes: [], spreads: [], cardMetadata: [], cardKeywordMemory: [], quizMemory: [], annotations: {}, numerology: {} });
const props = () => ({ isOpen: true, ready: true, onBack: vi.fn(), getBackup: vi.fn(async () => backup), onRestore: vi.fn(async () => {}) });
const chooseFile = (content: string) => {
  const file = new File([content], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => content });
  fireEvent.change(screen.getByLabelText('选择备份文件'), { target: { files: [file] } });
};

describe('backup page', () => {
  it('can retry optional cloud reads after leaving and ignores an old response when reopened', async () => {
    const callbacks = props();
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = render(<BackupPage {...callbacks} onRefreshNumerology={refresh} />);
    await userEvent.click(screen.getByRole('button', { name: '读取云端灵数' }));
    expect(screen.getByRole('button', { name: '返回（备份与恢复）' })).toBeEnabled();
    view.rerender(<BackupPage {...callbacks} isOpen={false} onRefreshNumerology={refresh} />);
    view.rerender(<BackupPage {...callbacks} onRefreshNumerology={refresh} />);
    expect(screen.getByRole('button', { name: '读取云端灵数' })).toBeEnabled();
    await act(async () => { finish(); });
    expect(screen.queryByText('云端灵数已缓存，可重新导出备份。')).not.toBeInTheDocument();
  });
  it('exports local data while syncing or optional cloud numerology is pending', async () => {
    const callbacks = props();
    const refresh = vi.fn(() => new Promise<void>(() => {}));
    render(<BackupPage {...callbacks} restoreReady={false} onRefreshNumerology={refresh} />);
    expect(refresh).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '读取云端灵数' }));
    await userEvent.click(screen.getByRole('button', { name: '导出 JSON 备份' }));
    expect(callbacks.getBackup).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    chooseFile(JSON.stringify(backup));
    await waitFor(() => expect(screen.getByRole('button', { name: '确认合并恢复' })).toBeDisabled());
    expect(screen.getByRole('button', { name: '导出 JSON 备份' })).toBeEnabled();
  });
  it('exports a portable file only on explicit request', async () => {
    const callbacks = props();
    render(<BackupPage {...callbacks} />);
    await userEvent.click(screen.getByRole('button', { name: '导出 JSON 备份' }));
    expect(downloadTextFile).toHaveBeenCalledWith(expect.stringMatching(/\.json$/), expect.stringContaining('tarot-pavilion-backup'), 'application/json');
    expect(callbacks.onRestore).not.toHaveBeenCalled();
  });
  it('previews the file and requires a separate confirmation; failed restore remains retryable', async () => {
    const callbacks = props();
    callbacks.onRestore.mockRejectedValueOnce(new Error('空间不足'));
    render(<BackupPage {...callbacks} />);
    chooseFile(JSON.stringify(backup));
    await screen.findByRole('button', { name: '确认合并恢复' });
    expect(callbacks.onRestore).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '确认合并恢复' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('空间不足');
    expect(screen.getByText('backup.json')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确认合并恢复' }));
    expect(await screen.findByRole('status')).toHaveTextContent('恢复完成');
    expect(callbacks.onRestore).toHaveBeenCalledTimes(2);
  });
  it('counts deleted examples separately from visible daily records in the restore preview', async () => {
    const entry = { id: 'day', userId: 'local', date: '2026-07-02', cardName: '隐士', isReversed: false,
      interpretation: '', keywords: [], createdAt: '2026-07-02T07:00:00Z' };
    const file = createTarotBackup({ ...backup.data, fortunes: [
      entry,
      { ...entry, id: 'saved-deleted', deletedAt: '2026-07-02T09:00:00Z', savedToCardAnnotationAt: '2026-07-02T08:00:00Z', dailyReview: '保留的例证' },
      { ...entry, id: 'plain-deleted', deletedAt: '2026-07-02T09:00:00Z' },
    ] });
    render(<BackupPage {...props()} />);
    chooseFile(JSON.stringify(file));
    await screen.findByRole('button', { name: '确认合并恢复' });
    expect(screen.getByText('日运').parentElement).toHaveTextContent('日运1');
    expect(screen.getByText('保留的日运例证').parentElement).toHaveTextContent('保留的日运例证1');
    expect(screen.getByText('已删除日运不会重新出现在日运档案；已归入的例证会留在牌义注疏中。')).toBeInTheDocument();
  });
  it('rejects a broken file without applying it and keeps account loading actions disabled', async () => {
    const callbacks = props();
    const view = render(<BackupPage {...callbacks} />);
    chooseFile('not json');
    expect(await screen.findByRole('alert')).toHaveTextContent('备份格式不正确');
    expect(screen.queryByRole('button', { name: '确认合并恢复' })).not.toBeInTheDocument();
    expect(callbacks.onRestore).not.toHaveBeenCalled();
    view.rerender(<BackupPage {...callbacks} ready={false} />);
    expect(screen.getByRole('button', { name: '导出 JSON 备份' })).toBeDisabled();
  });
  it('does not allow Back while a restore is being applied', async () => {
    const callbacks = props();
    let finish: () => void;
    callbacks.onRestore.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<BackupPage {...callbacks} />);
    chooseFile(JSON.stringify(backup));
    await screen.findByRole('button', { name: '确认合并恢复' });
    await userEvent.click(screen.getByRole('button', { name: '确认合并恢复' }));
    expect(screen.getByRole('button', { name: '返回（备份与恢复）' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(callbacks.onBack).not.toHaveBeenCalled();
    finish!();
    await waitFor(() => expect(screen.getByRole('button', { name: '返回（备份与恢复）' })).toBeEnabled());
  });
});
