import { TarotReading } from '../types';
import type { ExportLine } from './pdfExport';

export interface ReadingReviewStats {
  totalCount: number;
  reviewedCount: number;
  unreviewedCount: number;
  clientCount: number;
  selfCount: number;
  publicCount: number;
  aiProcessedCount: number;
}

export interface ReadingCardFrequency {
  cardName: string;
  count: number;
  uprightCount: number;
  reversedCount: number;
}

const cleanReadings = (readings: TarotReading[]) => (
  readings.filter(reading => !reading.isExample)
);

export const sortReadingsNewestFirst = (readings: TarotReading[]) => (
  cleanReadings(readings).sort((a, b) => (
    new Date(b.updatedAt || b.readingDate || b.date || 0).getTime()
    - new Date(a.updatedAt || a.readingDate || a.date || 0).getTime()
  ))
);

export const getReadingReviewStats = (readings: TarotReading[]): ReadingReviewStats => {
  const items = cleanReadings(readings);

  return {
    totalCount: items.length,
    reviewedCount: items.filter(reading => Boolean(reading.userFeedback?.trim())).length,
    unreviewedCount: items.filter(reading => !reading.userFeedback?.trim()).length,
    clientCount: items.filter(reading => reading.isForClient).length,
    selfCount: items.filter(reading => !reading.isForClient).length,
    publicCount: items.filter(reading => reading.isPublic).length,
    aiProcessedCount: items.filter(reading => reading.isAiProcessed || reading.processedByAi).length,
  };
};

export const getReadingCardFrequencies = (readings: TarotReading[]): ReadingCardFrequency[] => {
  const groups = new Map<string, ReadingCardFrequency>();

  cleanReadings(readings).forEach(reading => {
    reading.cards.forEach(card => {
      const cardName = card.name?.trim();
      if (!cardName) return;

      const previous = groups.get(cardName) || {
        cardName,
        count: 0,
        uprightCount: 0,
        reversedCount: 0,
      };
      previous.count += 1;
      if (card.isReversed) previous.reversedCount += 1;
      else previous.uprightCount += 1;
      groups.set(cardName, previous);
    });
  });

  return Array.from(groups.values()).sort((a, b) => (
    b.count - a.count
    || b.reversedCount - a.reversedCount
    || a.cardName.localeCompare(b.cardName, 'zh-Hans-CN')
  ));
};

const formatDate = (value?: string) => {
  if (!value) return '未知日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const safeText = (value: unknown, fallback = '未填写') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const getReadingDate = (reading: TarotReading) => (
  reading.readingDate || reading.date
);

const getAudienceLabel = (reading: TarotReading) => (
  reading.isForClient ? `客户：${reading.clientName?.trim() || '未命名客户'}` : '给自己'
);

const getCardLines = (reading: TarotReading) => (
  reading.cards.map((card, index) => {
    const label = card.label || card.position || reading.slotLabels?.[index] || `第${index + 1}张`;
    const direction = card.isReversed ? '逆位' : '正位';
    return `${label}：${safeText(card.name, '未选牌')}（${direction}）`;
  })
);

const escapeCsv = (value: string | number | boolean | undefined) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportReadingsToCsv = (readings: TarotReading[]) => {
  const header = [
    '日期',
    '问题',
    '分类',
    '对象',
    '牌阵',
    '卡牌',
    '关键词',
    '单牌解读',
    '组合解读',
    '总结',
    '我的复盘',
    '客户反馈',
    '是否公开',
    '是否AI整理',
  ];

  const rows = sortReadingsNewestFirst(readings).map(reading => [
    formatDate(getReadingDate(reading)),
    reading.question,
    reading.category || '',
    getAudienceLabel(reading),
    reading.spread,
    getCardLines(reading).join('\n'),
    reading.keywords.join('、'),
    reading.interpretation?.singleCard || '',
    reading.interpretation?.combination || '',
    reading.interpretation?.summary || '',
    reading.userFeedback || '',
    reading.clientFeedback || '',
    reading.isPublic ? '是' : '否',
    reading.isAiProcessed || reading.processedByAi ? '是' : '否',
  ]);

  return [header, ...rows]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n');
};

export const exportReadingsToMarkdown = (
  readings: TarotReading[],
  title = '典籍复盘记录',
  ownerName = '见习阁主',
) => {
  const sorted = sortReadingsNewestFirst(readings);
  const stats = getReadingReviewStats(sorted);
  const lines = [
    `# ${ownerName}的${title}`,
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `记录数量：${stats.totalCount}｜已复盘：${stats.reviewedCount}｜未复盘：${stats.unreviewedCount}`,
    '',
  ];

  sorted.forEach(reading => {
    lines.push(
      `## ${formatDate(getReadingDate(reading))}｜${safeText(reading.question, '未命名问题')}`,
      '',
      `- 对象：${getAudienceLabel(reading)}`,
      `- 牌阵：${safeText(reading.spread)}`,
      `- 分类：${safeText(reading.category, '未分类')}`,
      `- 关键词：${reading.keywords.join('、') || '无'}`,
      '',
      '### 卡牌',
      ...getCardLines(reading).map(line => `- ${line}`),
      '',
      '### 解读',
      `单牌：${safeText(reading.interpretation?.singleCard)}`,
      '',
      `组合：${safeText(reading.interpretation?.combination)}`,
      '',
      `总结：${safeText(reading.interpretation?.summary)}`,
      '',
      '### 复盘',
      reading.userFeedback?.trim() || '未填写',
      '',
    );

    if (reading.clientFeedback?.trim()) {
      lines.push('### 客户反馈', reading.clientFeedback.trim(), '');
    }
  });

  return lines.join('\n');
};

const getTopSpreadStats = (readings: TarotReading[]) => {
  const groups = new Map<string, number>();
  cleanReadings(readings).forEach(reading => {
    const spread = reading.spread?.trim() || '未命名牌阵';
    groups.set(spread, (groups.get(spread) || 0) + 1);
  });

  return Array.from(groups.entries())
    .map(([spread, count]) => ({ spread, count }))
    .sort((a, b) => b.count - a.count || a.spread.localeCompare(b.spread, 'zh-Hans-CN'));
};

export const buildReadingReviewPdfLines = (
  readings: TarotReading[],
  title = '塔罗研习阁｜典籍复盘',
  ownerName = '见习阁主',
): ExportLine[] => {
  const sorted = sortReadingsNewestFirst(readings);
  const stats = getReadingReviewStats(sorted);
  const spreadStats = getTopSpreadStats(sorted).slice(0, 5);
  const cardStats = getReadingCardFrequencies(sorted).slice(0, 8);
  const lines: ExportLine[] = [
    { text: ownerName ? `${ownerName}的典籍复盘` : title, style: 'title' },
    { text: '塔罗研习阁 · 回看每一次抽牌，把问题、牌面与真实反馈放在一起。', style: 'subtitle' },
    { text: `导出时间：${new Date().toLocaleString('zh-CN')}`, style: 'muted', gapBefore: 8 },
    { text: `阁主：${ownerName}`, style: 'muted' },
    {
      text: `记录 ${stats.totalCount} 条 · 已复盘 ${stats.reviewedCount} 条 · 未复盘 ${stats.unreviewedCount} 条 · 客户记录 ${stats.clientCount} 条`,
      style: 'muted',
    },
  ];

  if (spreadStats.length > 0) {
    lines.push({ text: '牌阵概览', style: 'section', gapBefore: 18 });
    spreadStats.forEach(stat => {
      lines.push({ text: `${stat.spread}：${stat.count} 条`, style: 'body', indent: 12 });
    });
  }

  if (cardStats.length > 0) {
    lines.push({ text: '常见牌面', style: 'section', gapBefore: 18 });
    cardStats.forEach(stat => {
      lines.push({
        text: `${stat.cardName}：${stat.count} 次（正位 ${stat.uprightCount} / 逆位 ${stat.reversedCount}）`,
        style: 'body',
        indent: 12,
      });
    });
  }

  lines.push({ text: '复盘手札', style: 'section', gapBefore: 18 });

  if (sorted.length === 0) {
    lines.push({ text: '暂无可导出的典籍记录。', style: 'body', indent: 12 });
    return lines;
  }

  sorted.forEach((reading, index) => {
    lines.push({
      text: `${index + 1}. ${formatDate(getReadingDate(reading))}｜${safeText(reading.question, '未命名问题')}`,
      style: 'section',
      gapBefore: index === 0 ? 4 : 14,
    });
    lines.push({
      text: `${getAudienceLabel(reading)}｜${safeText(reading.spread)}｜${safeText(reading.category, '未分类')}`,
      style: 'muted',
      indent: 12,
    });
    getCardLines(reading).forEach(cardLine => {
      lines.push({ text: cardLine, style: 'body', indent: 12 });
    });

    if (reading.cardInterpretations?.length) {
      reading.cardInterpretations.forEach((interpretation, cardIndex) => {
        if (!interpretation?.trim()) return;
        lines.push({ text: `第${cardIndex + 1}张注疏：${interpretation}`, style: 'body', indent: 12, gapBefore: 4 });
        if (reading.cardQuestions?.[cardIndex]?.trim()) {
          lines.push({ text: `第${cardIndex + 1}张疑问：${reading.cardQuestions[cardIndex]}`, style: 'body', indent: 12, gapBefore: 2 });
        }
      });
    }

    if (reading.interpretation?.singleCard) {
      lines.push({ text: `单牌解读：${reading.interpretation.singleCard}`, style: 'body', indent: 12, gapBefore: 4 });
    }
    if (reading.interpretation?.combination) {
      lines.push({ text: `组合解读：${reading.interpretation.combination}`, style: 'body', indent: 12, gapBefore: 4 });
    }
    if (reading.interpretation?.summary) {
      lines.push({ text: `总结：${reading.interpretation.summary}`, style: 'body', indent: 12, gapBefore: 4 });
    }
    lines.push({
      text: `我的复盘：${reading.userFeedback?.trim() || '未填写'}`,
      style: reading.userFeedback?.trim() ? 'body' : 'muted',
      indent: 12,
      gapBefore: 4,
    });
    if (reading.clientFeedback?.trim()) {
      lines.push({ text: `客户反馈：${reading.clientFeedback}`, style: 'body', indent: 12, gapBefore: 4 });
    }
  });

  return lines;
};
