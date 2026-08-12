import { ReadingKeywordCandidate, TarotReading } from '../types';
import { firebaseAuth } from '../lib/firebase';

interface GeminiRequest {
  prompt: string;
  imageBase64?: string;
  model?: string;
}

const getGeminiHeaders = async () => {
  const token = await firebaseAuth?.currentUser?.getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export async function callGemini({ prompt, imageBase64, model = 'gemini-2.0-flash' }: GeminiRequest) {
  const response = await fetch('/api/gemini-proxy', {
    method: 'POST',
    headers: await getGeminiHeaders(),
    body: JSON.stringify({ prompt, imageBase64, model })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
}

export function extractTextFromResponse(response: any): string {
  try {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch {
    return '';
  }
}

export function extractKeywords(text: string): string[] {
  const keywordSet = new Set<string>();
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      const keyword = normalizeKeyword(trimmed.replace(/^[-•*]\s*/, '').trim());
      if (isUsefulKeyword(keyword)) keywordSet.add(keyword);
    }
  }

  const themeWords = [
    '自由', '冒险', '新开始', '直觉', '秘密', '丰盛', '稳定', '权威', '信任', '选择',
    '胜利', '勇气', '内省', '转变', '结束', '平衡', '节制', '束缚', '欲望', '觉醒',
    '希望', '疗愈', '恐惧', '迷茫', '喜悦', '重生', '完成', '热情', '行动', '等待',
    '协作', '防御', '压力', '关系', '和解', '失落', '疗伤', '沟通', '边界', '焦虑',
    '洞察', '计划', '成长', '坚持', '收获', '安全感', '资源', '现实', '责任', '放下',
    '逃避', '清醒', '犹豫', '掌控', '孤独', '连接', '创造', '机会', '突破', '循环'
  ];

  themeWords.forEach(word => {
    if (text.includes(word)) keywordSet.add(word);
  });

  text
    .split(/[，,。.!！？?；;\n]/)
    .map(normalizeKeyword)
    .filter(isUsefulKeyword)
    .slice(0, 8)
    .forEach(keyword => keywordSet.add(keyword));

  return Array.from(keywordSet).slice(0, 12);
}

const keywordStopPatterns = [
  /^(总的来说|总体来说|简单来说|换句话说)$/,
  /^(一开始|到最后|最后|然后|因为|所以|只是|但是|而且|并且|其实)$/,
  /^(总的来说|总体来说|简单来说|换句话说|一开始|经过|最后|然后|因为|所以|只是|但是|而且|并且|其实)/,
  /(什么|哪些|怎么|如何|是不是|会不会)/,
  /(不必特别|不用特别|没必要特别|活在当下)$/,
];

const normalizeKeyword = (value: string) => value
  .replace(/^#+/, '')
  .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
  .replace(/^(关键词|主题|感受|理解|体悟)[:：]\s*/, '')
  .trim();

const isUsefulKeyword = (value: string) => {
  const keyword = normalizeKeyword(value).replace(/\s+/g, '');
  if (keyword.length < 2 || keyword.length > 8) return false;
  if (/[，,。.!！？?；;：:]/.test(keyword)) return false;
  if (keywordStopPatterns.some(pattern => pattern.test(keyword))) return false;
  return true;
};

const normalizeCardName = (value: string) => normalizeKeyword(value)
  .replace(/[（(]\s*(正位|逆位)\s*[）)]/g, '')
  .trim();

const getCardKeywordSource = (reading: TarotReading, index: number) => {
  const directInsight = reading.cardInterpretations?.[index]?.trim();
  if (directInsight) return directInsight;

  if ((reading.cards?.length || 0) <= 1) {
    return (reading.interpretation?.singleCard || reading.interpretation?.combination || '').trim();
  }

  return '';
};

const buildKeywordReadingText = (reading: TarotReading) => [
  `问题：${reading.question || ''}`,
  ...(reading.cards || []).map((card, index) => {
    const label = reading.slotLabels?.[index] || `位置 ${index + 1}`;
    const direction = card.isReversed ? '逆位' : '正位';
    const insight = getCardKeywordSource(reading, index);
    return `${label}：${card.name}（${direction}）\n逐牌注疏：${insight || '未填写'}`;
  })
].filter(Boolean).join('\n\n');

const parseKeywordSuggestions = (rawText: string, reading: TarotReading): ReadingKeywordCandidate[] => {
  const jsonText = rawText.match(/\[[\s\S]*\]/)?.[0] || rawText.match(/\{[\s\S]*\}/)?.[0] || rawText;
  const parsed = JSON.parse(jsonText);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cards) ? parsed.cards : [];
  const candidates: ReadingKeywordCandidate[] = [];

  rows.forEach((row: any) => {
    const cardName = normalizeCardName(String(row.cardName || row.card || row.name || ''));
    const keywords = Array.isArray(row.keywords)
      ? row.keywords
      : Array.isArray(row.items)
        ? row.items
        : row.keyword
          ? [row.keyword]
          : [];

    keywords.forEach((keywordValue: unknown) => {
      const keyword = normalizeKeyword(String(keywordValue || ''));
      if (!cardName || !isUsefulKeyword(keyword)) return;
      candidates.push({
        id: `${reading.id}-${cardName}-${keyword}-${candidates.length}`,
        cardName,
        keyword,
        sourceText: row.sourceText || row.reason || undefined
      });
    });
  });

  return dedupeCandidates(candidates, reading);
};

const dedupeCandidates = (candidates: ReadingKeywordCandidate[], reading: TarotReading) => {
  const knownCardNames = (reading.cards || []).map(card => card.name);
  const knownCards = new Set(knownCardNames);
  const seen = new Set<string>();

  return candidates
    .map(candidate => {
      const normalizedCardName = normalizeCardName(candidate.cardName);
      const matchedCardName = knownCardNames.find(cardName => (
        normalizedCardName === cardName ||
        normalizedCardName.includes(cardName) ||
        cardName.includes(normalizedCardName)
      ));

      return {
        ...candidate,
        cardName: matchedCardName || normalizedCardName
      };
    })
    .filter(candidate => knownCards.size === 0 || knownCards.has(candidate.cardName))
    .filter(candidate => {
      const key = `${candidate.cardName}::${candidate.keyword}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24)
    .map((candidate, index) => ({
      ...candidate,
      id: candidate.id || `${reading.id}-keyword-${index}`
    }));
};

const fallbackKeywordCandidates = (reading: TarotReading): ReadingKeywordCandidate[] => {
  const cards = reading.cards || [];

  return dedupeCandidates(cards.flatMap((card, index) => {
    const cardInsight = getCardKeywordSource(reading, index);
    if (!cardInsight) return [];

    const cardKeywords = extractKeywords(cardInsight);

    return cardKeywords.slice(0, 6).map((keyword, keywordIndex) => ({
      id: `${reading.id}-${index}-${keywordIndex}`,
      cardName: card.name,
      keyword
    }));
  }), reading);
};

export async function suggestReadingKeywords(reading: TarotReading): Promise<ReadingKeywordCandidate[]> {
  const cards = reading.cards || [];
  if (cards.length === 0) return [];
  const hasKeywordSource = cards.some((_, index) => !!getCardKeywordSource(reading, index));
  if (!hasKeywordSource) return [];

  const readingText = buildKeywordReadingText(reading).slice(0, 3600);
  const cardLines = cards.map((card, index) => {
    const label = reading.slotLabels?.[index] || `位置 ${index + 1}`;
    return `${label}：${card.name}${card.isReversed ? '（逆位）' : '（正位）'}`;
  }).join('\n');

  const prompt = `你是塔罗研习笔记助手。请只从每张牌下面的“逐牌注疏”里提取“用户自己对这张牌的理解关键词”。不要从问题、组合解读、整体总结、复盘或其他上下文里提取。

要求：
1. 每张出现的牌给 2-5 个关键词，短语 2-8 个中文字符。
2. 关键词要适合进入个人牌义记忆系统，例如“冒险冲动”“需要边界”“关系修复”。
 3. 不要提取口水话、连接词、句首语或完整句子，例如“总的来说”“最后”“只是活在当下”“哪些抵抗”。
 4. 如果某张牌的逐牌注疏里没有可沉淀的关键词，该牌返回空数组。
 5. 只返回 JSON，不要解释，不要 markdown。
 6. JSON 格式：
[
  {"cardName":"牌名","keywords":["关键词1","关键词2"],"sourceText":"可选，最能支持这些词的一小段原文"}
]

本次牌面：
${cardLines}

用户手记：
${readingText}`;

  try {
    const response = await callGemini({ prompt });
    const text = extractTextFromResponse(response);
    const suggestions = parseKeywordSuggestions(text, reading);
    if (suggestions.length > 0) return suggestions;
  } catch (error) {
    console.warn('Keyword suggestion fell back to local extraction:', error);
  }

  return fallbackKeywordCandidates(reading);
}

export async function recognizeCards(imageBase64: string): Promise<string> {
  const prompt = '请识别这张图片中的塔罗牌，告诉我牌名和正逆位。只返回牌名，每行一张，格式如：愚者(正位)';

  const response = await fetch('/api/gemini-proxy', {
    method: 'POST',
    headers: await getGeminiHeaders(),
    body: JSON.stringify({ prompt, imageBase64 })
  });
  if (!response.ok) throw new Error('Card recognition failed');
  const data = await response.json();
  return extractTextFromResponse(data);
}
