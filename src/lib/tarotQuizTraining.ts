import { TAROT_CARDS } from '../constants';
import { OFFICIAL_CARD_ANNOTATIONS } from '../constants/cardAnnotations';
import type {
  CardAnnotation,
  OfficialCardAnnotation,
  QuizMemoryAttempt,
  QuizMemoryEntry,
  QuizPracticeFeedback,
  TarotCardMetadata,
} from '../types';

export type QuizCardGroup = 'major' | 'minor' | 'court' | 'numbered';
export type QuizSuit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type CorrespondenceType = 'element' | 'planet' | 'zodiac' | 'house';

export interface QuizTrainingFilters {
  groups: QuizCardGroup[];
  suits: QuizSuit[];
  elements: string[];
  planets: string[];
  zodiacs: string[];
  houses: string[];
  repeatOnly: boolean;
}

export interface QuizTrainingCard {
  id: string;
  name: string;
  english: string;
  arcana: 'major' | 'minor';
  suit?: QuizSuit;
  cardNumber: number | null;
  courtNumber?: 11 | 12 | 13 | 14;
  numerology: string | null;
  planet: string | null;
  zodiac: string | null;
  house: string | null;
  element: string | null;
  keywords: string[];
  uprightMeaning: string;
  reversedMeaning: string;
  personalNotes: string;
}

export interface ReverseQuizQuestion {
  targetType: CorrespondenceType;
  target: string;
  correctCardId: string;
  optionCardIds: string[];
  matchingCardIds: string[];
}

export type QuizQuestionKind = 'correspondence' | 'meaning-card';
export type QuizAttemptInput = Omit<QuizMemoryAttempt, 'id' | 'createdAt'>;
const MAX_QUIZ_ATTEMPTS_PER_CARD = 12;

interface CreateQuizQuestionOptions {
  kinds?: QuizQuestionKind[];
  correctOptionIndex?: number;
}

export interface QuizQuestionOption {
  id: string;
  label: string;
  cardId?: string;
}

export interface QuizQuestion {
  id: string;
  kind: QuizQuestionKind;
  prompt: string;
  promptHint?: string;
  cardId?: string;
  cardName?: string;
  options: QuizQuestionOption[];
  correctOptionId: string;
  answerLabel: string;
  explanation: string;
  relatedCardIds: string[];
}

export const DEFAULT_QUIZ_FILTERS: QuizTrainingFilters = {
  groups: [],
  suits: [],
  elements: [],
  planets: [],
  zodiacs: [],
  houses: [],
  repeatOnly: false,
};

const unique = (items: Array<string | null | undefined>) => (
  Array.from(new Set(items.map(item => item?.trim()).filter((item): item is string => Boolean(item))))
);

const getMergedText = (primary?: string | null, fallback?: string | null) => (
  primary?.trim() || fallback?.trim() || ''
);

const getMergedList = (primary?: string[], fallback?: string[]) => (
  primary && primary.length > 0 ? primary : fallback || []
);

export const buildQuizTrainingCards = (
  customMetadata: TarotCardMetadata[] = [],
  mergedAnnotations: CardAnnotation[] = [],
): QuizTrainingCard[] => {
  const metadataById = new Map(TAROT_CARDS.map(card => [card.id, card]));
  customMetadata.forEach(card => {
    if (!card?.id) return;
    const base = metadataById.get(card.id);
    metadataById.set(card.id, {
      ...(base || card),
      ...card,
      astrology: {
        ...base?.astrology,
        ...card.astrology,
      },
      keywords: getMergedList(card.keywords, base?.keywords),
    });
  });

  const annotationById = new Map(mergedAnnotations.map(annotation => [annotation.cardId, annotation]));
  const officialById = new Map<string, OfficialCardAnnotation>(
    OFFICIAL_CARD_ANNOTATIONS.map(annotation => [annotation.cardId, annotation]),
  );

  return TAROT_CARDS.map(card => {
    const metadata = metadataById.get(card.id) || card;
    const official = officialById.get(card.id);
    const annotation = annotationById.get(card.id);

    return {
      id: card.id,
      name: metadata.name || card.name,
      english: metadata.english || card.english,
      arcana: official?.arcana || (card.id.startsWith('ar') ? 'major' : 'minor'),
      suit: official?.suit,
      cardNumber: official?.cardNumber ?? metadata.default_numerology ?? null,
      courtNumber: official?.courtNumber,
      numerology: annotation?.numerology ?? official?.numerology ?? (
        metadata.default_numerology !== null && metadata.default_numerology !== undefined
          ? String(metadata.default_numerology)
          : null
      ),
      planet: annotation?.planet ?? official?.planet ?? metadata.astrology?.planet ?? null,
      zodiac: annotation?.zodiac ?? official?.zodiac ?? metadata.astrology?.zodiac ?? null,
      house: annotation?.house ?? official?.house ?? metadata.astrology?.house ?? null,
      element: annotation?.element ?? official?.element ?? metadata.astrology?.element ?? null,
      keywords: getMergedList(annotation?.keywords, getMergedList(metadata.keywords, official?.keywords)),
      uprightMeaning: getMergedText(annotation?.uprightMeaning, getMergedText(metadata.meaning, official?.uprightMeaning)),
      reversedMeaning: getMergedText(annotation?.reversedMeaning, getMergedText(metadata.reversedMeaning, official?.reversedMeaning)),
      personalNotes: annotation?.personalNotes?.trim() || '',
    };
  });
};

const matchGroups = (card: QuizTrainingCard, groups: QuizCardGroup[]) => {
  if (groups.length === 0) return true;
  return groups.some(group => {
    if (group === 'major') return card.arcana === 'major';
    if (group === 'minor') return card.arcana === 'minor';
    if (group === 'court') return Boolean(card.courtNumber);
    return card.arcana === 'minor' && card.cardNumber !== null && card.cardNumber !== undefined && !card.courtNumber;
  });
};

const matchAny = (value: string | null, selected: string[]) => (
  selected.length === 0 || (Boolean(value) && selected.includes(value as string))
);

export const filterQuizTrainingCards = (
  cards: QuizTrainingCard[],
  filters: QuizTrainingFilters,
  memory: QuizMemoryEntry[] = [],
) => {
  const repeatedIds = new Set(memory.filter(entry => entry.repeated).map(entry => entry.cardId));

  return cards.filter(card => {
    if (filters.repeatOnly && !repeatedIds.has(card.id)) return false;
    if (!matchGroups(card, filters.groups)) return false;
    if (filters.suits.length > 0 && (!card.suit || !filters.suits.includes(card.suit))) return false;
    if (!matchAny(card.element, filters.elements)) return false;
    if (!matchAny(card.planet, filters.planets)) return false;
    if (!matchAny(card.zodiac, filters.zodiacs)) return false;
    if (!matchAny(card.house, filters.houses)) return false;
    return true;
  });
};

export const getQuizMemoryEntry = (
  memory: QuizMemoryEntry[],
  cardId: string,
) => memory.find(entry => entry.cardId === cardId);

export const getQuizCardWeight = (
  card: Pick<QuizTrainingCard, 'id'>,
  memory: QuizMemoryEntry[] = [],
) => {
  const entry = getQuizMemoryEntry(memory, card.id);
  if (!entry) return 1;

  return 1
    + (entry.repeated ? 4 : 0)
    + Math.min(5, entry.unfamiliarCount || 0)
    + Math.min(6, (entry.wrongCount || 0) * 1.5);
};

export const chooseWeightedQuizCard = (
  cards: QuizTrainingCard[],
  memory: QuizMemoryEntry[] = [],
  random = Math.random,
) => {
  if (cards.length === 0) return null;

  const weights = cards.map(card => getQuizCardWeight(card, memory));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let cursor = random() * totalWeight;

  for (let index = 0; index < cards.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return cards[index];
  }

  return cards[cards.length - 1];
};

const createMemoryEntry = (
  card: Pick<QuizTrainingCard, 'id' | 'name'>,
  now: string,
): QuizMemoryEntry => ({
  cardId: card.id,
  cardName: card.name,
  practiceCount: 0,
  unfamiliarCount: 0,
  wrongCount: 0,
  repeated: false,
  createdAt: now,
  updatedAt: now,
});

export const updateQuizMemory = (
  memory: QuizMemoryEntry[],
  card: Pick<QuizTrainingCard, 'id' | 'name'>,
  feedback: QuizPracticeFeedback,
  now = new Date().toISOString(),
  attempt?: QuizAttemptInput,
) => {
  const existing = getQuizMemoryEntry(memory, card.id);
  const nextEntry = existing
    ? {
        ...existing,
        cardName: card.name || existing.cardName,
        attempts: [...(existing.attempts || [])],
      }
    : createMemoryEntry(card, now);

  if (feedback === 'remembered') {
    nextEntry.practiceCount += 1;
    nextEntry.repeated = false;
    nextEntry.lastPracticedAt = now;
  } else if (feedback === 'unfamiliar') {
    nextEntry.practiceCount += 1;
    nextEntry.unfamiliarCount += 1;
    nextEntry.repeated = true;
    nextEntry.lastPracticedAt = now;
  } else if (feedback === 'wrong') {
    nextEntry.practiceCount += 1;
    nextEntry.wrongCount += 1;
    nextEntry.repeated = true;
    nextEntry.lastPracticedAt = now;
  } else if (feedback === 'add-repeat') {
    nextEntry.repeated = true;
  } else if (feedback === 'clear-repeat') {
    nextEntry.repeated = false;
  }

  if (attempt && ['remembered', 'unfamiliar', 'wrong'].includes(feedback)) {
    nextEntry.attempts = [
      {
        id: `${card.id}-${now}-${attempt.modeLabel}`,
        ...attempt,
        createdAt: now,
      },
      ...(nextEntry.attempts || []),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_QUIZ_ATTEMPTS_PER_CARD);
  }

  nextEntry.updatedAt = now;

  return [
    nextEntry,
    ...memory.filter(entry => entry.cardId !== card.id),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.cardName.localeCompare(b.cardName));
};

export const getRepeatedQuizMemoryCount = (memory: QuizMemoryEntry[]) => (
  memory.filter(entry => entry.repeated).length
);

export const getRecentWeakQuizCards = (
  memory: QuizMemoryEntry[],
  cards: QuizTrainingCard[],
  limit = 3,
) => {
  const cardsById = new Map(cards.map(card => [card.id, card]));
  return memory
    .filter(entry => (entry.unfamiliarCount || 0) + (entry.wrongCount || 0) > 0)
    .sort((a, b) => (b.lastPracticedAt || b.updatedAt).localeCompare(a.lastPracticedAt || a.updatedAt))
    .map(entry => cardsById.get(entry.cardId) || null)
    .filter((card): card is QuizTrainingCard => Boolean(card))
    .slice(0, limit);
};

export const getAvailableCorrespondenceValues = (
  cards: QuizTrainingCard[],
  key: CorrespondenceType,
) => unique(cards.map(card => card[key]));

const shuffle = <T,>(items: T[], random = Math.random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const pickRandom = <T,>(items: T[], random = Math.random) => {
  if (items.length === 0) return null;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
};

const correspondenceLabels: Record<CorrespondenceType, string> = {
  element: '元素',
  planet: '行星',
  zodiac: '星座',
  house: '宫位',
};

const houseNumberByChineseNumeral: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

export const formatQuizDisplayValue = (value: string) => (
  value.replace(/^第(零|一|二|三|四|五|六|七|八|九|十|十一|十二)宫$/, (_, numberText: string) => (
    `第${houseNumberByChineseNumeral[numberText]}宫`
  ))
);

const sentencePreview = (text: string) => {
  const sentence = text
    .split(/[。；;.!！？?]/)
    .map(part => part.trim())
    .find(Boolean);

  return sentence ? `${sentence}。` : text.trim().slice(0, 42);
};

const buildTextOptions = (
  correct: string,
  distractors: string[],
  random = Math.random,
  correctOptionIndex?: number,
): QuizQuestionOption[] => {
  const options = [
    { id: `answer-${correct}`, label: correct },
    ...shuffle(unique(distractors).filter(item => item !== correct), random)
      .slice(0, 3)
      .map(label => ({ id: `answer-${label}`, label })),
  ];

  return placeCorrectOption(shuffle(options, random), `answer-${correct}`, correctOptionIndex);
};

const buildCardOptions = (
  correct: QuizTrainingCard,
  cards: QuizTrainingCard[],
  random = Math.random,
  correctOptionIndex?: number,
): QuizQuestionOption[] => {
  const options = [
    { id: correct.id, label: correct.name, cardId: correct.id },
    ...shuffle(cards.filter(card => card.id !== correct.id), random)
      .slice(0, 3)
      .map(card => ({ id: card.id, label: card.name, cardId: card.id })),
  ];

  return placeCorrectOption(shuffle(options, random), correct.id, correctOptionIndex);
};

const placeCorrectOption = (
  options: QuizQuestionOption[],
  correctOptionId: string,
  correctOptionIndex?: number,
) => {
  if (correctOptionIndex === undefined || options.length === 0) return options;

  const correctIndex = options.findIndex(option => option.id === correctOptionId);
  if (correctIndex < 0) return options;

  const nextOptions = [...options];
  const targetIndex = Math.max(0, Math.min(options.length - 1, correctOptionIndex));
  const [correctOption] = nextOptions.splice(correctIndex, 1);
  nextOptions.splice(targetIndex, 0, correctOption);
  return nextOptions;
};

export const mergeKeywordInput = (
  existingKeywords: string[],
  input: string,
) => {
  const addedKeywords = input
    .split(/[、,，\s]+/)
    .map(keyword => keyword.trim())
    .filter(Boolean);

  return Array.from(new Set([...existingKeywords.map(keyword => keyword.trim()).filter(Boolean), ...addedKeywords]));
};

const createCorrespondenceQuestion = (
  cards: QuizTrainingCard[],
  memory: QuizMemoryEntry[] = [],
  random = Math.random,
  options: CreateQuizQuestionOptions = {},
): QuizQuestion | null => {
  const card = chooseWeightedQuizCard(cards, memory, random);
  if (!card) return null;

  const available = (['element', 'planet', 'zodiac', 'house'] as CorrespondenceType[])
    .map(type => ({ type, value: card[type] }))
    .filter((item): item is { type: CorrespondenceType; value: string } => Boolean(item.value));
  const target = pickRandom(available, random);
  if (!target) return null;

  const allValues = getAvailableCorrespondenceValues(cards, target.type);
  const answerOptions = buildTextOptions(target.value, allValues, random, options.correctOptionIndex)
    .map(option => ({
      ...option,
      label: formatQuizDisplayValue(option.label),
    }));
  if (answerOptions.length < 3) return null;
  const formattedAnswer = formatQuizDisplayValue(target.value);

  return {
    id: `${card.id}-${target.type}-${target.value}`,
    kind: 'correspondence',
    prompt: `这张牌对应哪个${correspondenceLabels[target.type]}？`,
    promptHint: '看牌面，选一个最接近的答案。',
    cardId: card.id,
    cardName: card.name,
    options: answerOptions,
    correctOptionId: `answer-${target.value}`,
    answerLabel: formattedAnswer,
    explanation: `「${card.name}」的${correspondenceLabels[target.type]}是「${formattedAnswer}」。`,
    relatedCardIds: cards.filter(item => item[target.type] === target.value).map(item => item.id),
  };
};

const createMeaningCardQuestion = (
  cards: QuizTrainingCard[],
  memory: QuizMemoryEntry[] = [],
  random = Math.random,
  options: CreateQuizQuestionOptions = {},
): QuizQuestion | null => {
  const meaningCards = cards.filter(card => card.uprightMeaning.trim());
  const card = chooseWeightedQuizCard(meaningCards, memory, random);
  if (!card) return null;

  const promptHint = sentencePreview(card.uprightMeaning);
  const answerOptions = buildCardOptions(card, cards, random, options.correctOptionIndex);
  if (answerOptions.length < 3) return null;

  return {
    id: `${card.id}-meaning-card`,
    kind: 'meaning-card',
    prompt: '这段含义，更接近哪张牌？',
    promptHint: `「${promptHint}」`,
    cardId: card.id,
    cardName: card.name,
    options: answerOptions,
    correctOptionId: card.id,
    answerLabel: card.name,
    explanation: `这段含义来自「${card.name}」的正位主轴。`,
    relatedCardIds: cards
      .filter(item => item.id !== card.id && item.element && item.element === card.element)
      .slice(0, 2)
      .map(item => item.id),
  };
};

export const createQuizQuestion = (
  cards: QuizTrainingCard[],
  memory: QuizMemoryEntry[] = [],
  random = Math.random,
  options: CreateQuizQuestionOptions = {},
): QuizQuestion | null => {
  if (cards.length === 0) return null;

  const builderByKind: Record<QuizQuestionKind, typeof createCorrespondenceQuestion> = {
    correspondence: createCorrespondenceQuestion,
    'meaning-card': createMeaningCardQuestion,
  };
  const kinds = options.kinds?.length ? options.kinds : (['correspondence', 'meaning-card'] as QuizQuestionKind[]);
  const builders = shuffle(kinds.map(kind => builderByKind[kind]), random);

  for (const builder of builders) {
    const question = builder(cards, memory, random, options);
    if (question) return question;
  }

  return null;
};

const getReverseTargets = (cards: QuizTrainingCard[], filters: QuizTrainingFilters) => {
  const explicitTargets: Array<{ targetType: CorrespondenceType; target: string }> = [
    ...filters.elements.map(target => ({ targetType: 'element' as const, target })),
    ...filters.planets.map(target => ({ targetType: 'planet' as const, target })),
    ...filters.zodiacs.map(target => ({ targetType: 'zodiac' as const, target })),
    ...filters.houses.map(target => ({ targetType: 'house' as const, target })),
  ];

  if (explicitTargets.length > 0) return explicitTargets;

  return (['element', 'planet', 'zodiac', 'house'] as CorrespondenceType[])
    .flatMap(targetType => getAvailableCorrespondenceValues(cards, targetType).map(target => ({ targetType, target })));
};

export const createReverseQuizQuestion = (
  cards: QuizTrainingCard[],
  filters: QuizTrainingFilters = DEFAULT_QUIZ_FILTERS,
  memory: QuizMemoryEntry[] = [],
  random = Math.random,
): ReverseQuizQuestion | null => {
  if (cards.length === 0) return null;

  const targets = shuffle(getReverseTargets(cards, filters), random)
    .filter(({ targetType, target }) => cards.some(card => card[targetType] === target));

  const selectedTarget = targets[0];
  if (!selectedTarget) return null;

  const matchingCards = cards.filter(card => card[selectedTarget.targetType] === selectedTarget.target);
  const correctCard = chooseWeightedQuizCard(matchingCards, memory, random);
  if (!correctCard) return null;

  const distractors = shuffle(cards.filter(card => card.id !== correctCard.id && card[selectedTarget.targetType] !== selectedTarget.target), random)
    .slice(0, 3);
  const options = shuffle([correctCard, ...distractors], random).map(card => card.id);

  return {
    targetType: selectedTarget.targetType,
    target: selectedTarget.target,
    correctCardId: correctCard.id,
    optionCardIds: options,
    matchingCardIds: matchingCards.map(card => card.id),
  };
};
