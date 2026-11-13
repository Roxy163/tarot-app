import { DailyFortune, DailyFortuneReflectionParts } from '../types';

export const NO_OBVIOUS_DAILY_MATCH_TEXT = '今天暂未看见明显对应';
export const NO_OBVIOUS_PAST_DAILY_MATCH_TEXT = '那天暂未看见明显对应';

export const appendNoObviousDailyMatch = (text: string, matchText = NO_OBVIOUS_DAILY_MATCH_TEXT) => {
  if (!text.trim()) return matchText;
  const matchPhrases = [NO_OBVIOUS_DAILY_MATCH_TEXT, NO_OBVIOUS_PAST_DAILY_MATCH_TEXT, matchText];
  if (text.split(/\r?\n/).some(line => matchPhrases.includes(line.trim()))) return text;
  return `${text}${text.endsWith('\n') ? '' : '\n'}${matchText}`;
};

const normalize = (value?: string) => (value || '').trim();

export const buildDailyReflection = ({
  initialImpression,
  dailyReview,
}: DailyFortuneReflectionParts) => {
  const sections = [
    ['第一直觉', normalize(initialImpression)],
    ['今日回看', normalize(dailyReview)],
  ].filter(([, value]) => value);

  return sections.map(([label, value]) => `${label}：${value}`).join('\n\n');
};

export const getDailyReflectionParts = (fortune: DailyFortune): Required<DailyFortuneReflectionParts> => {
  const initialImpression = normalize(fortune.initialImpression);
  const dailyReview = normalize(fortune.dailyReview);

  if (initialImpression || dailyReview) {
    return { initialImpression, dailyReview };
  }

  return {
    initialImpression: '',
    dailyReview: normalize(fortune.reflection),
  };
};

export const hasDailyReflectionContent = (fortune: DailyFortune) => {
  const parts = getDailyReflectionParts(fortune);
  return Boolean(parts.initialImpression || parts.dailyReview || normalize(fortune.reflection));
};

export const canRedrawDailyFortune = (fortune: DailyFortune) => (
  !fortune.archivedAt && !fortune.savedToCardAnnotationAt && !hasDailyReflectionContent(fortune)
);

export const createDailyReflectionPatch = (
  input?: string | DailyFortuneReflectionParts
): DailyFortuneReflectionParts & { reflection: string } => {
  if (typeof input === 'string') {
    return { reflection: normalize(input) };
  }

  const initialImpression = normalize(input?.initialImpression);
  const dailyReview = normalize(input?.dailyReview);

  return {
    initialImpression,
    dailyReview,
    reflection: buildDailyReflection({ initialImpression, dailyReview }),
  };
};
