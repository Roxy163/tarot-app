import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PageView } from './PageView';
import { closeTopModal } from '../hooks/useModalFocus';

function NavigationHarness() {
  const [page, setPage] = useState(false);
  const [child, setChild] = useState(false);
  const [saving, setSaving] = useState(false);
  return <>
    <button onClick={() => setPage(true)}>打开设置内容</button>
    <input aria-label="原页面草稿" defaultValue="未完成内容" />
    <PageView isOpen={page} onBack={() => setPage(false)} title="一级页面">
      <button onClick={() => setChild(true)}>编辑内容</button>
      <PageView isOpen={child} onBack={() => setChild(false)} backDisabled={saving} title="二级页面">
        <textarea aria-label="编辑内容" />
        <button onClick={() => setSaving(value => !value)}>{saving ? '完成保存' : '开始保存'}</button>
      </PageView>
    </PageView>
  </>;
}

describe('PageView navigation', () => {
  it('opens full pages, isolates their sources, and returns one level with focus and drafts intact', async () => {
    const user = userEvent.setup();
    const { container } = render(<NavigationHarness />);
    await user.click(screen.getByRole('button', { name: '打开设置内容' }));
    const parent = screen.getByRole('main', { name: '一级页面' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.inert).toBe(true);
    expect(container).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('button', { name: '编辑内容' }));
    expect(parent.inert).toBe(true);
    act(() => { expect(closeTopModal()).toBe(true); });
    await waitFor(() => expect(screen.queryByRole('main', { name: '二级页面' })).not.toBeInTheDocument());
    expect(parent.inert).toBe(false);
    expect(parent).not.toHaveAttribute('aria-hidden');
    expect(container.inert).toBe(true);
    await waitFor(() => expect(screen.getByRole('button', { name: '编辑内容' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('main', { name: '一级页面' })).not.toBeInTheDocument());
    expect(container.inert).toBeFalsy();
    expect(container).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('textbox', { name: '原页面草稿' })).toHaveValue('未完成内容');
    await waitFor(() => expect(screen.getByRole('button', { name: '打开设置内容' })).toHaveFocus());
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('respects the saving guard for both browser Back and the header button', async () => {
    const user = userEvent.setup();
    render(<NavigationHarness />);
    await user.click(screen.getByRole('button', { name: '打开设置内容' }));
    await user.click(screen.getByRole('button', { name: '编辑内容' }));
    await user.click(screen.getByRole('button', { name: '开始保存' }));
    expect(screen.getByRole('button', { name: '返回（二级页面）' })).toBeDisabled();
    act(() => { closeTopModal(); });
    expect(screen.getByRole('main', { name: '二级页面' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('main', { name: '二级页面' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '完成保存' }));
    await user.click(screen.getByRole('button', { name: '返回（二级页面）' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '二级页面' })).not.toBeInTheDocument());
    expect(screen.getByRole('main', { name: '一级页面' })).toBeInTheDocument();
  });
});
