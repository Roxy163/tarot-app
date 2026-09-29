import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadingSpreadDisplay } from './ReadingSpreadDisplay';
import { LAYOUT_TEMPLATES } from '../constants';
import { ReadingSlotData } from '../types';
import { getTabletopLayout } from '../lib/tabletopLayout';
import { ReadingSlot } from './ReadingSlot';

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

  it('uses one unobtrusive control to switch either card of a compact Celtic center', async () => {
    const user = userEvent.setup();
    const onCycle = vi.fn();
    const stack = (active: number) => <>{createSlots().slice(0, 2).map((slot, index) => (
      <ReadingSlot key={index} slot={slot} index={index} stackIndex={index}
        isActive={active === index} isCelticCenter cardWidth={32} showSlotNumbers
        onSlotClick={vi.fn()} onLongPressStart={vi.fn()} onLongPressEnd={vi.fn()}
        onRemove={vi.fn()} allowRemove={false} onCycle={onCycle} />
    ))}</>;
    const { rerender } = render(stack(0));
    expect(screen.getAllByRole('button', { name: '切换交叉牌层级' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '切换交叉牌层级' }));
    expect(onCycle).toHaveBeenLastCalledWith(0, expect.any(Object));
    rerender(stack(1));
    await user.click(screen.getByRole('button', { name: '切换交叉牌层级' }));
    expect(onCycle).toHaveBeenLastCalledWith(1, expect.any(Object));
  });

  it('keeps the Celtic center selectable without shrinking the card controls', async () => {
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
    const canvas = screen.getByTestId('celtic-spread-canvas');

    expect(screen.getByTestId('celtic-cross-spread')).toBeInTheDocument();
    expect(canvas).toHaveClass('overflow-visible');
    expect(canvas).not.toHaveClass('rounded-3xl', 'border', 'bg-forest-bg/20');
    expect(canvas.children).toHaveLength(9);
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 0/10');
    expect(centerCell).toHaveStyle({ zIndex: '40' });
    expect(lowerCell).toHaveStyle({ zIndex: '15' });
    expect(centerCell).toContainElement(centerButton);
    expect(centerCell).toContainElement(challengeButton);
    await waitFor(() => {
      expect(centerButton).toHaveStyle({ width: `${Math.max(44, getTabletopLayout('celtic', 376, window.innerHeight).cardWidth)}px` });
    });
    expect(centerCell).toHaveStyle({ transform: 'translate(-50%, -50%)' });
    expect(parseFloat(centerButton.style.width)).toBeGreaterThanOrEqual(44);
  });

  it('uses a dedicated centered yearly layout across viewport widths', async () => {
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
    const yearlyCanvas = screen.getByTestId('yearly-spread-canvas');
    expect(yearlyCanvas).toHaveClass('overflow-visible');
    expect(yearlyCanvas).not.toHaveClass('rounded-3xl', 'border', 'bg-forest-bg/20');
    expect(yearlyCanvas.children).toHaveLength(13);
    expect(Array.from(yearlyCanvas.children).every(child => child.classList.contains('absolute'))).toBe(true);
    expect(yearlyCanvas.querySelector('[data-testid*="line"]')).not.toBeInTheDocument();
    expect(yearlyCanvas.querySelector('[data-testid*="guide"]')).not.toBeInTheDocument();
    expect(yearlyCanvas.querySelector('[data-testid*="axis"]')).not.toBeInTheDocument();
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 0/13');
    expect(screen.getByRole('button', { name: /底牌/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /底牌/ })).toHaveStyle({ width: '44px' });
    });
    expect(yearlyCanvas.children[0]).toHaveStyle({ transform: 'translate(-50%, -50%)' });
  });

  it('fits the official choice silhouette on a bounded canvas without empty grid rows', () => {
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
    expect(screen.getByTestId('official-spread-canvas').children).toHaveLength(5);
    expect(parseFloat(screen.getByTestId('official-spread-canvas').style.height)).toBeLessThanOrEqual(380);
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
