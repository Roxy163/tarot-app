import { DailyFortune } from '../types';

const getTime = (value?: string) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export const getDailyFortuneVersionTime = (fortune: DailyFortune) => (
  getTime(fortune.deletedAt)
  || getTime(fortune.updatedAt)
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
  ...(newest.id === previous.id ? {
    savedToCardAnnotationAt: newest.savedToCardAnnotationAt ?? previous.savedToCardAnnotationAt,
    cardAnnotationNote: newest.cardAnnotationNote ?? previous.cardAnnotationNote,
  } : {}),
});

export const markDailyFortuneDeleted = (fortune: DailyFortune, deletedAt: string): DailyFortune => {
  if (fortune.savedToCardAnnotationAt) return { ...fortune, deletedAt, updatedAt: deletedAt };

  // Unsaved personal text is removed; the remaining marker prevents a stale cloud copy from returning.
  const { initialImpression, dailyReview, reflection, cardAnnotationNote, ...marker } = fortune;
  return { ...marker, interpretation: '', keywords: [], deletedAt, updatedAt: deletedAt };
};

export const pickNewestDailyFortune = (
  incoming: DailyFortune,
  previous?: DailyFortune,
) => {
  if (!previous) return incoming;

  // Deletion is final for this identity, even if an old device edits its stale copy later.
  if (incoming.id === previous.id && Boolean(incoming.deletedAt) !== Boolean(previous.deletedAt)) {
    return incoming.deletedAt ? incoming : previous;
  }

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
  const fortunesById = new Map<string, DailyFortune>();
  fortuneSources.flat().forEach(fortune => {
    if (!fortune?.id && !fortune?.date) return;
    const key = fortune.id || fortune.date;
    fortunesById.set(key, pickNewestDailyFortune(fortune, fortunesById.get(key)));
  });
  const deletedFortunes = Array.from(fortunesById.values()).filter(fortune => fortune.deletedAt);
  const deletedTimeByDate = new Map<string, number>();
  deletedFortunes.forEach(fortune => deletedTimeByDate.set(
    fortune.date,
    Math.max(deletedTimeByDate.get(fortune.date) || 0, getTime(fortune.deletedAt)),
  ));
  const fortunesByDate = new Map<string, DailyFortune>();

  fortunesById.forEach(fortune => {
    if (fortune.deletedAt) return;
    const deletedTime = deletedTimeByDate.get(fortune.date) || 0;
    // Editing an older duplicate on another device does not make it a new draw.
    // A deliberate redraw keeps its distinct identity and later creation time.
    const staleDeletedDate = getTime(fortune.createdAt) < deletedTime;
    if (staleDeletedDate) return;

    const key = getDailyFortuneMergeKey(fortune);
    const merged = pickNewestDailyFortune(fortune, fortunesByDate.get(key));
    fortunesByDate.set(key, {
      ...merged,
      userId: uid,
    });
  });

  return [...fortunesByDate.values(), ...deletedFortunes.map(fortune => ({ ...fortune, userId: uid }))].sort((a, b) => (
    b.date.localeCompare(a.date) || getDailyFortuneVersionTime(b) - getDailyFortuneVersionTime(a)
  ));
};
