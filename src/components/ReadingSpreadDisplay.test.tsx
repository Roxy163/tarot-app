import { render, screen } from '@testing-library/react';
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
    const lowerButton = screen.getByRole('button', { name: /基础/ });
    const centerCell = centerButton.closest('.col-start-2.row-start-2');
    const lowerCell = lowerButton.closest('.col-start-2.row-start-3');

    expect(centerCell).toHaveStyle({ zIndex: '40' });
    expect(lowerCell).toHaveStyle({ zIndex: '15' });
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
    expect(screen.getByRole('button', { name: /底牌/ })).toBeInTheDocument();
  });
});
