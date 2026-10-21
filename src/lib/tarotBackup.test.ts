import { describe, expect, it } from 'vitest';
import { INITIAL_READINGS, OFFICIAL_SPREADS } from '../constants';
import type { TarotBackupData } from '../types';
import { backupStorageEntries, createTarotBackup, mergeTarotBackup, parseTarotBackup, readLocalBackupData } from './tarotBackup';

const data = (): TarotBackupData => ({
  readings: [{ ...INITIAL_READINGS[0], id: 'one', userId: 'foreign-user', isExample: false, isPublic: true,
    cardInterpretations: ['原来的解读'], userFeedback: '原来的复盘',
    slotPositions: ['col-start-3 row-start-2'],
  }],
  fortunes: [{ id: 'day', userId: 'foreign-user', date: '2026-10-21', cardName: '隐士', isReversed: true,
    interpretation: '日运解读', keywords: ['安静'], dailyReview: '今天的回看', createdAt: '2026-10-21T10:00:00Z' }],
  spreads: [...OFFICIAL_SPREADS, { name: '我的布局', layout: 'free', slots: ['第一张'], freePositions: [{ x: 12.25, y: -25, rotation: 17, scale: 0.8 }] }],
  cardMetadata: [{ id: 'ar09', name: '隐士', english: 'The Hermit', keywords: ['我的关键词'] }],
  cardKeywordMemory: [{ cardName: '隐士', keywords: [{ keyword: '独处', count: 2, readingIds: ['one'], examples: ['例子'], createdAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-21T10:00:00Z' }], updatedAt: '2026-10-21T10:00:00Z' }],
  quizMemory: [{ cardId: 'ar09', cardName: '隐士', practiceCount: 1, unfamiliarCount: 0, wrongCount: 0, repeated: true, createdAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-21T10:00:00Z' }],
  annotations: { ar09: { personalNotes: '笔记', personalMeaning: '自己的理解' } },
  numerology: { 隐士: { numerology: 9, meaning: '灵数理解', keywords: '自己的词' } },
});
const empty = (): TarotBackupData => ({ readings: [], fortunes: [], spreads: OFFICIAL_SPREADS, cardMetadata: [], cardKeywordMemory: [], quizMemory: [], annotations: {}, numerology: {} });

describe('portable learning backup', () => {
  it('reads only the current owner local snapshot and preserves explicit cache coverage in files', () => {
    localStorage.clear();
    localStorage.setItem('tarot_readings_one', JSON.stringify(data().readings));
    localStorage.setItem('tarot_daily_fortunes_two', JSON.stringify(data().fortunes));
    const local = readLocalBackupData('one');
    expect(local.readings).toHaveLength(1);
    expect(local.fortunes).toHaveLength(0);
    const backup = createTarotBackup(local, { numerologyCoverage: 'cached', numerologyCheckedAt: '2026-10-21T01:00:00Z' });
    expect(parseTarotBackup(JSON.stringify(backup))).toMatchObject({ numerologyCoverage: 'cached', numerologyCheckedAt: '2026-10-21T01:00:00Z' });
    expect(readLocalBackupData('guest').readings).toEqual([]);
  });
  it('round trips all saved study data without credentials, user IDs or official spread copies', () => {
    const backup = createTarotBackup(data());
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toContain('foreign-user');
    const parsed = parseTarotBackup(serialized);
    expect(parsed.data.spreads).toEqual(data().spreads.slice(-1));
    expect(parsed.data.readings[0].cardInterpretations).toEqual(['原来的解读']);
    expect(parsed.data.fortunes[0].dailyReview).toBe('今天的回看');
    expect(parsed.data.annotations).toEqual(data().annotations);
    expect(parsed.data.numerology).toEqual(data().numerology);
    expect(parsed.data.quizMemory).toEqual(data().quizMemory);
  });
  it('rebinds imported records privately without altering coordinates or source data', () => {
    const incoming = parseTarotBackup(JSON.stringify(createTarotBackup(data()))).data;
    const before = JSON.stringify(incoming);
    const restored = mergeTarotBackup(empty(), incoming, 'current-user', '现在的名字');
    expect(restored.readings[0]).toMatchObject({ isPublic: false, isAnonymous: false, userId: 'current-user', authorName: '现在的名字', slotPositions: data().readings[0].slotPositions });
    expect(restored.spreads.slice(0, OFFICIAL_SPREADS.length)).toEqual(OFFICIAL_SPREADS);
    expect(restored.spreads.at(-1)?.freePositions).toEqual(data().spreads.at(-1)?.freePositions);
    expect(restored.annotations.ar09.userId).toBe('current-user');
    expect(JSON.stringify(incoming)).toBe(before);
  });
  it('supports actual saved editor records that omit the legacy summary field', () => {
    const current = data();
    delete (current.readings[0].interpretation as Partial<typeof current.readings[0]['interpretation']>).summary;
    const backup = parseTarotBackup(JSON.stringify(createTarotBackup(current)));
    expect(backup.data.readings[0].interpretation.summary).toBe('');
    expect(backup.data.readings[0].cardInterpretations).toEqual(['原来的解读']);
  });
  it('is idempotent and never overwrites existing records or tombstones', () => {
    const current = data();
    current.readings[0].question = '当前版本';
    current.annotations.ar09 = { deletedAt: '2026-10-21T12:00:00Z' };
    const restored = mergeTarotBackup(current, data(), 'current-user', '我');
    expect(restored.readings[0].question).toBe('当前版本');
    expect(restored.annotations.ar09).toEqual(current.annotations.ar09);
    expect(mergeTarotBackup(restored, data(), 'current-user', '我')).toEqual(restored);
  });
  it('renames a conflicting custom layout once and remaps only new readings', () => {
    const current = data();
    const incoming = data();
    incoming.readings[0].id = 'another'; incoming.readings[0].spread = '我的布局';
    incoming.spreads.at(-1)!.freePositions![0].x = 333;
    const restored = mergeTarotBackup(current, incoming, 'current-user', '我');
    expect(restored.spreads.at(-1)?.name).toBe('我的布局（备份1）');
    expect(restored.spreads.at(-1)?.freePositions?.[0].x).toBe(333);
    expect(restored.readings.find(item => item.id === 'another')?.spread).toBe('我的布局（备份1）');
    expect(mergeTarotBackup(restored, incoming, 'current-user', '我')).toEqual(restored);
  });
  it.each(['not json', '{}', '{"format":"tarot-pavilion-backup","version":1}', '{"__proto__":{"role":"owner"}}'])('rejects invalid files: %s', content => {
    expect(() => parseTarotBackup(content)).toThrow();
  });
  it('rejects invalid nested shapes, duplicate IDs, oversized and future files', () => {
    const backup = createTarotBackup(data());
    expect(() => parseTarotBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow('版本');
    expect(() => parseTarotBackup(JSON.stringify({ ...backup, data: { ...backup.data, readings: [{ ...backup.data.readings[0], cards: null }] } }))).toThrow();
    expect(() => parseTarotBackup(JSON.stringify({ ...backup, data: { ...backup.data, readings: [backup.data.readings[0], backup.data.readings[0]] } }))).toThrow();
    expect(() => parseTarotBackup(' '.repeat(21 * 1024 * 1024))).toThrow('20MB');
  });
  it('does not restore unknown fields or role/moderation data', () => {
    const backup = createTarotBackup(data());
    Object.assign(backup.data.readings[0], { role: 'owner', password: 'secret', moderatedBy: 'author' });
    const parsed = parseTarotBackup(JSON.stringify(backup));
    expect(parsed.data.readings[0]).not.toHaveProperty('role');
    expect(parsed.data.readings[0]).not.toHaveProperty('password');
    expect(parsed.data.readings[0]).not.toHaveProperty('moderatedBy');
  });
  it('writes only the active account stores and never includes other accounts or auth', () => {
    expect(Object.keys(backupStorageEntries(data(), 'current-user'))).toEqual([
      'tarot_readings_current-user', 'tarot_daily_fortunes_current-user', 'tarot_spreads_current-user',
      'tarot_card_metadata_current-user', 'tarot_card_keyword_memory_current-user', 'tarot_quiz_memory_current-user',
      'tarot_user_annotations_current-user', 'tarot_numerology_restore_current-user',
    ]);
    expect(backupStorageEntries(data(), 'guest')).toHaveProperty('tarot_guest_data');
  });
});
