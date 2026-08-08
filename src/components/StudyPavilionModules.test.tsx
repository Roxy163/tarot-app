import { useState } from 'react';
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizMemoryEntry } from '../types';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { StudyPavilionModules } from './StudyPavilionModules';

vi.mock('./TarotCardImage', () => ({
  TarotCardImage: ({ alt, className }: { alt: string; className?: string }) => (
    <img alt={alt} className={className} />
  ),
}));

const Harness = ({
  onOpenCardLibrary = vi.fn(),
  initialQuizMemory = [],
}: {
  onOpenCardLibrary?: (cardId?: string) => void;
  initialQuizMemory?: QuizMemoryEntry[];
}) => {
  const [quizMemory, setQuizMemory] = useState<QuizMemoryEntry[]>(initialQuizMemory);

  return (
    <StudyPavilionModules
      readings={[]}
      cardMetadata={[]}
      quizMemory={quizMemory}
      onUpdateQuizMemory={setQuizMemory}
      onOpenCardLibrary={onOpenCardLibrary}
    />
  );
};

describe('StudyPavilionModules', () => {
  beforeEach(() => {
    localStorage.clear();
    cardAnnotationService.clearAllUserData();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a direct lightweight quiz on the home card and rewards the right answer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const quizCard = screen.getByTestId('card-quiz-card');
    expect(within(quizCard).getByText('牌义小考')).toBeInTheDocument();
    expect(within(quizCard).getByText('看牌面，记对应')).toBeInTheDocument();
    expect(within(quizCard).getByText('这张牌对应哪个元素？')).toBeInTheDocument();
    expect(within(quizCard).getByAltText('愚者')).toBeInTheDocument();
    expect(within(quizCard).queryByText('这段含义，更接近哪张牌？')).not.toBeInTheDocument();
    expect(within(quizCard).queryByText(/哪个关键词更贴近/)).not.toBeInTheDocument();
    expect(within(quizCard).queryByRole('button', { name: /给这张牌补关键词/ })).not.toBeInTheDocument();
    expect(within(quizCard).queryByRole('button', { name: /去牌义注疏/ })).not.toBeInTheDocument();
    expect(within(quizCard).queryByRole('button', { name: /我记住了/ })).not.toBeInTheDocument();

    await user.click(within(quizCard).getByTestId('quiz-option-answer-风'));

    expect(await within(quizCard).findByText('答对了')).toBeInTheDocument();
    expect(within(quizCard).getByText('答案：风')).toBeInTheDocument();
    expect(within(quizCard).getByText('元素')).toBeInTheDocument();
    expect(within(quizCard).getByText('天王星')).toBeInTheDocument();
    expect(within(quizCard).getByRole('button', { name: /给这张牌补关键词/ })).toBeInTheDocument();
    expect(within(quizCard).getByRole('button', { name: /去牌义注疏/ })).toBeInTheDocument();
    expect(within(quizCard).getByRole('button', { name: /我记住了/ })).toBeInTheDocument();
    expect(within(quizCard).queryByText(/也可联想到/)).not.toBeInTheDocument();
  });

  it('keeps the quiz archive tucked away and adds wrong answers to review', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const quizCard = screen.getByTestId('card-quiz-card');
    expect(within(quizCard).getByRole('button', { name: /看牌对应/ })).toBeInTheDocument();
    expect(within(quizCard).getByRole('button', { name: /文字找牌/ })).toBeInTheDocument();
    expect(within(quizCard).queryByText('专项设置')).not.toBeInTheDocument();

    await user.click(within(quizCard).getByTestId('quiz-option-answer-水'));
    expect(await within(quizCard).findByText(/答案：风/)).toBeInTheDocument();
    expect(within(quizCard).getByText(/放入待温习/)).toBeInTheDocument();
    expect(within(quizCard).queryByText(/你刚刚选了/)).not.toBeInTheDocument();

    await user.click(within(quizCard).getByRole('button', { name: /档案/ }));
    const archiveDialog = screen.getByRole('dialog', { name: /小考档案/ });
    expect(within(archiveDialog).getByText('本次作答')).toBeInTheDocument();
    expect(within(archiveDialog).getByText(/选了 水/)).toBeInTheDocument();
    expect(within(archiveDialog).getByText('累计')).toBeInTheDocument();
    expect(within(archiveDialog).getByText('正确率')).toBeInTheDocument();
    expect(within(archiveDialog).getByRole('button', { name: /去温习/ })).toBeInTheDocument();
    expect(within(archiveDialog).getByRole('button', { name: /专项设置/ })).toBeInTheDocument();
    expect(within(archiveDialog).getByText('薄弱牌')).toBeInTheDocument();
    expect(within(archiveDialog).getAllByText('待温习').length).toBeGreaterThan(0);
    expect(within(quizCard).getByText('这张牌对应哪个元素？')).toBeInTheDocument();
    expect(within(quizCard).getByText(/答案：风/)).toBeInTheDocument();
    expect(within(quizCard).getByRole('button', { name: /换一题|下一题/ })).toBeInTheDocument();

    await user.click(within(archiveDialog).getByRole('button', { name: /关闭小考档案/ }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: /小考档案/ }));
  });

  it('shows persisted quiz history in the archive', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialQuizMemory={[{
          cardId: 'ar00',
          cardName: '愚者',
          practiceCount: 2,
          unfamiliarCount: 0,
          wrongCount: 1,
          repeated: true,
          lastPracticedAt: '2026-07-18T08:30:00.000Z',
          createdAt: '2026-07-18T08:00:00.000Z',
          updatedAt: '2026-07-18T08:30:00.000Z',
          attempts: [{
            id: 'attempt-1',
            modeLabel: '看牌对应',
            prompt: '这张牌对应哪个元素？',
            answerLabel: '风',
            selectedLabel: '水',
            correct: false,
            createdAt: '2026-07-18T08:30:00.000Z',
          }],
        }]}
      />,
    );

    const quizCard = screen.getByTestId('card-quiz-card');
    await user.click(within(quizCard).getByRole('button', { name: /档案/ }));

    const archiveDialog = screen.getByRole('dialog', { name: /小考档案/ });
    expect(within(archiveDialog).getByText('作答履历')).toBeInTheDocument();
    expect(within(archiveDialog).getByText(/选了 水/)).toBeInTheDocument();
    expect(within(archiveDialog).getByText('薄弱牌')).toBeInTheDocument();
    expect(within(archiveDialog).getAllByText('愚者').length).toBeGreaterThan(0);
  });

  it('switches text-to-card questions from the lightweight mode switch', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const quizCard = screen.getByTestId('card-quiz-card');
    expect(within(quizCard).queryByText('这段含义，更接近哪张牌？')).not.toBeInTheDocument();

    await user.click(within(quizCard).getByRole('button', { name: /文字找牌/ }));

    expect(await within(quizCard).findByText('读含义，找牌面')).toBeInTheDocument();
    expect(within(quizCard).getByText('这段含义，更接近哪张牌？')).toBeInTheDocument();
    expect(within(quizCard).getByAltText('愚者')).toBeInTheDocument();
  });

  it('saves extra keywords into card annotations and can open the current card library', async () => {
    const user = userEvent.setup();
    const onOpenCardLibrary = vi.fn();
    render(<Harness onOpenCardLibrary={onOpenCardLibrary} />);

    const quizCard = screen.getByTestId('card-quiz-card');
    await user.click(within(quizCard).getByTestId('quiz-option-answer-风'));
    await user.click(await within(quizCard).findByRole('button', { name: /给这张牌补关键词/ }));
    await user.type(within(quizCard).getByPlaceholderText('例：自由、起点、信任'), '自由、起点');
    await user.click(within(quizCard).getByRole('button', { name: '保存' }));

    expect(within(quizCard).getByText('已存入牌义注疏。')).toBeInTheDocument();
    expect(cardAnnotationService.getMergedAnnotation('ar00').keywords).toContain('起点');

    await user.click(within(quizCard).getByRole('button', { name: /去牌义注疏/ }));
    expect(onOpenCardLibrary).toHaveBeenCalledWith('ar00');
  });
});
