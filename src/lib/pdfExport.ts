import { SpreadDefinition, TarotCardMetadata, TarotReading, UserProfile } from '../types';

export interface TarotExportData {
  readings: TarotReading[];
  spreads: SpreadDefinition[];
  cardMetadata: TarotCardMetadata[];
  profile: UserProfile | null;
  exportDate: string;
  version: string;
}

export type ExportLineStyle = 'title' | 'subtitle' | 'section' | 'body' | 'muted';

export interface ExportLine {
  text: string;
  style?: ExportLineStyle;
  indent?: number;
  gapBefore?: number;
}

interface PdfPageImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;
const CANVAS_SCALE = 2;
const PAGE_MARGIN = 46;

const safeText = (value: unknown, fallback = '未填写') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatDateTime = (value?: string) => {
  if (!value) return '未知时间';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

const getProfileName = (profile: UserProfile | null) => (
  profile?.display_name || profile?.nickname || profile?.user_public_id || '未登录阁主'
);

const getCardSummary = (reading: TarotReading) => (
  reading.cards.map((card, index) => {
    const label = card.label || card.position || reading.slotLabels?.[index] || `第 ${index + 1} 张`;
    const cardName = safeText(card.name, '未选牌');
    const orientation = card.isReversed ? '逆位' : '正位';
    return `${label}：${cardName}（${orientation}）`;
  })
);

const pushTextBlock = (lines: ExportLine[], label: string, value?: string, indent = 12) => {
  const text = safeText(value, '');
  if (!text) return;

  lines.push({ text: `${label}：${text}`, style: 'body', indent });
};

export const buildTarotExportLines = (data: TarotExportData): ExportLine[] => {
  const readings = data.readings.filter(reading => !reading.isExample);
  const customizedCards = data.cardMetadata.filter(card => (
    card.meaning || card.reversedMeaning || (card.keywords && card.keywords.length > 0)
  ));
  const customSpreads = data.spreads.filter(spread => spread.name && spread.slots.length > 0);
  const lines: ExportLine[] = [
    { text: '塔罗研习阁数据导出', style: 'title' },
    { text: '这份 PDF 用于阅读、复盘与留存。若要恢复导入旧备份，请继续使用 JSON 备份文件。', style: 'subtitle' },
    { text: `导出时间：${formatDateTime(data.exportDate)}`, style: 'muted', gapBefore: 8 },
    { text: `阁主：${getProfileName(data.profile)}`, style: 'muted' },
    { text: `版本：${data.version}`, style: 'muted' },
    { text: `记录 ${readings.length} 条 · 牌阵 ${data.spreads.length} 个 · 自定义牌义 ${customizedCards.length} 张`, style: 'muted' },
    { text: '占卜与研习记录', style: 'section', gapBefore: 20 },
  ];

  if (readings.length === 0) {
    lines.push({ text: '暂无可导出的个人记录。', style: 'body', indent: 12 });
  }

  readings.forEach((reading, index) => {
    lines.push({
      text: `${index + 1}. ${formatDate(reading.readingDate || reading.date)}｜${safeText(reading.question, '未命名问题')}`,
      style: 'section',
      gapBefore: index === 0 ? 4 : 14,
    });
    lines.push({ text: `牌阵：${safeText(reading.spread)}｜分类：${safeText(reading.category, '未分类')}`, style: 'muted', indent: 12 });
    getCardSummary(reading).forEach(cardLine => {
      lines.push({ text: cardLine, style: 'body', indent: 12 });
    });

    if (reading.cardInterpretations?.length) {
      reading.cardInterpretations.forEach((interpretation, cardIndex) => {
        pushTextBlock(lines, `第 ${cardIndex + 1} 张注疏`, interpretation, 12);
      });
    }

    pushTextBlock(lines, '单牌解读', reading.interpretation?.singleCard, 12);
    pushTextBlock(lines, '组合解读', reading.interpretation?.combination, 12);
    pushTextBlock(lines, '总结', reading.interpretation?.summary, 12);
    pushTextBlock(lines, '我的复盘', reading.userFeedback, 12);
    pushTextBlock(lines, '客户反馈', reading.clientFeedback, 12);
  });

  lines.push({ text: '牌阵清单', style: 'section', gapBefore: 20 });
  if (customSpreads.length === 0) {
    lines.push({ text: '暂无牌阵数据。', style: 'body', indent: 12 });
  } else {
    customSpreads.forEach((spread, index) => {
      lines.push({
        text: `${index + 1}. ${spread.name}｜${spread.layout}｜${spread.slots.length} 张牌`,
        style: 'body',
        indent: 12,
      });
      lines.push({ text: `位置：${spread.slots.join('、')}`, style: 'muted', indent: 24 });
    });
  }

  lines.push({ text: '自定义牌义', style: 'section', gapBefore: 20 });
  if (customizedCards.length === 0) {
    lines.push({ text: '暂无自定义牌义。', style: 'body', indent: 12 });
  } else {
    customizedCards.forEach((card, index) => {
      lines.push({
        text: `${index + 1}. ${card.name} ${card.english ? `(${card.english})` : ''}`,
        style: 'body',
        indent: 12,
      });
      if (card.keywords?.length) {
        lines.push({ text: `关键词：${card.keywords.join('、')}`, style: 'muted', indent: 24 });
      }
      pushTextBlock(lines, '正位', card.meaning, 24);
      pushTextBlock(lines, '逆位', card.reversedMeaning, 24);
    });
  }

  return lines;
};

const getStyle = (style: ExportLineStyle = 'body') => {
  switch (style) {
    case 'title':
      return { font: '700 26px "Songti SC", "STSong", "Noto Serif CJK SC", serif', color: '#2f4d3b', lineHeight: 34 };
    case 'subtitle':
      return { font: '400 12px "PingFang SC", "Microsoft YaHei", sans-serif', color: '#7a8a76', lineHeight: 18 };
    case 'section':
      return { font: '700 15px "PingFang SC", "Microsoft YaHei", sans-serif', color: '#3f6f52', lineHeight: 22 };
    case 'muted':
      return { font: '400 10.5px "PingFang SC", "Microsoft YaHei", sans-serif', color: '#7f8a79', lineHeight: 16 };
    case 'body':
    default:
      return { font: '400 11.5px "PingFang SC", "Microsoft YaHei", sans-serif', color: '#2f332e', lineHeight: 18 };
  }
};

const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (!text) return [''];

  const wrapped: string[] = [];
  let current = '';

  Array.from(text).forEach((char) => {
    const next = current + char;
    if (current && context.measureText(next).width > maxWidth) {
      wrapped.push(current);
      current = char.trimStart();
      return;
    }
    current = next;
  });

  if (current) wrapped.push(current);
  return wrapped;
};

const drawPageChrome = (context: CanvasRenderingContext2D, pageNumber: number) => {
  context.fillStyle = '#fbfaf5';
  context.fillRect(0, 0, PAGE_WIDTH_PT, PAGE_HEIGHT_PT);

  const gradient = context.createLinearGradient(0, 0, PAGE_WIDTH_PT, PAGE_HEIGHT_PT);
  gradient.addColorStop(0, 'rgba(63, 111, 82, 0.08)');
  gradient.addColorStop(0.55, 'rgba(212, 175, 55, 0.04)');
  gradient.addColorStop(1, 'rgba(63, 111, 82, 0.03)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, PAGE_WIDTH_PT, PAGE_HEIGHT_PT);

  context.strokeStyle = 'rgba(63, 111, 82, 0.18)';
  context.lineWidth = 1;
  context.strokeRect(24, 24, PAGE_WIDTH_PT - 48, PAGE_HEIGHT_PT - 48);

  context.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  context.beginPath();
  context.moveTo(PAGE_MARGIN, 70);
  context.lineTo(PAGE_WIDTH_PT - PAGE_MARGIN, 70);
  context.stroke();

  context.fillStyle = '#9aa38f';
  context.font = '400 9px "PingFang SC", sans-serif';
  context.textAlign = 'center';
  context.fillText(`塔罗研习阁 · 第 ${pageNumber} 页`, PAGE_WIDTH_PT / 2, PAGE_HEIGHT_PT - 30);
  context.textAlign = 'left';
};

const renderLinesToPageImages = (lines: ExportLine[]): PdfPageImage[] => {
  const pageImages: PdfPageImage[] = [];
  let canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_WIDTH_PT * CANVAS_SCALE);
  canvas.height = Math.round(PAGE_HEIGHT_PT * CANVAS_SCALE);
  let context = canvas.getContext('2d');

  if (!context) {
    throw new Error('当前浏览器无法创建 PDF 画布。');
  }

  const finishPage = () => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    pageImages.push({
      data: base64ToBytes(dataUrl.split(',')[1] || ''),
      width: canvas.width,
      height: canvas.height,
    });
  };

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = Math.round(PAGE_WIDTH_PT * CANVAS_SCALE);
    canvas.height = Math.round(PAGE_HEIGHT_PT * CANVAS_SCALE);
    context = canvas.getContext('2d');
    if (!context) {
      throw new Error('当前浏览器无法创建 PDF 画布。');
    }
    context.scale(CANVAS_SCALE, CANVAS_SCALE);
    drawPageChrome(context, pageImages.length + 1);
  };

  context.scale(CANVAS_SCALE, CANVAS_SCALE);
  drawPageChrome(context, 1);

  const left = PAGE_MARGIN;
  const right = PAGE_WIDTH_PT - PAGE_MARGIN;
  const bottom = PAGE_HEIGHT_PT - 58;
  let y = 52;

  lines.forEach((line) => {
    const style = getStyle(line.style);
    const indent = line.indent || 0;
    const gapBefore = line.gapBefore || 0;

    context!.font = style.font;
    const wrapped = wrapText(context!, line.text, right - left - indent);
    if (y + gapBefore + style.lineHeight > bottom) {
      finishPage();
      startPage();
      y = 88;
    }

    y += gapBefore;
    context!.font = style.font;
    context!.fillStyle = style.color;
    wrapped.forEach((row) => {
      if (y + style.lineHeight > bottom) {
        finishPage();
        startPage();
        y = 88;
        context!.font = style.font;
        context!.fillStyle = style.color;
      }
      context!.fillText(row, left + indent, y);
      y += style.lineHeight;
    });
  });

  finishPage();
  return pageImages;
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const createPdfBlobFromImages = (images: PdfPageImage[]) => {
  const chunks: (Uint8Array | string)[] = [];
  const offsets: number[] = [];
  const encoder = new TextEncoder();
  let byteLength = 0;

  const append = (chunk: Uint8Array | string) => {
    chunks.push(chunk);
    byteLength += typeof chunk === 'string' ? encoder.encode(chunk).length : chunk.length;
  };

  const addObject = (id: number, body: (appendBody: typeof append) => void) => {
    offsets[id] = byteLength;
    append(`${id} 0 obj\n`);
    body(append);
    append('\nendobj\n');
  };

  const pageObjectIds = images.map((_, index) => 3 + index * 3);
  const objectCount = 2 + images.length * 3;

  append('%PDF-1.4\n');

  addObject(1, add => {
    add('<< /Type /Catalog /Pages 2 0 R >>');
  });

  addObject(2, add => {
    add(`<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${images.length} >>`);
  });

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const content = `q\n${PAGE_WIDTH_PT.toFixed(2)} 0 0 ${PAGE_HEIGHT_PT.toFixed(2)} 0 0 cm\n/${imageName} Do\nQ`;

    addObject(pageId, add => {
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT.toFixed(2)} ${PAGE_HEIGHT_PT.toFixed(2)}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });

    addObject(contentId, add => {
      add(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    });

    addObject(imageId, add => {
      add(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`);
      add(image.data);
      add('\nendstream');
    });
  });

  const xrefOffset = byteLength;
  append(`xref\n0 ${objectCount + 1}\n`);
  append('0000000000 65535 f \n');
  for (let id = 1; id <= objectCount; id += 1) {
    append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
};

export const createTarotExportPdfBlob = (data: TarotExportData) => {
  const images = renderLinesToPageImages(buildTarotExportLines(data));
  return createPdfBlobFromImages(images);
};
