import { TarotReading, UserProfile } from '../types';

export const getAuthorDisplayName = (
  profile: Partial<UserProfile> | null | undefined,
  session?: { email?: string | null } | null,
) => (
  profile?.display_name
  || profile?.nickname
  || session?.email?.split('@')[0]
  || '研习阁主'
);

export const syncReadingAuthorName = (
  readings: TarotReading[],
  userId: string,
  nextAuthorName: string,
) => {
  const now = new Date().toISOString();

  return readings.map(reading => {
    if (
      reading.isExample
      || reading.isAnonymous
      || reading.userId !== userId
      || reading.authorName === nextAuthorName
    ) {
      return reading;
    }

    return {
      ...reading,
      authorName: nextAuthorName,
      updatedAt: now,
    };
  });
};
