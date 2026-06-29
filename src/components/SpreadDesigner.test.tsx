import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('SpreadDesigner', () => {
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
