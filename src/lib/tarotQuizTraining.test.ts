import { describe, expect, it } from 'vitest';
import type { CardAnnotation, QuizMemoryEntry } from '../types';
import {
  buildQuizTrainingCards,
  createQuizQuestion,
  createReverseQuizQuestion,
  DEFAULT_QUIZ_FILTERS,
  filterQuizTrainingCards,
  formatQuizDisplayValue,
  getQuizCardWeight,
  mergeKeywordInput,
  updateQuizMemory,
} from './tarotQuizTraining';

const makeAnnotation = (cardId: string, annotation: Partial<CardAnnotation>): CardAnnotation => ({
  cardId,
  userId: 'user',
  numerology: null,
  planet: null,
  zodiac: null,
  house: null,
  element: null,
  uprightMeaning: '',
  reversedMeaning: '',
  keywords: [],
  personalNotes: '',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  ...annotation,
});

describe('tarotQuizTraining', () => {
  it('filters by arcana, court cards, element, planet, zodiac and suit', () => {
    const cards = buildQuizTrainingCards();

    expect(filterQuizTrainingCards(cards, { ...DEFAULT_QUIZ_FILTERS, groups: ['major'] })).toHaveLength(22);
    expect(filterQuizTrainingCards(cards, { ...DEFAULT_QUIZ_FILTERS, groups: ['court'] })).toHaveLength(16);
    expect(filterQuizTrainingCards(cards, { ...DEFAULT_QUIZ_FILTERS, suits: ['wands'] }).every(card => card.suit === 'wands')).toBe(true);
    expect(filterQuizTrainingCards(cards, { ...DEFAULT_QUIZ_FILTERS, elements: ['火'] }).every(card => card.element === '火')).toBe(true);
    expect(filterQuizTrainingCards(cards, { ...DEFAULT_QUIZ_FILTERS, planets: ['金星'] }).every(card => card.planet === '金星')).toBe(true);
    expect(filterQuizTrainingCards(cards, { ...DEFAULT_QUIZ_FILTERS, zodiacs: ['白羊座'] }).every(card => card.zodiac === '白羊座')).toBe(true);
  });

  it('uses user annotations before official meanings in answer data', () => {
    const cards = buildQuizTrainingCards([], [
      makeAnnotation('ar00', {
        keywords: ['自由落点'],
        uprightMeaning: '用户自己的愚者正位。',
        reversedMeaning: '用户自己的愚者逆位。',
        personalNotes: '我的愚者注疏。',
      }),
    ]);

    const fool = cards.find(card => card.id === 'ar00');

    expect(fool?.keywords).toEqual(['自由落点']);
    expect(fool?.uprightMeaning).toBe('用户自己的愚者正位。');
    expect(fool?.reversedMeaning).toBe('用户自己的愚者逆位。');
    expect(fool?.personalNotes).toBe('我的愚者注疏。');
  });

  it('does not create ambiguous keyword multiple-choice questions in the lightweight quiz', () => {
    const cards = buildQuizTrainingCards();
    const question = createQuizQuestion(cards, [], () => 0);

    expect(question?.kind).not.toBe('keyword');
    expect(question?.options.length).toBeGreaterThanOrEqual(3);
    expect(question?.options.map(option => option.id)).toContain(question?.correctOptionId);
  });

  it('creates a correspondence multiple-choice question for card systems', () => {
    const cards = buildQuizTrainingCards();
    const question = createQuizQuestion(cards, [], () => 0.99);

    expect(question?.kind).toBe('correspondence');
    expect(question?.prompt).toContain('对应哪个');
    expect(question?.options.map(option => option.id)).toContain(question?.correctOptionId);
  });

  it('can place the correct answer in a requested slot and formats houses with Arabic numerals', () => {
    const cards = buildQuizTrainingCards();
    const question = createQuizQuestion(cards, [], () => 0.99, {
      kinds: ['correspondence'],
      correctOptionIndex: 2,
    });

    expect(question?.options[2].id).toBe(question?.correctOptionId);
    expect(formatQuizDisplayValue('第零宫')).toBe('第0宫');
    expect(formatQuizDisplayValue('第十二宫')).toBe('第12宫');
  });

  it('can limit the home quiz to visual correspondence questions', () => {
    const cards = buildQuizTrainingCards();
    const question = createQuizQuestion(cards, [], () => 0, { kinds: ['correspondence'] });

    expect(question?.kind).toBe('correspondence');
    expect(question?.prompt).toContain('对应哪个');
  });

  it('creates a meaning-to-card question and keeps the answer in the options', () => {
    const cards = buildQuizTrainingCards();
    const question = createQuizQuestion(cards, [], () => 0, { kinds: ['meaning-card'] });

    expect(question?.kind).toBe('meaning-card');
    expect(question?.prompt).toBe('这段含义，更接近哪张牌？');
    expect(question?.options.map(option => option.id)).toContain(question?.correctOptionId);
    expect(question?.options.every(option => Boolean(option.cardId))).toBe(true);
  });

  it('merges user keyword input without duplicating existing card keywords', () => {
    expect(mergeKeywordInput(['冒险', '自由'], '自由、起点, 信任 信任')).toEqual([
      '冒险',
      '自由',
      '起点',
      '信任',
    ]);
  });

  it('adds unfamiliar cards to repeat memory and raises their weight', () => {
    const cards = buildQuizTrainingCards();
    const fool = cards.find(card => card.id === 'ar00')!;
    const baseWeight = getQuizCardWeight(fool, []);

    const memory = updateQuizMemory([], fool, 'unfamiliar', '2026-07-18T08:00:00.000Z');
    const entry = memory[0];

    expect(entry.repeated).toBe(true);
    expect(entry.practiceCount).toBe(1);
    expect(entry.unfamiliarCount).toBe(1);
    expect(getQuizCardWeight(fool, memory)).toBeGreaterThan(baseWeight);
  });

  it('stores recent quiz attempts for the archive', () => {
    const cards = buildQuizTrainingCards();
    const fool = cards.find(card => card.id === 'ar00')!;
    const memory = updateQuizMemory([], fool, 'wrong', '2026-07-18T08:00:00.000Z', {
      modeLabel: '看牌对应',
      prompt: '这张牌对应哪个元素？',
      answerLabel: '风',
      selectedLabel: '水',
      correct: false,
    });

    expect(memory[0].attempts?.[0]).toMatchObject({
      modeLabel: '看牌对应',
      prompt: '这张牌对应哪个元素？',
      answerLabel: '风',
      selectedLabel: '水',
      correct: false,
      createdAt: '2026-07-18T08:00:00.000Z',
    });
  });

  it('supports explicit repeat memory filters and clearing remembered cards', () => {
    const cards = buildQuizTrainingCards();
    const fool = cards.find(card => card.id === 'ar00')!;
    const magician = cards.find(card => card.id === 'ar01')!;
    const repeatedMemory = updateQuizMemory([], fool, 'add-repeat', '2026-07-18T08:00:00.000Z');

    expect(filterQuizTrainingCards([fool, magician], { ...DEFAULT_QUIZ_FILTERS, repeatOnly: true }, repeatedMemory)).toEqual([fool]);

    const clearedMemory = updateQuizMemory(repeatedMemory, fool, 'clear-repeat', '2026-07-18T09:00:00.000Z');
    expect(filterQuizTrainingCards([fool, magician], { ...DEFAULT_QUIZ_FILTERS, repeatOnly: true }, clearedMemory)).toEqual([]);
  });

  it('builds reverse questions for selected correspondence targets', () => {
    const cards = buildQuizTrainingCards();
    const question = createReverseQuizQuestion(
      cards,
      { ...DEFAULT_QUIZ_FILTERS, planets: ['金星'] },
      [] as QuizMemoryEntry[],
      () => 0,
    );

    expect(question?.target).toBe('金星');
    expect(question?.targetType).toBe('planet');
    expect(question?.matchingCardIds.length).toBeGreaterThan(0);
    expect(question?.optionCardIds).toContain(question?.correctCardId);
  });
});
