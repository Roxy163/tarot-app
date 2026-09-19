import { useState } from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { CardPicker } from './CardPicker';

describe('modal keyboard navigation', () => {
  it('skips hidden, disabled and untabbable controls and leaves Escape to Chinese input composition', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>打开</button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="输入窗口">
          <button tabIndex={-1}>跳过</button><input type="hidden" />
          <fieldset disabled><input aria-label="不可编辑" /></fieldset>
          <div hidden><button>隐藏</button></div>
          <input aria-label="正文" /><button>保存</button>
        </Modal>
      </>;
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await user.tab();
    expect(screen.getByRole('textbox', { name: '正文' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '保存' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '关闭输入窗口' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    expect(screen.getByRole('dialog', { name: '输入窗口' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: '打开' })).toHaveFocus());
  });

  it('preserves desktop search focus in a nested card picker and returns to its opener', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const [picker, setPicker] = useState(false);
      return <><button onClick={() => setOpen(true)}>打开</button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="外层记录">
          <button onClick={() => setPicker(true)}>选牌</button>
          {picker && <CardPicker onSelect={() => setPicker(false)} onClose={() => setPicker(false)} />}
        </Modal>
      </>;
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '打开' }));
    await user.click(screen.getByRole('button', { name: '选牌' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '选择塔罗牌' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '外层记录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选牌' })).toHaveFocus();
  });

  it('traps focus, closes only the top dialog, and restores the opening control', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const [confirm, setConfirm] = useState(false);
      return <><button onClick={() => setOpen(true)}>打开</button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="外层"><input aria-label="输入" /><button onClick={() => setConfirm(true)}>内层</button></Modal>
        <ConfirmDialog isOpen={confirm} title="内层确认" message="确认内容" onClose={() => setConfirm(false)} onConfirm={() => {}} />
      </>;
    }
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '打开' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: '外层' });
    expect(within(dialog).getByRole('button', { name: '关闭外层' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: '内层' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: '内层确认' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '内层' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
