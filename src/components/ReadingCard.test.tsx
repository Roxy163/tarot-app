import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadingCard } from './ReadingCard';
import { LAYOUT_TEMPLATES } from '../constants';
import { TarotReading } from '../types';

const celticReading: TarotReading = {
  id: 'celtic-reading',
  userId: 'user-1',
  date: '2026-07-07T00:00:00.000Z',
  question: '凯尔特十字测试',
  spread: '凯尔特十字牌阵',
  layoutType: 'celtic',
  cards: LAYOUT_TEMPLATES.celtic.defaultSlots.map((label, index) => ({
    name: index === 0 ? '女祭司' : index === 1 ? '皇帝' : '愚者',
    isReversed: false,
    label,
    position: LAYOUT_TEMPLATES.celtic.itemClasses[index],
  })),
  slotLabels: LAYOUT_TEMPLATES.celtic.defaultSlots,
  slotPositions: LAYOUT_TEMPLATES.celtic.itemClasses,
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
};

describe('ReadingCard', () => {
  it('renders saved Celtic cross readings with the challenge card as a horizontal center overlay', () => {
    render(<ReadingCard reading={celticReading} cardMetadata={[]} />);

    const challengeCard = screen.getByAltText('皇帝').closest('.rotate-90');

    expect(challengeCard).toBeInTheDocument();
    expect(screen.getByText('挑战')).toBeInTheDocument();
  });
});
