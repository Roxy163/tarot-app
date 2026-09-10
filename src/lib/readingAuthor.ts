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

export const syncReadingAuthorProfile = (
  readings: TarotReading[],
  userId: string,
  nextAuthorName: string,
  nextAuthorBio = '',
) => {
  const now = new Date().toISOString();
  const cleanBio = nextAuthorBio.trim();

  return readings.map(reading => {
    if (
      reading.isExample
      || reading.isAnonymous
      || reading.userId !== userId
      || (reading.authorName === nextAuthorName && (reading.authorBio || '') === cleanBio)
    ) {
      return reading;
    }

    return {
      ...reading,
      authorName: nextAuthorName,
      authorBio: cleanBio || undefined,
      updatedAt: now,
    };
  });
};

export const syncReadingAuthorName = (
  readings: TarotReading[],
  userId: string,
  nextAuthorName: string,
) => syncReadingAuthorProfile(readings, userId, nextAuthorName);
