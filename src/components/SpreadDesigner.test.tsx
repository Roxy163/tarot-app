import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpreadDesigner } from './SpreadDesigner';
import { SpreadDefinition } from '../types';

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
    onSaveSpread: vi.fn(),
    onUpdateNewSpreadName: vi.fn(),
    onUpdateLayoutType: vi.fn(),
    onUpdateSlotPosition: vi.fn(),
    onSwapSlotIndex: vi.fn(),
    onUpdateSlotLabel: vi.fn(),
    onSetDesignActiveSlot: vi.fn(),
    onRemoveSlot: vi.fn(),
    onRestoreDefaults: vi.fn(),
    onStartNewSession: vi.fn(),
    onClose: vi.fn(),
    onUpdateSlots: vi.fn(),
    ...overrides,
  };

  render(<SpreadDesigner {...props} />);
  return props;
};

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
};

describe('SpreadDesigner', () => {
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

    expect(onSelectSpread).toHaveBeenCalledWith(spreads[0]);
    expect(onUpdateNewSpreadName).toHaveBeenCalledWith('自由牌阵 改造');
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(-1);
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
          onRemoveSlot={vi.fn()}
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
