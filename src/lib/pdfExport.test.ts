import { describe, expect, it } from 'vitest';
import { TarotReading } from '../types';
import { buildTarotExportLines, TarotExportData } from './pdfExport';

const createReading = (overrides: Partial<TarotReading> = {}): TarotReading => ({
  id: 'reading-1',
  userId: 'user-1',
  date: '2026-07-01T08:00:00.000Z',
  readingDate: '2026-07-01T08:00:00.000Z',
  question: '我今天需要留意什么？',
  spread: '单牌阵',
  cards: [{ name: '女祭司', isReversed: false, label: '今日提示' }],
  interpretation: {
    singleCard: '倾听直觉。',
    combination: '',
    summary: '把注意力收回到内心。',
  },
  keywords: ['日运'],
  isPublic: false,
  authorName: '研习者',
  isAnonymous: false,
  isForClient: false,
  category: '日运',
  ...overrides,
});

const createExportData = (overrides: Partial<TarotExportData> = {}): TarotExportData => ({
  readings: [createReading()],
  spreads: [{ name: '单牌阵', layout: 'horizontal', slots: ['主牌'] }],
  cardMetadata: [{
    id: 'ar02',
    name: '女祭司',
    english: 'The High Priestess',
    keywords: ['直觉'],
    meaning: '静听内在。',
    reversedMeaning: '过度沉默。',
  }],
  profile: {
    id: 'user-1',
    display_name: 'Roxy',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  exportDate: '2026-07-03T08:00:00.000Z',
  version: '1.2.0',
  ...overrides,
});

describe('pdf export content', () => {
  it('includes personal readings, cards, spreads, and customized card meanings', () => {
    const text = buildTarotExportLines(createExportData()).map(line => line.text).join('\n');

    expect(text).toContain('塔罗研习阁数据导出');
    expect(text).toContain('我今天需要留意什么？');
    expect(text).toContain('今日提示：女祭司（正位）');
    expect(text).toContain('单牌阵');
    expect(text).toContain('关键词：直觉');
  });

  it('does not include example readings in the exported reading section', () => {
    const text = buildTarotExportLines(createExportData({
      readings: [
        createReading({ id: 'example-reading', question: '示例问题', isExample: true }),
        createReading({ id: 'real-reading', question: '真实记录' }),
      ],
    })).map(line => line.text).join('\n');

    expect(text).not.toContain('示例问题');
    expect(text).toContain('真实记录');
  });
});
