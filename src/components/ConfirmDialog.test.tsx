import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('does not render dialog content when closed', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="删除手记"
        message="确定删除这条手记吗？"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('删除手记')).not.toBeInTheDocument();
  });

  it('closes without confirming when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        title="删除手记"
        message="确定删除这条手记吗？"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming when the close icon is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        title="删除手记"
        message="确定删除这条手记吗？"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs confirm before closing when confirmed', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];

    render(
      <ConfirmDialog
        isOpen
        title="清空位置"
        message="确定要清空自由画布上的所有位置吗？"
        confirmText="清空"
        onConfirm={() => {
          calls.push('confirm');
        }}
        onClose={() => {
          calls.push('close');
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '清空' }));

    expect(calls).toEqual(['confirm', 'close']);
  });

  it('waits for async confirmation before closing', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];

    render(
      <ConfirmDialog
        isOpen
        title="删除手记"
        message="确定删除这条手记吗？"
        confirmText="删除"
        onConfirm={async () => {
          await Promise.resolve();
          calls.push('confirm');
        }}
        onClose={() => {
          calls.push('close');
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(calls).toEqual(['confirm', 'close']);
  });
});
