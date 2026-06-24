import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { ReadingSlotData } from '../types';

const LONG_PRESS_CLEAR_MS = 600;
const LONG_PRESS_VIBRATION_MS = 50;

interface UseLongPressClearOptions {
  cardSlots: ReadingSlotData[];
  setCardSlots: Dispatch<SetStateAction<ReadingSlotData[]>>;
}

export const useLongPressClear = ({
  cardSlots,
  setCardSlots,
}: UseLongPressClearOptions) => {
  const cardSlotsRef = useRef(cardSlots);
  const timerRef = useRef<number | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);

  useEffect(() => {
    cardSlotsRef.current = cardSlots;
  }, [cardSlots]);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;

    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleLongPressStart = useCallback((index: number) => {
    clearTimer();
    setIsLongPressActive(false);

    timerRef.current = window.setTimeout(() => {
      const currentSlots = cardSlotsRef.current;
      const targetSlot = currentSlots[index];

      if (targetSlot?.name) {
        const nextSlots = [...currentSlots];
        nextSlots[index] = { ...targetSlot, name: '', isReversed: false };
        setCardSlots(nextSlots);
        setIsLongPressActive(true);

        if (window.navigator.vibrate) {
          window.navigator.vibrate(LONG_PRESS_VIBRATION_MS);
        }
      }

      timerRef.current = null;
    }, LONG_PRESS_CLEAR_MS);
  }, [clearTimer, setCardSlots]);

  const handleLongPressEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const clearLongPressActive = useCallback(() => {
    setIsLongPressActive(false);
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    isLongPressActive,
    clearLongPressActive,
    handleLongPressStart,
    handleLongPressEnd,
  };
};
