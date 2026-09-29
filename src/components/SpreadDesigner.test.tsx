import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpreadDesigner } from './SpreadDesigner';
import { SpreadDefinition } from '../types';
import { OFFICIAL_SPREADS } from '../constants';
import { closeTopModal } from '../hooks/useModalFocus';

const spreads: SpreadDefinition[] = [
  {
    name: '自由牌阵',
    layout: 'free',
    slots: ['核心'],
    freePositions: [{ x: 120, y: 120, rotation: 0, scale: 1 }],
  },
];

const renderDesigner = (overrides = {}) => {
  const props = {
    spreads,
    currentSpread: '自由牌阵',
    layoutType: 'free',
    cardSlots: [
      { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
    ],
    designActiveSlot: 0,
    newSpreadName: '自由牌阵',
    isEditingSession: true,
    onSelectSpread: vi.fn(),
    onDeleteSpread: vi.fn(),
    onDeleteSpreads: vi.fn(),
    onSaveSpread: vi.fn(),
    onUpdateNewSpreadName: vi.fn(),
    onUpdateLayoutType: vi.fn(),
    onUpdateSlotPosition: vi.fn(),
    onSwapSlotIndex: vi.fn(),
    onUpdateSlotLabel: vi.fn(),
    onSetDesignActiveSlot: vi.fn(),
    onRestoreDefaults: vi.fn(),
    onStartNewSession: vi.fn(),
    onClose: vi.fn(),
    onUpdateSlots: vi.fn(),
    ...overrides,
  };

  const view = render(<SpreadDesigner {...props} />);
  return { ...props, update: (next: Partial<typeof props>) => view.rerender(<SpreadDesigner {...props} {...next} />) };
};

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
};

describe('SpreadDesigner', () => {
  it('guards changed layouts on browser Back and keeps editing after cancelling the confirmation', async () => {
    const user = userEvent.setup();
    const props = renderDesigner();
    expect(screen.getByRole('main', { name: '牌阵工作台' })).toBeInTheDocument();
    props.update({ cardSlots: [{ ...props.cardSlots[0], x: 240 }], newSpreadName: '新的布局' });
    act(() => { closeTopModal(); });
    expect(screen.getByRole('dialog', { name: '离开牌阵工作台' })).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '继续编辑' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('名称')).toHaveValue('新的布局');
    await user.click(screen.getByRole('button', { name: '返回（牌阵工作台）' }));
    await user.click(screen.getByRole('button', { name: '放弃修改并返回' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('returns directly when the workbench has no changes', async () => {
    const user = userEvent.setup();
    const props = renderDesigner();
    await user.click(screen.getByRole('button', { name: '返回（牌阵工作台）' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  afterEach(() => {
    setViewportWidth(1024);
    vi.restoreAllMocks();
  });

  it('keeps the main save action visible in the workbench header', () => {
    renderDesigner({ currentSpread: '', isEditingSession: true });

    expect(screen.getByRole('button', { name: '保存并使用' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '牌阵工作台' })).toBeInTheDocument();
  });

  it('starts a blank spread without selecting an existing template', async () => {
    const user = userEvent.setup();
    const onStartNewSession = vi.fn();
    const onUpdateNewSpreadName = vi.fn();
    const onSetDesignActiveSlot = vi.fn();

    renderDesigner({
      onStartNewSession,
      onUpdateNewSpreadName,
      onSetDesignActiveSlot,
    });

    await user.click(screen.getByRole('button', { name: '新建空白' }));

    expect(onUpdateNewSpreadName).toHaveBeenCalledWith('');
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(-1);
    expect(onStartNewSession).toHaveBeenCalled();
  });

  it('groups official and custom templates in the workbench selector', () => {
    renderDesigner();

    const templateSelect = screen.getByLabelText('基于已有改造');
    expect(templateSelect.querySelector('optgroup[label="官方牌阵"]')).toBeInTheDocument();
    expect(templateSelect.querySelector('optgroup[label="自定义牌阵 (1)"]')).toBeInTheDocument();
  });

  it('allows a blank new spread to start from an existing spread', async () => {
    const user = userEvent.setup();
    const onSelectSpread = vi.fn();
    const onUpdateNewSpreadName = vi.fn();
    const onSetDesignActiveSlot = vi.fn();

    renderDesigner({
      currentSpread: '',
      layoutType: 'free',
      cardSlots: [],
      designActiveSlot: -1,
      newSpreadName: '',
      onSelectSpread,
      onUpdateNewSpreadName,
      onSetDesignActiveSlot,
    });

    await user.selectOptions(screen.getByLabelText('基于已有改造'), '自由牌阵');

    expect(onSelectSpread).toHaveBeenCalledWith(spreads[0], { useAsTemplate: true });
    expect(onUpdateNewSpreadName).toHaveBeenCalledWith('自由牌阵 改造');
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(-1);
  });

  it('exposes familiar single and batch delete controls for custom spreads', async () => {
    const user = userEvent.setup();
    const onDeleteSpread = vi.fn();
    const onDeleteSpreads = vi.fn();

    renderDesigner({ onDeleteSpread, onDeleteSpreads });

    expect(screen.getByText('勾选可批量删除，右侧按钮可删除单项。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除自定义牌阵 自由牌阵' }));

    expect(onDeleteSpread).toHaveBeenCalledWith('自由牌阵');

    await user.click(screen.getByRole('button', { name: '自由牌阵' }));
    await user.click(screen.getByRole('button', { name: '删除选中 1' }));

    expect(onDeleteSpreads).toHaveBeenCalledWith(['自由牌阵']);
  });

  it('restores only the current official spread without exposing official hide or delete actions', async () => {
    const user = userEvent.setup();
    const onRestoreDefaults = vi.fn();

    renderDesigner({
      spreads: [...OFFICIAL_SPREADS, ...spreads],
      currentSpread: '单牌阵',
      newSpreadName: '单牌阵 (自定义)',
      isEditingSession: false,
      onRestoreDefaults,
    });

    await user.click(screen.getByRole('button', { name: '恢复当前' }));

    expect(onRestoreDefaults).toHaveBeenCalledWith('单牌阵');
    expect(screen.queryByRole('button', { name: /删除牌阵 单牌阵/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /隐藏官方牌阵/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /恢复全部官方/ })).not.toBeInTheDocument();
  });

  it('updates the spread name from the name field', async () => {
    const user = userEvent.setup();
    const onUpdateNewSpreadName = vi.fn();

    const ControlledDesigner = () => {
      const [name, setName] = useState('自由牌阵');

      return (
        <SpreadDesigner
          spreads={spreads}
          currentSpread="自由牌阵"
          layoutType="free"
          cardSlots={[
            { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
          ]}
          designActiveSlot={0}
          newSpreadName={name}
          isEditingSession
          onSelectSpread={vi.fn()}
          onDeleteSpread={vi.fn()}
          onSaveSpread={vi.fn()}
          onUpdateNewSpreadName={(nextName) => {
            setName(nextName);
            onUpdateNewSpreadName(nextName);
          }}
          onUpdateLayoutType={vi.fn()}
          onUpdateSlotPosition={vi.fn()}
          onSwapSlotIndex={vi.fn()}
          onUpdateSlotLabel={vi.fn()}
          onSetDesignActiveSlot={vi.fn()}
          onRestoreDefaults={vi.fn()}
          onStartNewSession={vi.fn()}
          onClose={vi.fn()}
          onUpdateSlots={vi.fn()}
        />
      );
    };

    render(<ControlledDesigner />);

    const nameInput = screen.getByLabelText('名称');
    await user.clear(nameInput);
    await user.type(nameInput, '镜像牌阵');

    expect(onUpdateNewSpreadName).toHaveBeenLastCalledWith('镜像牌阵');
  });

  it('previews a free canvas position from the canvas without starting a grid session', async () => {
    const user = userEvent.setup();
    const onStartNewSession = vi.fn();
    const onUpdateSlots = vi.fn();

    renderDesigner({ onStartNewSession, onUpdateSlots });

    await user.click(screen.getByTestId('free-layout-canvas'));

    expect(screen.getByTestId('free-layout-pending-slot')).toBeInTheDocument();
    expect(onUpdateSlots).not.toHaveBeenCalled();
    expect(onStartNewSession).not.toHaveBeenCalled();
  });

  it('opens the mobile free canvas directly without a start step', () => {
    setViewportWidth(390);

    renderDesigner();

    expect(screen.queryByTestId('spread-workbench-mobile-setup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始摆放' })).not.toBeInTheDocument();
    expect(screen.getByTestId('free-layout-canvas')).toBeInTheDocument();
  });

  it('exposes the free layout save mode choice', async () => {
    const user = userEvent.setup();
    const onUpdateFreeLayoutSaveMode = vi.fn();

    renderDesigner({
      freeLayoutSaveMode: 'original',
      onUpdateFreeLayoutSaveMode,
    });

    await user.click(screen.getByRole('button', { name: '自适应居中' }));

    expect(onUpdateFreeLayoutSaveMode).toHaveBeenCalledWith('adaptive');
  });
});
