import { DailyFortune } from '../types';

const getTime = (value?: string) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export const getDailyFortuneVersionTime = (fortune: DailyFortune) => (
  getTime(fortune.updatedAt)
  || getTime(fortune.archivedAt)
  || getTime(fortune.createdAt)
  || getTime(fortune.date)
);

const getDailyFortuneMergeKey = (fortune: DailyFortune) => (
  fortune.date || fortune.id
);

const keepFilledReflectionFields = (
  newest: DailyFortune,
  previous: DailyFortune,
): DailyFortune => ({
  ...newest,
  initialImpression: newest.initialImpression ?? previous.initialImpression,
  dailyReview: newest.dailyReview ?? previous.dailyReview,
  reflection: newest.reflection ?? previous.reflection,
  archivedAt: newest.archivedAt ?? previous.archivedAt,
  isRevealed: newest.isRevealed ?? previous.isRevealed,
});

export const pickNewestDailyFortune = (
  incoming: DailyFortune,
  previous?: DailyFortune,
) => {
  if (!previous) return incoming;

  const incomingTime = getDailyFortuneVersionTime(incoming);
  const previousTime = getDailyFortuneVersionTime(previous);
  const newest = incomingTime >= previousTime ? incoming : previous;
  const older = newest === incoming ? previous : incoming;

  return keepFilledReflectionFields(newest, older);
};

export const mergeDailyFortuneSources = (
  uid: string,
  fortuneSources: DailyFortune[][],
) => {
  const fortunesByDate = new Map<string, DailyFortune>();

  fortuneSources.flat().forEach(fortune => {
    if (!fortune?.id && !fortune?.date) return;

    const key = getDailyFortuneMergeKey(fortune);
    const merged = pickNewestDailyFortune(fortune, fortunesByDate.get(key));
    fortunesByDate.set(key, {
      ...merged,
      userId: uid,
    });
  });

  return Array.from(fortunesByDate.values()).sort((a, b) => (
    b.date.localeCompare(a.date) || getDailyFortuneVersionTime(b) - getDailyFortuneVersionTime(a)
  ));
};
