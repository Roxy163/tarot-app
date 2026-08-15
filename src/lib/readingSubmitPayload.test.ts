import { describe, expect, it } from 'vitest';
import { ReadingSlotData } from '../types';
import {
  INCOMPLETE_CARDS_NOTICE,
  REQUIRED_CARD_INTERPRETATION_NOTICE,
  REQUIRED_CLIENT_NAME_NOTICE,
  REQUIRED_QUESTION_NOTICE,
  ReadingFormState,
  buildReadingSubmitPayload
} from './readingSubmitPayload';

const baseFormData: ReadingFormState = {
  question: '我该如何推进？',
  spread: '时间流牌阵',
  layoutType: 'horizontal',
  cardInput: '',
  singleCard: '单牌原文',
  combination: '组合原文',
  numerologyInfluence: '数字视角',
  astrologyInfluence: '星象视角',
  houseInfluence: '宫位视角',
  elementInfluence: '元素视角',
  isAnonymous: false,
  isPublic: false,
  isForClient: false,
  clientName: '',
  clientFeedback: '',
  userFeedback: '复盘',
  choicePathA: '',
  choicePathB: '',
  readingDate: '2026-06-24T10:30',
  isTimePrecise: false,
  category: '事业',
  skipAi: true,
};

const slots: ReadingSlotData[] = [
  { name: '愚者', isReversed: false, label: '过去', position: 'p1' },
  { name: '', isReversed: false, label: '现在', position: 'p2' },
  { name: '魔术师', isReversed: true, label: '未来', position: 'p3', isRotated: true },
];
const completeSlots: ReadingSlotData[] = [
  { name: '愚者', isReversed: false, label: '过去', position: 'p1' },
  { name: '女祭司', isReversed: false, label: '现在', position: 'p2' },
  { name: '魔术师', isReversed: true, label: '未来', position: 'p3', isRotated: true },
];

describe('buildReadingSubmitPayload', () => {
  it('requires every card position to be selected', () => {
    expect(buildReadingSubmitPayload({
      formData: baseFormData,
      cardSlots: [{ name: '', isReversed: false, label: '空位' }],
      cardInterpretations: [''],
    })).toEqual({ ok: false, notice: INCOMPLETE_CARDS_NOTICE });
  });

  it('requires the reading question before saving', () => {
    expect(buildReadingSubmitPayload({
      formData: { ...baseFormData, question: '   ' },
      cardSlots: [completeSlots[0]],
      cardInterpretations: ['过去解读'],
    })).toEqual({ ok: false, notice: REQUIRED_QUESTION_NOTICE });
  });

  it('requires client name in client mode', () => {
    expect(buildReadingSubmitPayload({
      formData: { ...baseFormData, isForClient: true, clientName: '' },
      cardSlots: [completeSlots[0]],
      cardInterpretations: ['过去解读'],
    })).toEqual({ ok: false, notice: REQUIRED_CLIENT_NAME_NOTICE });
  });

  it('requires every submitted card to have a card interpretation', () => {
    expect(buildReadingSubmitPayload({
      formData: baseFormData,
      cardSlots: completeSlots,
      cardInterpretations: ['过去解读', '', '未来解读'],
    })).toEqual({ ok: false, notice: REQUIRED_CARD_INTERPRETATION_NOTICE });
  });

  it('keeps labels, positions, rotations and interpretations aligned when all required fields are filled', () => {
    const result = buildReadingSubmitPayload({
      formData: baseFormData,
      cardSlots: completeSlots,
      cardInterpretations: ['过去解读', '现在解读', '未来解读'],
      cardQuestions: ['过去疑问', '', '未来疑问'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.cards).toEqual(completeSlots);
    expect(result.payload.slotLabels).toEqual(['过去', '现在', '未来']);
    expect(result.payload.slotPositions).toEqual(['p1', 'p2', 'p3']);
    expect(result.payload.rotatedSlots).toEqual([2]);
    expect(result.payload.cardInterpretations).toEqual(['过去解读', '现在解读', '未来解读']);
    expect(result.payload.cardQuestions).toEqual(['过去疑问', '', '未来疑问']);
    expect(result.payload.interpretation?.combination).toBe('组合原文');
  });

  it('keeps free layout coordinates on submitted cards', () => {
    const freeSlots: ReadingSlotData[] = [
      { name: '愚者', isReversed: false, label: '核心', x: 120, y: 80, rotation: 15, scale: 1.2 },
      { name: '女祭司', isReversed: false, label: '空位', x: 240, y: 80, rotation: 0, scale: 1 },
      { name: '魔术师', isReversed: true, label: '建议', x: 300, y: 200, rotation: -20, scale: 0.9 },
    ];
    const result = buildReadingSubmitPayload({
      formData: { ...baseFormData, layoutType: 'free', spread: '自由牌阵' },
      cardSlots: freeSlots,
      cardInterpretations: ['核心解读', '空位解读', '建议解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.cards).toEqual(freeSlots);
    expect(result.payload.slotLabels).toEqual(['核心', '空位', '建议']);
    expect(result.payload.slotPositions).toEqual(['', '', '']);
  });

  it('uses the first submitted interpretation as single-card text for daily readings', () => {
    const result = buildReadingSubmitPayload({
      formData: { ...baseFormData, category: '日运', spread: '时间流牌阵' },
      cardSlots: completeSlots,
      cardInterpretations: ['今日解读', '现在解读', '第二张解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.interpretation?.singleCard).toBe('今日解读');
    expect(result.payload.interpretation?.combination).toBe('');
  });

  it('keeps single-card spread as a single-card reading even when only fallback text exists', () => {
    const result = buildReadingSubmitPayload({
      formData: { ...baseFormData, spread: '单牌阵' },
      cardSlots: [{ name: '愚者', isReversed: false, label: '主牌' }],
      cardInterpretations: [''],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.interpretation?.singleCard).toBe('单牌原文');
    expect(result.payload.interpretation?.combination).toBe('');
  });

  it('serializes the reading date to ISO format', () => {
    const result = buildReadingSubmitPayload({
      formData: baseFormData,
      cardSlots: [slots[0]],
      cardInterpretations: ['单张解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.readingDate).toBe(new Date(baseFormData.readingDate).toISOString());
  });

  it('stores only user-entered category tags as manual tags', () => {
    const result = buildReadingSubmitPayload({
      formData: { ...baseFormData, category: '职业、推进 #复盘 职业' },
      cardSlots: [slots[0]],
      cardInterpretations: ['单张解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.manualTags).toEqual(['职业', '推进', '复盘']);
  });

  it('treats anonymous sharing as a public anonymous share in the submit payload', () => {
    const result = buildReadingSubmitPayload({
      formData: { ...baseFormData, isPublic: false, isAnonymous: true },
      cardSlots: [slots[0]],
      cardInterpretations: ['单张解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.isPublic).toBe(true);
    expect(result.payload.isAnonymous).toBe(true);
  });

  it('stores an optional AI answer separately from user interpretations', () => {
    const result = buildReadingSubmitPayload({
      formData: {
        ...baseFormData,
        aiAnswer: '  AI 认为这里需要先观察。\n\n',
        aiAnswerMode: 'consultant',
      },
      cardSlots: [slots[0]],
      cardInterpretations: ['我自己的单张解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.cardInterpretations).toEqual(['我自己的单张解读']);
    expect(result.payload.aiAnswer).toBe('AI 认为这里需要先观察。');
    expect(result.payload.aiAnswerMode).toBe('consultant');
    expect(result.payload.aiAnswerUpdatedAt).toEqual(expect.any(String));
  });

  it('omits AI answer metadata when the AI answer is blank', () => {
    const result = buildReadingSubmitPayload({
      formData: {
        ...baseFormData,
        aiAnswer: '   ',
        aiAnswerMode: 'mentor',
      },
      cardSlots: [slots[0]],
      cardInterpretations: ['单张解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.aiAnswer).toBeUndefined();
    expect(result.payload.aiAnswerMode).toBeUndefined();
    expect(result.payload.aiAnswerUpdatedAt).toBeUndefined();
  });
});
