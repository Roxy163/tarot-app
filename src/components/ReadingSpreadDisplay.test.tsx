import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
        toggleReverse={vi.fn()}
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
});
