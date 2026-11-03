import type { CardAnnotation } from '../types';

export const mergeCardPersonalNoteTexts = (...texts: Array<string | undefined>) => (
  Array.from(new Set(texts.filter((text): text is string => typeof text === 'string' && Boolean(text.trim())))).join('\n\n')
);

// Read legacy fields without modifying either original. Only an explicit save
// consolidates them; different texts (including their line breaks) stay intact.
export const getCardPersonalNotes = (annotation?: Partial<CardAnnotation> | null) => (
  mergeCardPersonalNoteTexts(annotation?.personalMeaning, annotation?.personalNotes)
);

export const cardPersonalNotesPatch = (text: string) => ({ personalNotes: text, personalMeaning: text });
