import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidebarDrawer } from './SidebarDrawer';

function Harness({ allowEdgeSwipe = true, onAction = () => {} }: { allowEdgeSwipe?: boolean; onAction?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>打开菜单</button>
    <div data-testid="page">页面正文</div>
    <SidebarDrawer isOpen={open} onOpenChange={setOpen} allowEdgeSwipe={allowEdgeSwipe}>
      <h2>研习阁菜单</h2><button onClick={onAction}>菜单操作</button>
    </SidebarDrawer>
  </>;
}

function drag(target: Element, from: [number, number], to: [number, number], cancel = false) {
  const base = { pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true };
  fireEvent.pointerDown(target, { ...base, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(target, { ...base, clientX: to[0], clientY: to[1] });
  (cancel ? fireEvent.pointerCancel : fireEvent.pointerUp)(target, { ...base, clientX: to[0], clientY: to[1] });
}

describe('SidebarDrawer', () => {
  it('supports keyboard opening, focus containment, Escape and focus restoration', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '打开菜单' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: '侧边菜单' });
    expect(within(dialog).getByRole('button', { name: '关闭菜单' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: '菜单操作' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: '关闭菜单' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(document.body.style.position).not.toBe('fixed');
  });

  it('opens from a rightward edge swipe and closes with a leftward swipe', async () => {
    render(<Harness />);
    drag(screen.getByTestId('page'), [15, 200], [175, 203]);
    expect(screen.getByRole('dialog', { name: '侧边菜单' })).toBeInTheDocument();
    drag(screen.getByRole('heading', { name: '研习阁菜单' }), [220, 180], [65, 181]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leaves vertical scrolling, short pulls, cancelled gestures and content swipes alone', async () => {
    render(<Harness />);
    const page = screen.getByTestId('page');
    drag(page, [15, 200], [35, 310]);
    drag(page, [15, 200], [32, 200]);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    drag(page, [15, 200], [170, 200], true);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    drag(page, [150, 200], [300, 200]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses only the explicit handle on the card editing page', () => {
    render(<Harness allowEdgeSwipe={false} />);
    drag(screen.getByTestId('page'), [15, 200], [170, 200]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    drag(screen.getByRole('button', { name: '侧边菜单：点击或向右滑动打开' }), [15, 200], [170, 200]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('releases a partial drawer and the scroll lock when the window loses focus', async () => {
    render(<Harness />);
    const page = screen.getByTestId('page');
    fireEvent.pointerDown(page, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 15, clientY: 200 });
    fireEvent.pointerMove(page, { pointerId: 1, pointerType: 'touch', clientX: 60, clientY: 200 });
    expect(document.body.style.position).toBe('fixed');
    fireEvent.blur(window);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    expect(document.body.style.position).not.toBe('fixed');
  });

  it('keeps menu taps working while allowing deliberate swipes across menu buttons', async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<Harness onAction={action} />);
    await user.click(screen.getByRole('button', { name: '打开菜单' }));
    const button = screen.getByRole('button', { name: '菜单操作' });
    await user.click(button);
    expect(action).toHaveBeenCalledTimes(1);
    drag(button, [220, 200], [60, 200]);
    fireEvent.click(button, { detail: 1 });
    expect(action).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks swipe and handle opening while another dialog is active', async () => {
    const user = userEvent.setup();
    render(<><Harness /><div role="dialog" aria-modal="true" aria-label="正在编辑">其他弹窗</div></>);
    drag(screen.getByTestId('page'), [15, 200], [170, 200]);
    await user.click(screen.getByRole('button', { name: '侧边菜单：点击或向右滑动打开' }));
    expect(screen.queryByRole('dialog', { name: '侧边菜单' })).not.toBeInTheDocument();
  });

  it('suppresses the trailing click after a drag so it cannot activate menu content', () => {
    const action = vi.fn();
    render(<Harness onAction={action} />);
    drag(screen.getByRole('button', { name: '侧边菜单：点击或向右滑动打开' }), [15, 200], [175, 200]);
    fireEvent.click(screen.getByRole('button', { name: '菜单操作' }), { detail: 1 });
    expect(action).not.toHaveBeenCalled();
  });
});
