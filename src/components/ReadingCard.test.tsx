import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const yearlyReading: TarotReading = {
  id: 'yearly-reading',
  userId: 'user-1',
  date: '2026-07-07T00:00:00.000Z',
  question: '年运测试',
  spread: '年运十二宫牌阵',
  layoutType: 'yearly',
  cards: LAYOUT_TEMPLATES.yearly.defaultSlots.map((label, index) => ({
    name: index === 12 ? '女祭司' : '愚者',
    isReversed: false,
    label,
    position: LAYOUT_TEMPLATES.yearly.itemClasses[index],
  })),
  slotLabels: LAYOUT_TEMPLATES.yearly.defaultSlots,
  slotPositions: LAYOUT_TEMPLATES.yearly.itemClasses,
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
};

describe('ReadingCard', () => {
  it('previews actual thoughts and feedback without assigning a review task', () => {
    render(<ReadingCard reading={{ ...celticReading, interpretation: { singleCard: '', combination: '先放慢脚步再决定。', summary: '' }, userFeedback: '后来找到更合适的方法。' }} cardMetadata={[]} variant="list" />);
    expect(screen.getByText('先放慢脚步再决定。')).toBeInTheDocument();
    expect(screen.getByText('后来：后来找到更合适的方法。')).toBeInTheDocument();
    expect(screen.queryByText('待复盘')).not.toBeInTheDocument();
  });

  it('does not show private review excerpts on public cards', () => {
    render(<ReadingCard reading={{ ...celticReading, userFeedback: '只给自己看的经历' }} cardMetadata={[]} isPublicView variant="list" />);
    expect(screen.queryByText(/只给自己看的经历/)).not.toBeInTheDocument();
  });

  it('previews the current single-card thought instead of an older overall note', () => {
    render(<ReadingCard reading={{ ...celticReading, spread: '单牌阵', cards: [celticReading.cards[0]], cardInterpretations: ['刚修改的单牌想法'], interpretation: { singleCard: '刚修改的单牌想法', combination: '保留的旧组合笔记', summary: '保留的旧总结' } }} cardMetadata={[]} variant="list" />);
    expect(screen.getByText('刚修改的单牌想法')).toBeInTheDocument();
    expect(screen.queryByText('保留的旧组合笔记')).not.toBeInTheDocument();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  it('renders saved Celtic cross readings with the challenge card as a horizontal center overlay', () => {
    const { container } = render(<ReadingCard reading={celticReading} cardMetadata={[]} />);

    const challengeCard = screen.getByAltText('皇帝').closest('.rotate-90');

    expect(screen.getByTestId('reading-card-celtic-preview')).toBeInTheDocument();
    expect(screen.getByTestId('reading-card-celtic-center')).toHaveStyle({
      transform: 'translate(-50%, -50%) scale(0.96)',
    });
    expect(container.querySelectorAll('[aria-hidden="true"].border-dashed')).toHaveLength(0);
    expect(challengeCard).toBeInTheDocument();
    expect(screen.getByText('挑战')).toBeInTheDocument();
  });

  it('renders saved yearly readings in a centered radial preview', () => {
    const { container } = render(<ReadingCard reading={yearlyReading} cardMetadata={[]} />);

    const yearlyPreview = screen.getByTestId('reading-card-yearly-preview');

    expect(yearlyPreview).toBeInTheDocument();
    expect(yearlyPreview.children[0]).toHaveStyle({
      transform: 'translate(-50%, -50%) scale(0.95)',
    });
    expect(Array.from(yearlyPreview.children).every(child => child.classList.contains('absolute'))).toBe(true);
    expect(yearlyPreview.querySelector('[data-testid*="line"]')).not.toBeInTheDocument();
    expect(yearlyPreview.querySelector('[data-testid*="guide"]')).not.toBeInTheDocument();
    expect(yearlyPreview.querySelector('[data-testid*="axis"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"].border-dashed')).toHaveLength(0);
    expect(screen.getByText('底牌')).toBeInTheDocument();
  });

  it('shows the author bio on public non-anonymous readings', () => {
    render(
      <ReadingCard
        reading={{
          ...celticReading,
          isPublic: true,
          authorBio: '在森林里记录牌的回声',
        }}
        cardMetadata={[]}
        isPublicView
      />,
    );

    expect(screen.getByText('Roxy')).toBeInTheDocument();
    expect(screen.getByText('在森林里记录牌的回声')).toBeInTheDocument();
  });

  it('keeps the author bio hidden on anonymous public readings', () => {
    render(
      <ReadingCard
        reading={{
          ...celticReading,
          isPublic: true,
          isAnonymous: true,
          authorBio: '在森林里记录牌的回声',
        }}
        cardMetadata={[]}
        isPublicView
      />,
    );

    expect(screen.queryByText('在森林里记录牌的回声')).not.toBeInTheDocument();
  });

  it('reveals a delete action after swiping a saved reading left on mobile', async () => {
    const onDelete = vi.fn();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <ReadingCard
        reading={celticReading}
        cardMetadata={[]}
        onDelete={onDelete}
        variant="list"
      />,
    );

    const summaryButton = screen.getByRole('button', { name: '查看手记：凯尔特十字测试' });
    fireEvent.pointerDown(summaryButton, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 240, clientY: 24 });
    fireEvent.pointerMove(summaryButton, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 26 });
    fireEvent.pointerUp(summaryButton, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 26 });

    fireEvent.click(await screen.findByRole('button', { name: '删除手记：凯尔特十字测试' }));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});
