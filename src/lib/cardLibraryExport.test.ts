import { describe, expect, it } from 'vitest';
import {
  buildCardLibraryPdfLines,
  exportCardLibraryToCsv,
  exportCardLibraryToMarkdown,
  getCardLibraryExportBaseName,
} from './cardLibraryExport';
import type { CardLibraryExportItem } from './cardLibraryExport';

const createItem = (overrides: Partial<CardLibraryExportItem> = {}): CardLibraryExportItem => ({
  card: {
    id: 'ar00',
    name: '愚者',
    english: 'The Fool',
    default_numerology: 0,
    astrology: {
      planet: '天王星',
      house: '第零宫',
      element: '风',
    },
  },
  arcanaLabel: '大阿尔卡纳',
  suitLabel: '',
  numerology: '0 - 无限可能',
  keywords: ['自由', '开始'],
  uprightMeaning: '新的开始\n保持开放。',
  reversedMeaning: '轻率、缺少方向。',
  personalNotes: '我自己的第一条注解。',
  readingCount: 2,
  dailyFortuneTotal: 3,
  dailyFortuneCurrentMonth: 1,
  dailyFortuneSavedExamples: 1,
  ...overrides,
});

describe('card library export', () => {
  it('creates a safe nickname based file name', () => {
    expect(getCardLibraryExportBaseName('阿/若*阁主', new Date('2026-07-23T10:00:00.000Z')))
      .toBe('阿-若-阁主-牌义注疏-2026-07-23');
  });

  it('exports csv with card meanings, personal notes and review counts', () => {
    const csv = exportCardLibraryToCsv([createItem()]);

    expect(csv).toContain('"牌名","英文名","牌类"');
    expect(csv).toContain('"愚者"');
    expect(csv).toContain('"新的开始\n保持开放。"');
    expect(csv).toContain('"我自己的第一条注解。"');
    expect(csv).toContain('"3","1","1"');
  });

  it('exports markdown as a readable card booklet', () => {
    const markdown = exportCardLibraryToMarkdown([createItem()], '阿若', '当前筛选 1 张');

    expect(markdown).toContain('# 阿若的牌义注疏');
    expect(markdown).toContain('导出范围：当前筛选 1 张');
    expect(markdown).toContain('## 愚者｜The Fool');
    expect(markdown).toContain('### 正位');
    expect(markdown).toContain('我自己的第一条注解。');
  });

  it('builds pdf lines with scope, correspondences and card notes', () => {
    const lines = buildCardLibraryPdfLines([createItem()], '阿若', '全部牌库 78 张');
    const text = lines.map(line => line.text).join('\n');

    expect(text).toContain('阿若的牌义注疏');
    expect(text).toContain('导出范围：全部牌库 78 张');
    expect(text).toContain('愚者｜The Fool');
    expect(text).toContain('行星 天王星');
    expect(text).toContain('个人注解：我自己的第一条注解。');
  });
});
