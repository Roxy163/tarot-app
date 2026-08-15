import { ReadingFormData, ReadingSlotData } from '../types';

export const EMPTY_READING_NOTICE = '还差一点：请至少录入一张牌。';
export const REQUIRED_QUESTION_NOTICE = '还差一点：先写下这次想问的问题。';
export const REQUIRED_SPREAD_NOTICE = '还差一点：先选择这次使用的牌阵。';
export const REQUIRED_CLIENT_NAME_NOTICE = '还差一点：客户模式需要填写客户称呼。';
export const INCOMPLETE_CARDS_NOTICE = '还差一点：当前牌阵还有位置没有录入牌面。';
export const REQUIRED_CARD_INTERPRETATION_NOTICE = '还差一点：请给每张牌写一句你的解读。';
export const REQUIRED_CHOICE_PATH_NOTICE = '还差一点：先写清 A 路和 B 路分别代表什么。';

export type ReadingRequiredFieldKey =
  | 'question'
  | 'spread'
  | 'clientName'
  | 'cards'
  | 'cardInterpretation';

export type ReadingRequiredFieldIssue = {
  field: ReadingRequiredFieldKey;
  notice: string;
  slotIndex?: number;
};

export const parseReadingManualTags = (value?: string | string[]) => {
  const raw = Array.isArray(value) ? value.join('、') : value || '';

  return Array.from(new Set(
    raw
      .split(/[、,，#\s]+/)
      .map(tag => tag.trim())
      .filter(Boolean)
  ));
};

export type ReadingFormState = Omit<ReadingFormData, 'interpretation' | 'cards' | 'cardInterpretations' | 'cardQuestions' | 'slotLabels' | 'slotPositions' | 'rotatedSlots'> & {
  singleCard: string;
  combination: string;
  numerologyInfluence?: string;
  astrologyInfluence?: string;
  houseInfluence?: string;
  elementInfluence?: string;
};

export type ReadingSubmitPayloadResult =
  | { ok: true; payload: Partial<ReadingFormData> }
  | { ok: false; notice: string };

const isSingleCardReading = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => (
  formData.category === '日运'
  || formData.spread === '单牌阵'
  || cardSlots.length <= 1
);

export const getReadingSlotInterpretation = ({
  formData,
  cardInterpretations,
  slotIndex,
  cardSlots,
}: {
  formData: ReadingFormState;
  cardInterpretations: string[];
  slotIndex: number;
  cardSlots: ReadingSlotData[];
}) => {
  const direct = cardInterpretations[slotIndex]?.trim();
  if (direct) return direct;

  if (slotIndex === 0 && isSingleCardReading(formData, cardSlots)) {
    return formData.singleCard?.trim() || '';
  }

  return '';
};

export const validateReadingRequiredFields = ({
  formData,
  cardSlots,
  cardInterpretations,
}: {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
  cardInterpretations: string[];
}): string | null => {
  return getReadingRequiredFieldIssue({ formData, cardSlots, cardInterpretations })?.notice || null;
};

export const getReadingRequiredFieldIssue = ({
  formData,
  cardSlots,
  cardInterpretations,
}: {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
  cardInterpretations: string[];
}): ReadingRequiredFieldIssue | null => {
  if (!formData.question.trim()) return { field: 'question', notice: REQUIRED_QUESTION_NOTICE };
  if (!formData.spread.trim()) return { field: 'spread', notice: REQUIRED_SPREAD_NOTICE };
  if (formData.isForClient && !formData.clientName.trim()) {
    return { field: 'clientName', notice: REQUIRED_CLIENT_NAME_NOTICE };
  }
  if (cardSlots.length === 0) return { field: 'cards', notice: EMPTY_READING_NOTICE };

  const emptyCardIndex = cardSlots.findIndex(slot => !slot.name.trim());
  if (emptyCardIndex !== -1) {
    return { field: 'cards', slotIndex: emptyCardIndex, notice: INCOMPLETE_CARDS_NOTICE };
  }

  const emptyInterpretationIndex = cardSlots.findIndex((_, index) => !getReadingSlotInterpretation({
    formData,
    cardInterpretations,
    slotIndex: index,
    cardSlots,
  }));
  if (emptyInterpretationIndex !== -1) {
    return {
      field: 'cardInterpretation',
      slotIndex: emptyInterpretationIndex,
      notice: REQUIRED_CARD_INTERPRETATION_NOTICE,
    };
  }

  return null;
};

export const buildReadingSubmitPayload = ({
  formData,
  cardSlots,
  cardInterpretations,
  cardQuestions = [],
}: {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
  cardInterpretations: string[];
  cardQuestions?: string[];
}): ReadingSubmitPayloadResult => {
  const {
    singleCard,
    combination,
    numerologyInfluence,
    astrologyInfluence,
    houseInfluence,
    elementInfluence,
    readingDate,
    aiAnswer,
    aiAnswerMode,
    aiAnswerUpdatedAt,
    ...rest
  } = formData;

  const requiredFieldNotice = validateReadingRequiredFields({ formData, cardSlots, cardInterpretations });
  if (requiredFieldNotice) return { ok: false, notice: requiredFieldNotice };

  const submittedCards = cardSlots;
  const submittedInterpretations = cardSlots.map((_, index) => getReadingSlotInterpretation({
    formData,
    cardInterpretations,
    slotIndex: index,
    cardSlots,
  }));
  const submittedQuestions = cardSlots.map((_, index) => cardQuestions[index]?.trim() || '');
  const singleCardMode = isSingleCardReading(formData, submittedCards);
  const finalSingleCard = singleCardMode ? submittedInterpretations[0] : singleCard;
  const finalCombination = singleCardMode ? '' : combination;
  const isAnonymousShare = Boolean(rest.isAnonymous);
  const submittedAiAnswer = aiAnswer?.trim() || '';
  const submittedAiAnswerMode = aiAnswerMode === 'consultant' ? 'consultant' : 'mentor';

  return {
    ok: true,
    payload: {
      ...rest,
      isPublic: isAnonymousShare ? true : Boolean(rest.isPublic),
      isAnonymous: isAnonymousShare,
      readingDate: new Date(readingDate).toISOString(),
      interpretation: {
        singleCard: finalSingleCard,
        combination: finalCombination,
        numerologyInfluence,
        astrologyInfluence,
        houseInfluence,
        elementInfluence,
      },
      aiAnswer: submittedAiAnswer || undefined,
      aiAnswerMode: submittedAiAnswer ? submittedAiAnswerMode : undefined,
      aiAnswerUpdatedAt: submittedAiAnswer ? (aiAnswerUpdatedAt || new Date().toISOString()) : undefined,
      manualTags: parseReadingManualTags(formData.category),
      cards: submittedCards,
      slotLabels: submittedCards.map(slot => slot.label || ''),
      slotPositions: submittedCards.map(slot => slot.position || ''),
      rotatedSlots: submittedCards
        .map((slot, index) => (slot.isRotated ? index : -1))
        .filter(index => index !== -1),
      cardInterpretations: submittedInterpretations,
      cardQuestions: submittedQuestions,
    },
  };
};
