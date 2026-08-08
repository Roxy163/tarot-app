import { TarotCardMetadata } from '../types';
import type { ExportLine } from './pdfExport';

export type CardLibraryExportScope = 'current' | 'all';

export interface CardLibraryExportItem {
  card: TarotCardMetadata;
  arcanaLabel: string;
  suitLabel: string;
  numerology: string;
  keywords: string[];
  uprightMeaning: string;
  reversedMeaning: string;
  personalNotes: string;
  readingCount: number;
  dailyFortuneTotal: number;
  dailyFortuneCurrentMonth: number;
  dailyFortuneSavedExamples: number;
}

const safeText = (value: unknown, fallback = '未填写') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const escapeCsv = (value: string | number | undefined) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

export const getSafeCardLibraryFileNamePart = (value: string) => (
  value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 24) || '见习阁主'
);

export const getCardLibraryExportBaseName = (
  ownerName = '见习阁主',
  date = new Date(),
) => (
  `${getSafeCardLibraryFileNamePart(ownerName)}-牌义注疏-${date.toISOString().split('T')[0]}`
);

export const getCardLibraryScopeLabel = (
  scope: CardLibraryExportScope,
  count: number,
) => (
  scope === 'all' ? `全部牌库 ${count} 张` : `当前筛选 ${count} 张`
);

export const exportCardLibraryToCsv = (items: CardLibraryExportItem[]) => {
  const header = [
    '牌名',
    '英文名',
    '牌类',
    '牌组',
    '灵数',
    '行星',
    '星座',
    '宫位',
    '元素',
    '关键词',
    '正位释义',
    '逆位释义',
    '个人注解',
    '研习记录数',
    '日运历史',
    '本月日运',
    '日运例证',
  ];

  const rows = items.map(item => [
    item.card.name,
    item.card.english,
    item.arcanaLabel,
    item.suitLabel,
    item.numerology,
    item.card.astrology?.planet || '',
    item.card.astrology?.zodiac || '',
    item.card.astrology?.house || '',
    item.card.astrology?.element || '',
    item.keywords.join('、'),
    item.uprightMeaning,
    item.reversedMeaning,
    item.personalNotes,
    item.readingCount,
    item.dailyFortuneTotal,
    item.dailyFortuneCurrentMonth,
    item.dailyFortuneSavedExamples,
  ]);

  return [header, ...rows]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n');
};

export const exportCardLibraryToMarkdown = (
  items: CardLibraryExportItem[],
  ownerName = '见习阁主',
  scopeLabel = '全部牌库',
) => {
  const lines = [
    `# ${ownerName}的牌义注疏`,
    '',
    '塔罗研习阁 · 把每张牌的对应、关键词与个人理解收成一本手札。',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `导出范围：${scopeLabel}`,
    `牌数：${items.length}`,
    '',
  ];

  if (items.length === 0) {
    lines.push('暂无可导出的牌。');
    return lines.join('\n');
  }

  items.forEach(item => {
    lines.push(
      `## ${item.card.name}${item.card.english ? `｜${item.card.english}` : ''}`,
      '',
      `- 分类：${item.arcanaLabel}${item.suitLabel ? `｜${item.suitLabel}` : ''}`,
      `- 灵数：${safeText(item.numerology)}`,
      `- 对应：行星 ${safeText(item.card.astrology?.planet, '无')}｜星座 ${safeText(item.card.astrology?.zodiac, '无')}｜宫位 ${safeText(item.card.astrology?.house, '无')}｜元素 ${safeText(item.card.astrology?.element, '无')}`,
      `- 关键词：${item.keywords.join('、') || '未填写'}`,
      `- 记录：研习 ${item.readingCount} 条｜日运 ${item.dailyFortuneTotal} 次｜本月 ${item.dailyFortuneCurrentMonth} 次｜例证 ${item.dailyFortuneSavedExamples} 条`,
      '',
      '### 正位',
      safeText(item.uprightMeaning),
      '',
      '### 逆位',
      safeText(item.reversedMeaning),
      '',
    );

    if (item.personalNotes.trim()) {
      lines.push('### 个人注解', item.personalNotes.trim(), '');
    }
  });

  return lines.join('\n');
};

export const buildCardLibraryPdfLines = (
  items: CardLibraryExportItem[],
  ownerName = '见习阁主',
  scopeLabel = '全部牌库',
): ExportLine[] => {
  const annotatedCount = items.filter(item => (
    item.personalNotes.trim()
    || item.keywords.length > 0
    || item.uprightMeaning.trim()
    || item.reversedMeaning.trim()
  )).length;
  const dailyCount = items.reduce((sum, item) => sum + item.dailyFortuneTotal, 0);
  const readingCount = items.reduce((sum, item) => sum + item.readingCount, 0);
  const lines: ExportLine[] = [
    { text: ownerName ? `${ownerName}的牌义注疏` : '塔罗研习阁｜牌义注疏', style: 'title' },
    { text: '塔罗研习阁 · 把每张牌的对应、关键词与个人理解收成一本手札。', style: 'subtitle' },
    { text: `导出时间：${new Date().toLocaleString('zh-CN')}`, style: 'muted', gapBefore: 8 },
    { text: `导出范围：${scopeLabel}`, style: 'muted' },
    { text: `牌数 ${items.length} 张 · 有内容 ${annotatedCount} 张 · 研习记录 ${readingCount} 条 · 日运 ${dailyCount} 次`, style: 'muted' },
    { text: '牌义手札', style: 'section', gapBefore: 18 },
  ];

  if (items.length === 0) {
    lines.push({ text: '暂无可导出的牌。', style: 'body', indent: 12 });
    return lines;
  }

  items.forEach((item, index) => {
    const correspondence = [
      item.card.astrology?.planet ? `行星 ${item.card.astrology.planet}` : '',
      item.card.astrology?.zodiac ? `星座 ${item.card.astrology.zodiac}` : '',
      item.card.astrology?.house ? `宫位 ${item.card.astrology.house}` : '',
      item.card.astrology?.element ? `元素 ${item.card.astrology.element}` : '',
    ].filter(Boolean).join('｜') || '暂无体系对应';

    lines.push({
      text: `${index + 1}. ${item.card.name}${item.card.english ? `｜${item.card.english}` : ''}`,
      style: 'section',
      gapBefore: index === 0 ? 4 : 14,
    });
    lines.push({
      text: `${item.arcanaLabel}${item.suitLabel ? `｜${item.suitLabel}` : ''}｜灵数：${safeText(item.numerology)}｜${correspondence}`,
      style: 'muted',
      indent: 12,
    });
    lines.push({
      text: `关键词：${item.keywords.join('、') || '未填写'}`,
      style: 'body',
      indent: 12,
    });
    lines.push({
      text: `记录：研习 ${item.readingCount} 条｜日运 ${item.dailyFortuneTotal} 次｜本月 ${item.dailyFortuneCurrentMonth} 次｜例证 ${item.dailyFortuneSavedExamples} 条`,
      style: 'muted',
      indent: 12,
    });
    lines.push({ text: `正位：${safeText(item.uprightMeaning)}`, style: 'body', indent: 12, gapBefore: 4 });
    lines.push({ text: `逆位：${safeText(item.reversedMeaning)}`, style: 'body', indent: 12, gapBefore: 4 });
    if (item.personalNotes.trim()) {
      lines.push({ text: `个人注解：${item.personalNotes.trim()}`, style: 'body', indent: 12, gapBefore: 4 });
    }
  });

  return lines;
};
