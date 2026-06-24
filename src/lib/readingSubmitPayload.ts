import { ReadingFormData, ReadingSlotData } from '../types';

export const EMPTY_READING_NOTICE = '请至少选择一张牌，再录入手记。';

export type ReadingFormState = Omit<ReadingFormData, 'interpretation' | 'cards' | 'cardInterpretations' | 'slotLabels' | 'slotPositions' | 'rotatedSlots'> & {
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

export const buildReadingSubmitPayload = ({
  formData,
  cardSlots,
  cardInterpretations,
}: {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
  cardInterpretations: string[];
}): ReadingSubmitPayloadResult => {
  const {
    singleCard,
    combination,
    numerologyInfluence,
    astrologyInfluence,
    houseInfluence,
    elementInfluence,
    readingDate,
    ...rest
  } = formData;

  const filledSlots = cardSlots
    .map((slot, index) => ({ slot, index }))
    .filter(item => item.slot.name);

  if (filledSlots.length === 0) {
    return { ok: false, notice: EMPTY_READING_NOTICE };
  }

  const submittedCards = filledSlots.map(item => item.slot);
  const submittedInterpretations = filledSlots.map(item => cardInterpretations[item.index] || '');
  const isSingleCardReading = (
    formData.category === '日运'
    || formData.spread === '单牌阵'
    || submittedCards.length <= 1
  );
  const finalSingleCard = isSingleCardReading ? (submittedInterpretations[0] || singleCard) : singleCard;
  const finalCombination = isSingleCardReading ? '' : combination;

  return {
    ok: true,
    payload: {
      ...rest,
      readingDate: new Date(readingDate).toISOString(),
      interpretation: {
        singleCard: finalSingleCard,
        combination: finalCombination,
        numerologyInfluence,
        astrologyInfluence,
        houseInfluence,
        elementInfluence,
      },
      cards: submittedCards,
      slotLabels: submittedCards.map(slot => slot.label || ''),
      slotPositions: submittedCards.map(slot => slot.position || ''),
      rotatedSlots: submittedCards
        .map((slot, index) => (slot.isRotated ? index : -1))
        .filter(index => index !== -1),
      cardInterpretations: submittedInterpretations,
    },
  };
};
