import type { TarotBackup, TarotBackupData } from '../types';
import { LAYOUT_TEMPLATES, OFFICIAL_SPREADS, TAROT_CARDS } from '../constants';
import { readJsonArrayWithBackup, readJsonRecordWithBackup } from './safeLocalStorage';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const fail = (): never => { throw new Error('备份格式不正确或内容不完整，请选择本软件导出的 JSON 备份。'); };
type Validator = (value: unknown) => unknown;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
};
const text: Validator = value => typeof value === 'string' && value.length <= 100000 ? value : fail();
const id: Validator = value => typeof value === 'string' && value.trim() && value.length <= 200 ? value : fail();
const bool: Validator = value => typeof value === 'boolean' ? value : fail();
const number: Validator = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9 ? value : fail();
const date: Validator = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : fail();
const nullable = (check: Validator): Validator => value => value === null ? null : check(value);
const list = (check: Validator, limit = 10000): Validator => value => Array.isArray(value) && value.length <= limit ? value.map(check) : fail();
const oneOf = (...values: unknown[]): Validator => value => values.includes(value) ? value : fail();
const fields = (names: string[], check: Validator) => Object.fromEntries(names.map(name => [name, check]));
const shape = (schema: Record<string, Validator>, required: string[] = []): Validator => value => {
  const source = record(value);
  if (required.some(key => source[key] === undefined)) return fail();
  return Object.fromEntries(Object.entries(schema).filter(([key]) => source[key] !== undefined).map(([key, check]) => [key, check(source[key])]));
};
const slot = shape({ name: text, isReversed: bool, position: text, label: text, isRotated: bool, ...fields(['x', 'y', 'rotation', 'scale'], number) }, ['name', 'isReversed']);
const interpretationFields = shape(fields(['singleCard', 'combination', 'summary', 'numerologyInfluence', 'astrologyInfluence', 'houseInfluence', 'elementInfluence'], text));
const interpretation: Validator = value => ({ singleCard: '', combination: '', summary: '', ...record(interpretationFields(value)) });
const reading = shape({
  ...fields(['id', 'spread'], id), date, question: text, cards: list(slot, 2000), interpretation,
  ...fields(['cardInterpretations', 'cardQuestions', 'keywords', 'manualTags', 'slotLabels', 'slotPositions'], list(text, 2000)),
  ...fields(['isPublic', 'isAnonymous', 'isForClient', 'isAiProcessed', 'processedByAi', 'skipAi', 'showSlotNumbers', 'isExample'], bool),
  ...fields(['authorName', 'authorBio', 'clientName', 'clientFeedback', 'userFeedback', 'aiAnswer', 'choicePathA', 'choicePathB', 'layoutType', 'category'], text),
  ...fields(['updatedAt', 'readingDate', 'aiAnswerUpdatedAt'], date), rotatedSlots: list(number, 2000),
  status: oneOf('draft', 'complete'), aiAnswerMode: oneOf('mentor', 'consultant'),
}, ['id', 'date', 'question', 'spread', 'cards', 'interpretation', 'keywords', 'isPublic', 'isAnonymous', 'authorName']);
const fortune = shape({
  id, date, cardName: id, isReversed: bool, interpretation: text, keywords: list(text),
  ...fields(['initialImpression', 'dailyReview', 'reflection', 'cardAnnotationNote'], text),
  ...fields(['createdAt', 'updatedAt', 'archivedAt', 'savedToCardAnnotationAt'], date),
  source: oneOf('app-draw', 'physical-draw'), isRevealed: bool, isLocked: bool,
}, ['id', 'date', 'cardName', 'isReversed', 'interpretation', 'keywords', 'createdAt']);
const spread = shape({
  name: id, layout: oneOf(...Object.keys(LAYOUT_TEMPLATES), 'grid', 'free'),
  slots: list(text, 2000), slotPositions: list(text, 2000), rotatedSlots: list(number, 2000),
  gridCols: number, gridRows: number,
  freePositions: list(shape(fields(['x', 'y', 'rotation', 'scale'], number)), 2000),
}, ['name', 'layout', 'slots']);
const metadata = shape({
  id, name: id, english: text, default_numerology: nullable(number),
  astrology: shape(fields(['planet', 'zodiac', 'house', 'element'], text)),
  keywords: list(text), meaning: text, reversedMeaning: text,
}, ['id', 'name', 'english']);
const keywordMemory = shape({ cardName: id, updatedAt: date, keywords: list(shape({
  keyword: id, count: number, readingIds: list(id), examples: list(text), createdAt: date, updatedAt: date,
}, ['keyword', 'count', 'readingIds', 'examples', 'createdAt', 'updatedAt'])) }, ['cardName', 'keywords', 'updatedAt']);
const quiz = shape({
  cardId: id, cardName: id, ...fields(['practiceCount', 'unfamiliarCount', 'wrongCount'], number), repeated: bool,
  attempts: list(shape({ id, ...fields(['modeLabel', 'prompt', 'answerLabel', 'selectedLabel'], text), correct: bool, createdAt: date }, ['id', 'createdAt', 'correct'])),
  ...fields(['lastPracticedAt', 'createdAt', 'updatedAt'], date),
}, ['cardId', 'cardName', 'practiceCount', 'unfamiliarCount', 'wrongCount', 'repeated', 'createdAt', 'updatedAt']);
const annotation = shape({
  ...fields(['numerology', 'planet', 'zodiac', 'house', 'element'], nullable(text)),
  ...fields(['uprightMeaning', 'reversedMeaning', 'personalNotes', 'personalMeaning'], text), keywords: list(text),
  ...fields(['createdAt', 'updatedAt', 'deletedAt'], date),
});
const keyed = (allowed: Set<string>, check: Validator): Validator => value => {
  const entries = Object.entries(record(value));
  if (entries.length > 1000 || entries.some(([key]) => !allowed.has(key))) return fail();
  return Object.fromEntries(entries.map(([key, entry]) => [key, check(entry)]));
};
const backupData = shape({
  readings: list(reading), fortunes: list(fortune), spreads: list(spread, 1000),
  cardMetadata: list(metadata, 1000), cardKeywordMemory: list(keywordMemory, 1000), quizMemory: list(quiz, 1000),
  annotations: keyed(new Set(TAROT_CARDS.map(card => card.id)), annotation),
  numerology: keyed(new Set(TAROT_CARDS.map(card => card.name)), shape({ numerology: number, meaning: text, keywords: text }, ['numerology', 'meaning', 'keywords'])),
}, ['readings', 'fortunes', 'spreads', 'cardMetadata', 'cardKeywordMemory', 'quizMemory', 'annotations', 'numerology']);

export function createTarotBackup(data: TarotBackupData, coverage?: Pick<TarotBackup, 'numerologyCoverage' | 'numerologyCheckedAt'>): TarotBackup {
  const savedData = { ...data,
    readings: data.readings.filter(item => !item.isExample),
    spreads: data.spreads.filter(item => !OFFICIAL_SPREADS.some(official => official.name === item.name)),
  };
  const backup: TarotBackup = { format: 'tarot-pavilion-backup', version: 1, exportedAt: new Date().toISOString(), data: backupData(savedData) as TarotBackupData, ...coverage };
  if (new Blob([JSON.stringify(backup, null, 2)]).size > MAX_BACKUP_BYTES) throw new Error('资料超过当前 20MB 备份上限，请先联系作者协助处理。');
  return backup;
}

export function parseTarotBackup(content: string): TarotBackup {
  if (new Blob([content]).size > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 20MB。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content, (key, value) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return fail();
      return value;
    });
  } catch { return fail(); }
  const root = record(parsed);
  if (root.format !== 'tarot-pavilion-backup') return fail();
  if (root.version !== 1) throw new Error('此备份版本暂不支持，请更新软件后重试。');
  date(root.exportedAt);
  const data = backupData(root.data) as TarotBackupData;
  const unique = (keys: string[]) => new Set(keys).size === keys.length;
  if (![data.readings.map(item => item.id), data.fortunes.map(item => item.id), data.spreads.map(item => item.name),
    data.cardMetadata.map(item => item.id), data.cardKeywordMemory.map(item => item.cardName), data.quizMemory.map(item => item.cardId)].every(unique)) return fail();
  const numerologyCoverage = root.numerologyCoverage === undefined ? undefined : oneOf('local', 'cached')(root.numerologyCoverage) as 'local' | 'cached';
  const numerologyCheckedAt = root.numerologyCheckedAt === undefined ? undefined : date(root.numerologyCheckedAt) as string;
  return { format: 'tarot-pavilion-backup', version: 1, exportedAt: root.exportedAt as string, data, numerologyCoverage, numerologyCheckedAt };
}

export function readLocalBackupData(scope: string): TarotBackupData {
  const suffix = scope === 'guest' ? '' : `_${scope}`;
  const annotations = readJsonRecordWithBackup<{ annotations: TarotBackupData['annotations'] }>(`tarot_user_annotations_${scope}`);
  return {
    readings: readJsonArrayWithBackup(scope === 'guest' ? 'tarot_guest_data' : `tarot_readings_${scope}`) || [],
    fortunes: readJsonArrayWithBackup(`tarot_daily_fortunes${suffix}`) || [],
    spreads: readJsonArrayWithBackup(`tarot_spreads${suffix}`) || OFFICIAL_SPREADS,
    cardMetadata: readJsonArrayWithBackup(`tarot_card_metadata${suffix}`) || [],
    cardKeywordMemory: readJsonArrayWithBackup(`tarot_card_keyword_memory${suffix}`) || [],
    quizMemory: readJsonArrayWithBackup(`tarot_quiz_memory${suffix}`) || [],
    annotations: annotations?.annotations || {}, numerology: {},
  };
}

// Existing content wins. Imported handnotes never carry publication or account privileges.
export function mergeTarotBackup(current: TarotBackupData, incoming: TarotBackupData, scope: string, authorName: string): TarotBackupData {
  const now = new Date().toISOString();
  const union = <T,>(local: T[], imported: T[], key: (entry: T) => string) => {
    const existing = new Set(local.map(key));
    return [...local, ...imported.filter(entry => !existing.has(key(entry)))];
  };
  const spreads = [...current.spreads];
  const names = new Map<string, string>();
  for (const entry of incoming.spreads) {
    if (OFFICIAL_SPREADS.some(item => item.name === entry.name)) continue;
    const geometry = (item: typeof entry) => JSON.stringify({ layout: item.layout, slots: item.slots, slotPositions: item.slotPositions,
      rotatedSlots: item.rotatedSlots, gridCols: item.gridCols, gridRows: item.gridRows,
      freePositions: item.freePositions?.map(position => ({ x: position.x, y: position.y, rotation: position.rotation, scale: position.scale })),
    });
    const identical = spreads.find(item => (item.name === entry.name || item.name.startsWith(`${entry.name}（备份`)) && geometry(item) === geometry(entry));
    if (identical) { names.set(entry.name, identical.name); continue; }
    let name = entry.name;
    let suffix = 1;
    while (spreads.some(item => item.name === name)) name = `${entry.name}（备份${suffix++}）`;
    spreads.push({ ...entry, name });
    names.set(entry.name, name);
  }
  const readings = incoming.readings.filter(item => !item.isExample).map(item => ({
    ...item, userId: scope === 'guest' ? '' : scope, authorName, authorBio: undefined,
    isPublic: false, isAnonymous: false, isExample: false, updatedAt: now,
    spread: names.get(item.spread) || item.spread,
  }));
  const annotations = { ...current.annotations };
  Object.entries(incoming.annotations).forEach(([cardId, entry]) => {
    if (!Object.hasOwn(annotations, cardId)) annotations[cardId] = { ...entry, cardId, userId: scope, updatedAt: now };
  });
  return {
    readings: union(current.readings.filter(item => !item.isExample), readings, item => item.id),
    fortunes: union(current.fortunes, incoming.fortunes.map(item => ({ ...item, userId: scope === 'guest' ? '' : scope, updatedAt: now })), item => item.id),
    spreads, cardMetadata: union(current.cardMetadata, incoming.cardMetadata, item => item.id),
    cardKeywordMemory: union(current.cardKeywordMemory, incoming.cardKeywordMemory, item => item.cardName),
    quizMemory: union(current.quizMemory, incoming.quizMemory, item => item.cardId),
    annotations, numerology: { ...incoming.numerology, ...current.numerology },
  };
}

export function backupStorageEntries(data: TarotBackupData, scope: string): Record<string, unknown> {
  const suffix = scope === 'guest' ? '' : `_${scope}`;
  return {
    [scope === 'guest' ? 'tarot_guest_data' : `tarot_readings_${scope}`]: data.readings,
    [`tarot_daily_fortunes${suffix}`]: data.fortunes,
    [`tarot_spreads${suffix}`]: data.spreads,
    [`tarot_card_metadata${suffix}`]: data.cardMetadata,
    [`tarot_card_keyword_memory${suffix}`]: data.cardKeywordMemory,
    [`tarot_quiz_memory${suffix}`]: data.quizMemory,
    [`tarot_user_annotations_${scope}`]: { annotations: data.annotations, userId: scope, version: 1, lastUpdated: new Date().toISOString() },
    [scope === 'guest' ? 'tarot_user_numerology' : `tarot_numerology_restore_${scope}`]: data.numerology,
  };
}
