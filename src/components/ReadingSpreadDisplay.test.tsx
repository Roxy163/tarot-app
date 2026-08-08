import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadingSpreadDisplay } from './ReadingSpreadDisplay';
import { LAYOUT_TEMPLATES } from '../constants';
import { ReadingSlotData } from '../types';

const createSlots = (): ReadingSlotData[] => (
  LAYOUT_TEMPLATES.celtic.defaultSlots.map((label, index) => ({
    name: '',
    isReversed: false,
    label,
    position: LAYOUT_TEMPLATES.celtic.itemClasses[index],
  }))
);

describe('ReadingSpreadDisplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the Celtic cross center stack above the lower card on mobile-scaled layouts', () => {
    const slots = createSlots();

    render(
      <ReadingSpreadDisplay
        formData={{ layoutType: 'celtic', spread: '凯尔特十字牌阵' }}
        cardSlots={slots}
        activeSlotIndex={-1}
        showSlotNumbers
        gridCols={5}
        itemClasses={LAYOUT_TEMPLATES.celtic.itemClasses}
        currentTemplate={LAYOUT_TEMPLATES.celtic}
        showUpdatePrompt={null}
        spreads={[]}
        onSlotClick={vi.fn()}
        handleLongPressStart={vi.fn()}
        handleLongPressEnd={vi.fn()}
        removeSlot={vi.fn()}
        handleCycleSlot={vi.fn()}
        onConfirmSync={vi.fn()}
        onCancelSync={vi.fn()}
      />,
    );

    const centerButton = screen.getByRole('button', { name: /现状/ });
    const challengeButton = screen.getByRole('button', { name: /挑战/ });
    const centerCell = screen.getByTestId('celtic-center-stack');
    const lowerCell = screen.getByTestId('celtic-foundation-slot');

    expect(screen.getByTestId('celtic-cross-spread')).toBeInTheDocument();
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 0/10');
    expect(centerCell).toHaveStyle({ zIndex: '40' });
    expect(lowerCell).toHaveStyle({ zIndex: '15' });
    expect(centerCell).toContainElement(centerButton);
    expect(centerCell).toContainElement(challengeButton);
  });

  it('uses a dedicated centered yearly layout across viewport widths', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 360,
      height: 480,
      top: 0,
      right: 360,
      bottom: 480,
      left: 0,
      toJSON: () => ({}),
    });
    const yearlySlots = LAYOUT_TEMPLATES.yearly.defaultSlots.map((label, index) => ({
      name: '',
      isReversed: false,
      label,
      position: LAYOUT_TEMPLATES.yearly.itemClasses[index],
    }));

    render(
      <ReadingSpreadDisplay
        formData={{ layoutType: 'yearly', spread: '年运十二宫牌阵' }}
        cardSlots={yearlySlots}
        activeSlotIndex={-1}
        showSlotNumbers
        gridCols={13}
        itemClasses={LAYOUT_TEMPLATES.yearly.itemClasses}
        currentTemplate={LAYOUT_TEMPLATES.yearly}
        showUpdatePrompt={null}
        spreads={[]}
        onSlotClick={vi.fn()}
        handleLongPressStart={vi.fn()}
        handleLongPressEnd={vi.fn()}
        removeSlot={vi.fn()}
        handleCycleSlot={vi.fn()}
        onConfirmSync={vi.fn()}
        onCancelSync={vi.fn()}
      />,
    );

    expect(screen.getByTestId('yearly-radial-spread')).toBeInTheDocument();
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 0/13');
    expect(screen.getByRole('button', { name: /底牌/ })).toBeInTheDocument();
  });

  it('uses the natural card-grid layout for the choice spread', () => {
    const choiceSlots = LAYOUT_TEMPLATES.choice.defaultSlots.map((label, index) => ({
      name: '',
      isReversed: false,
      label,
      position: LAYOUT_TEMPLATES.choice.itemClasses[index],
    }));

    render(
      <ReadingSpreadDisplay
        formData={{ layoutType: 'choice', spread: '选择牌阵' }}
        cardSlots={choiceSlots}
        activeSlotIndex={-1}
        showSlotNumbers
        gridCols={3}
        itemClasses={LAYOUT_TEMPLATES.choice.itemClasses}
        currentTemplate={LAYOUT_TEMPLATES.choice}
        showUpdatePrompt={null}
        spreads={[]}
        onSlotClick={vi.fn()}
        handleLongPressStart={vi.fn()}
        handleLongPressEnd={vi.fn()}
        removeSlot={vi.fn()}
        handleCycleSlot={vi.fn()}
        onConfirmSync={vi.fn()}
        onCancelSync={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('choice-spread')).not.toBeInTheDocument();
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 0/5');
    expect(screen.getByRole('button', { name: /A近期发展/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /B近期发展/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A远期结果/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /B远期结果/ })).toBeInTheDocument();
  });

  it('toggles a selected card orientation from the slot badge', async () => {
    const user = userEvent.setup();
    const onToggleSlotReverse = vi.fn();

    render(
      <ReadingSpreadDisplay
        formData={{ layoutType: 'horizontal', spread: '单牌阵' }}
        cardSlots={[{ name: '愚者', isReversed: false, label: '主牌' }]}
        activeSlotIndex={0}
        showSlotNumbers
        gridCols={5}
        itemClasses={LAYOUT_TEMPLATES.horizontal.itemClasses}
        currentTemplate={LAYOUT_TEMPLATES.horizontal}
        showUpdatePrompt={null}
        spreads={[]}
        onSlotClick={vi.fn()}
        handleLongPressStart={vi.fn()}
        handleLongPressEnd={vi.fn()}
        removeSlot={vi.fn()}
        handleCycleSlot={vi.fn()}
        onConfirmSync={vi.fn()}
        onCancelSync={vi.fn()}
        onToggleSlotReverse={onToggleSlotReverse}
      />,
    );

    await user.click(screen.getByRole('button', { name: '切换第 1 张为逆位' }));

    expect(onToggleSlotReverse).toHaveBeenCalledWith(0, expect.any(Object));
  });

  it('fits free-layout spreads inside a mobile-width preview instead of clipping them', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 360,
      height: 480,
      top: 0,
      right: 360,
      bottom: 480,
      left: 0,
      toJSON: () => ({}),
    });
    const freeSlots: ReadingSlotData[] = [
      { name: '', isReversed: false, label: '起点', x: 0, y: 0, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '远处', x: 560, y: 260, rotation: 0, scale: 1 },
    ];

    render(
      <ReadingSpreadDisplay
        formData={{ layoutType: 'free', spread: '自由牌阵' }}
        cardSlots={freeSlots}
        activeSlotIndex={-1}
        showSlotNumbers
        gridCols={20}
        itemClasses={[]}
        currentTemplate={LAYOUT_TEMPLATES.custom}
        showUpdatePrompt={null}
        spreads={[]}
        onSlotClick={vi.fn()}
        handleLongPressStart={vi.fn()}
        handleLongPressEnd={vi.fn()}
        removeSlot={vi.fn()}
        handleCycleSlot={vi.fn()}
        onConfirmSync={vi.fn()}
        onCancelSync={vi.fn()}
      />,
    );

    await waitFor(() => {
      const preview = screen.getByTestId('free-layout-spread-preview');
      expect(parseFloat(preview.style.width)).toBeLessThanOrEqual(360);
    });
  });
});
