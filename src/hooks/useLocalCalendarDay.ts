import { useEffect, useState } from 'react';
import { toLocalReadingDate } from '../lib/readingDate';

export function useLocalCalendarDay(): string {
  const [day, setDay] = useState(() => toLocalReadingDate());

  useEffect(() => {
    let timer: number;
    const refresh = () => {
      const now = new Date();
      setDay(toLocalReadingDate(now));
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, nextMidnight.getTime() - now.getTime());
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return day;
}
