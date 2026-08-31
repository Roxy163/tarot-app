import { TarotReading } from '../types';
import { parseReadingManualTags } from './readingSubmitPayload';

export interface ReadingTagSuggestion {
  tag: string;
  count: number;
  lastUsedAt: number;
}

const TAG_SEPARATOR_PATTERN = /[、,，#\s]/;

export const getActiveTagDraft = (value: string) => {
  let lastSeparatorIndex = -1;

  for (let index = 0; index < value.length; index += 1) {
    if (TAG_SEPARATOR_PATTERN.test(value[index])) {
      lastSeparatorIndex = index;
    }
  }

  const prefix = lastSeparatorIndex >= 0 ? value.slice(0, lastSeparatorIndex + 1) : '';
  const draft = value.slice(lastSeparatorIndex + 1).trim();

  return {
    draft,
    committedTags: parseReadingManualTags(prefix),
  };
};

const getReadingTagTime = (reading: TarotReading) => {
  const timestamp = Date.parse(reading.updatedAt || reading.readingDate || reading.date || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const buildReadingTagSuggestions = (
  readings: TarotReading[],
  currentValue = '',
  limit = 8,
): ReadingTagSuggestion[] => {
  const { draft, committedTags } = getActiveTagDraft(currentValue);
  const query = draft.toLocaleLowerCase();
  const committedSet = new Set(committedTags.map(tag => tag.toLocaleLowerCase()));
  const suggestions = new Map<string, ReadingTagSuggestion>();

  readings
    .filter(reading => !reading.isExample)
    .forEach(reading => {
      const lastUsedAt = getReadingTagTime(reading);
      const tags = reading.manualTags?.length ? reading.manualTags : reading.category;

      parseReadingManualTags(tags).forEach(tag => {
        const normalizedTag = tag.toLocaleLowerCase();
        if (!normalizedTag || committedSet.has(normalizedTag) || normalizedTag === query) return;
        if (query && !normalizedTag.includes(query)) return;

        const previous = suggestions.get(normalizedTag);
        suggestions.set(normalizedTag, {
          tag: lastUsedAt >= (previous?.lastUsedAt || 0) ? tag : previous?.tag || tag,
          count: (previous?.count || 0) + 1,
          lastUsedAt: Math.max(previous?.lastUsedAt || 0, lastUsedAt),
        });
      });
    });

  return Array.from(suggestions.values())
    .sort((a, b) => {
      if (query) {
        const aName = a.tag.toLocaleLowerCase();
        const bName = b.tag.toLocaleLowerCase();
        const aMatchRank = aName.startsWith(query) ? 0 : aName.includes(query) ? 1 : 2;
        const bMatchRank = bName.startsWith(query) ? 0 : bName.includes(query) ? 1 : 2;

        if (aMatchRank !== bMatchRank) return aMatchRank - bMatchRank;
      }

      return b.lastUsedAt - a.lastUsedAt
        || b.count - a.count
        || a.tag.localeCompare(b.tag, 'zh-Hans-CN');
    })
    .slice(0, limit);
};

export const applyTagSuggestionToInput = (currentValue: string, tag: string) => (
  Array.from(new Set([...getActiveTagDraft(currentValue).committedTags, tag].map(item => item.trim()).filter(Boolean)))
    .join('、')
);
