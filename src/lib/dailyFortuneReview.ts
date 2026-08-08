import { DailyFortune } from '../types';
import type { ExportLine } from './pdfExport';
import {
  getDailyReflectionParts,
  hasDailyReflectionContent,
} from './dailyFortuneReflection';

export interface DailyFortuneCardGroup {
  cardName: string;
  fortunes: DailyFortune[];
  totalCount: number;
  currentMonthCount: number;
  savedToAnnotationCount: number;
  uprightCount: number;
  reversedCount: number;
}

export interface DailyFortuneMonthlyCardStat {
  cardName: string;
  count: number;
  uprightCount: number;
  reversedCount: number;
}

const sortFortunesNewestFirst = (fortunes: DailyFortune[]) => (
  [...fortunes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
);

export const getCurrentMonthKey = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
);

export const getFortunesForMonth = (fortunes: DailyFortune[], monthKey = getCurrentMonthKey()) => (
  sortFortunesNewestFirst(fortunes.filter(fortune => fortune.date.startsWith(monthKey)))
);

export const getDailyFortunesByCard = (
  fortunes: DailyFortune[],
  monthKey = getCurrentMonthKey(),
): DailyFortuneCardGroup[] => {
  const groups = new Map<string, DailyFortune[]>();

  sortFortunesNewestFirst(fortunes).forEach(fortune => {
    const group = groups.get(fortune.cardName) || [];
    group.push(fortune);
    groups.set(fortune.cardName, group);
  });

  return Array.from(groups.entries())
    .map(([cardName, cardFortunes]) => ({
      cardName,
      fortunes: cardFortunes,
      totalCount: cardFortunes.length,
      currentMonthCount: cardFortunes.filter(fortune => fortune.date.startsWith(monthKey)).length,
      savedToAnnotationCount: cardFortunes.filter(fortune => Boolean(fortune.savedToCardAnnotationAt)).length,
      uprightCount: cardFortunes.filter(fortune => !fortune.isReversed).length,
      reversedCount: cardFortunes.filter(fortune => fortune.isReversed).length,
    }))
    .sort((a, b) => (
      b.totalCount - a.totalCount
      || b.currentMonthCount - a.currentMonthCount
      || a.cardName.localeCompare(b.cardName, 'zh-Hans-CN')
    ));
};

export const getDailyFortuneMonthlyCardStats = (
  fortunes: DailyFortune[],
  monthKey = getCurrentMonthKey(),
): DailyFortuneMonthlyCardStat[] => (
  getDailyFortunesByCard(getFortunesForMonth(fortunes, monthKey), monthKey)
    .map(group => ({
      cardName: group.cardName,
      count: group.totalCount,
      uprightCount: group.uprightCount,
      reversedCount: group.reversedCount,
    }))
);

export const getSavedDailyFortuneExamples = (fortunes: DailyFortune[]) => (
  sortFortunesNewestFirst(
    fortunes.filter(fortune => Boolean(fortune.savedToCardAnnotationAt) && hasDailyReflectionContent(fortune))
  )
);

const formatDirection = (fortune: DailyFortune) => (fortune.isReversed ? '逆位' : '正位');

const formatSource = (fortune: DailyFortune) => (
  fortune.source === 'physical-draw' ? '现实抽牌' : '系统抽牌'
);

const getExportReflectionParts = (fortune: DailyFortune) => {
  const parts = getDailyReflectionParts(fortune);
  return {
    initialImpression: parts.initialImpression,
    dailyReview: parts.dailyReview,
  };
};

export const buildDailyFortuneAnnotationNote = (fortune: DailyFortune) => {
  const parts = getExportReflectionParts(fortune);
  return [
    parts.initialImpression ? `第一直觉：${parts.initialImpression}` : '',
    parts.dailyReview ? `今日回看：${parts.dailyReview}` : '',
  ].filter(Boolean).join('\n\n');
};

export const exportDailyFortunesToMarkdown = (
  fortunes: DailyFortune[],
  title = '日运复盘记录',
) => {
  const sorted = sortFortunesNewestFirst(fortunes);
  const lines = [
    `# ${title}`,
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `记录数量：${sorted.length}`,
    '',
  ];

  sorted.forEach(fortune => {
    const parts = getExportReflectionParts(fortune);
    lines.push(
      `## ${fortune.date}｜${fortune.cardName}（${formatDirection(fortune)}）`,
      '',
      `- 来源：${formatSource(fortune)}`,
      `- 关键词：${fortune.keywords.join('、') || '无'}`,
      `- 是否归入牌义注疏：${fortune.savedToCardAnnotationAt ? '是' : '否'}`,
      '',
      `牌面提示：${fortune.interpretation}`,
      '',
      '### 第一直觉',
      parts.initialImpression || '未填写',
      '',
      '### 今日回看',
      parts.dailyReview || '未填写',
      '',
    );
  });

  return lines.join('\n');
};

const escapeCsv = (value: string | number | boolean | undefined) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportDailyFortunesToCsv = (fortunes: DailyFortune[]) => {
  const header = [
    '日期',
    '牌名',
    '正逆位',
    '来源',
    '关键词',
    '第一直觉',
    '今日回看',
    '牌面提示',
    '已归入牌义注疏',
  ];

  const rows = sortFortunesNewestFirst(fortunes).map(fortune => {
    const parts = getExportReflectionParts(fortune);
    return [
      fortune.date,
      fortune.cardName,
      formatDirection(fortune),
      formatSource(fortune),
      fortune.keywords.join('、'),
      parts.initialImpression,
      parts.dailyReview,
      fortune.interpretation,
      fortune.savedToCardAnnotationAt ? '是' : '否',
    ];
  });

  return [header, ...rows]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n');
};

const formatExportDate = (value?: string) => {
  if (!value) return '未知日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const buildDailyFortunePdfLines = (
  fortunes: DailyFortune[],
  title = '塔罗研习阁｜日运复盘',
  ownerName = '见习阁主',
): ExportLine[] => {
  const sorted = sortFortunesNewestFirst(fortunes);
  const savedCount = sorted.filter(fortune => Boolean(fortune.savedToCardAnnotationAt)).length;
  const reversedCount = sorted.filter(fortune => fortune.isReversed).length;
  const cardStats = getDailyFortunesByCard(sorted).slice(0, 6);
  const lines: ExportLine[] = [
    { text: ownerName ? `${ownerName}的日运复盘` : title, style: 'title' },
    { text: '塔罗研习阁 · 回看每天的一张牌，把真实生活归入你的牌义体系。', style: 'subtitle' },
    { text: `导出时间：${new Date().toLocaleString('zh-CN')}`, style: 'muted', gapBefore: 8 },
    { text: `阁主：${ownerName}`, style: 'muted' },
    { text: `记录 ${sorted.length} 天 · 逆位 ${reversedCount} 天 · 已归入注疏 ${savedCount} 条`, style: 'muted' },
  ];

  if (cardStats.length > 0) {
    lines.push({ text: '牌频概览', style: 'section', gapBefore: 18 });
    cardStats.forEach(stat => {
      lines.push({
        text: `${stat.cardName}：${stat.totalCount} 次（正位 ${stat.uprightCount} / 逆位 ${stat.reversedCount}）`,
        style: 'body',
        indent: 12,
      });
    });
  }

  lines.push({ text: '日运手札', style: 'section', gapBefore: 18 });

  if (sorted.length === 0) {
    lines.push({ text: '暂无可导出的日运记录。', style: 'body', indent: 12 });
    return lines;
  }

  sorted.forEach((fortune, index) => {
    const parts = getExportReflectionParts(fortune);
    lines.push({
      text: `${index + 1}. ${formatExportDate(fortune.date)}｜${fortune.cardName}（${formatDirection(fortune)}）`,
      style: 'section',
      gapBefore: index === 0 ? 4 : 14,
    });
    lines.push({
      text: `来源：${formatSource(fortune)}｜关键词：${fortune.keywords.join('、') || '无'}${fortune.savedToCardAnnotationAt ? '｜已归入牌义注疏' : ''}`,
      style: 'muted',
      indent: 12,
    });
    lines.push({ text: `牌面提示：${fortune.interpretation}`, style: 'body', indent: 12 });

    if (parts.initialImpression) {
      lines.push({ text: `第一直觉：${parts.initialImpression}`, style: 'body', indent: 12, gapBefore: 4 });
    }
    if (parts.dailyReview) {
      lines.push({ text: `今日回看：${parts.dailyReview}`, style: 'body', indent: 12, gapBefore: 4 });
    }
    if (!parts.initialImpression && !parts.dailyReview) {
      lines.push({ text: '尚未填写第一直觉或今日回看。', style: 'muted', indent: 12, gapBefore: 4 });
    }
  });

  return lines;
};
