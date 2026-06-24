import { describe, expect, it } from 'vitest';
import { ReadingSlotData } from '../types';
import { EMPTY_READING_NOTICE, ReadingFormState, buildReadingSubmitPayload } from './readingSubmitPayload';

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

describe('buildReadingSubmitPayload', () => {
  it('returns a notice when no card has been selected', () => {
    expect(buildReadingSubmitPayload({
      formData: baseFormData,
      cardSlots: [{ name: '', isReversed: false, label: '空位' }],
      cardInterpretations: [''],
    })).toEqual({ ok: false, notice: EMPTY_READING_NOTICE });
  });

  it('filters empty slots and keeps labels, positions, rotations and interpretations aligned', () => {
    const result = buildReadingSubmitPayload({
      formData: baseFormData,
      cardSlots: slots,
      cardInterpretations: ['过去解读', '空位解读', '未来解读'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.cards).toEqual([slots[0], slots[2]]);
    expect(result.payload.slotLabels).toEqual(['过去', '未来']);
    expect(result.payload.slotPositions).toEqual(['p1', 'p3']);
    expect(result.payload.rotatedSlots).toEqual([1]);
    expect(result.payload.cardInterpretations).toEqual(['过去解读', '未来解读']);
    expect(result.payload.interpretation?.combination).toBe('组合原文');
  });

  it('uses the first submitted interpretation as single-card text for daily readings', () => {
    const result = buildReadingSubmitPayload({
      formData: { ...baseFormData, category: '日运', spread: '时间流牌阵' },
      cardSlots: slots,
      cardInterpretations: ['今日解读', '', '第二张解读'],
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
});
