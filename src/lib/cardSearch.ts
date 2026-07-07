import { TarotCardMetadata } from '../types';

const SUIT_ALIASES: Record<string, string[]> = {
  wa: ['权杖', '魔杖', '火杖', '杖'],
  cu: ['圣杯', '杯', '水杯'],
  sw: ['宝剑', '剑', '长剑', '风剑'],
  pe: ['星币', '金币', '钱币', '硬币', '五角星', '土币'],
};

const RANK_ALIASES: Record<string, string[]> = {
  ac: ['王牌', '一', '1', 'ace'],
  '02': ['二', '2', 'two'],
  '03': ['三', '3', 'three'],
  '04': ['四', '4', 'four'],
  '05': ['五', '5', 'five'],
  '06': ['六', '6', 'six'],
  '07': ['七', '7', 'seven'],
  '08': ['八', '8', 'eight'],
  '09': ['九', '9', 'nine'],
  '10': ['十', '10', 'ten'],
  pa: ['侍从', '侍者', '男仆', '公主', 'page'],
  kn: ['骑士', 'knight'],
  qu: ['王后', '皇后', '女王', 'queen'],
  ki: ['国王', '皇帝', '王', 'king'],
};

const MAJOR_ALIASES: Record<string, string[]> = {
  ar00: ['愚人', '小丑', 'the fool'],
  ar01: ['魔法师', '术士', 'the magician'],
  ar02: ['女教皇', '女祭师', '高阶女祭司', 'high priestess'],
  ar03: ['女皇', '皇后', 'the empress'],
  ar04: ['大阿皇帝', '大阿尔卡纳皇帝', '皇帝牌', 'the emperor'],
  ar05: ['教宗', '祭司', '主教', 'hierophant'],
  ar06: ['恋人牌', 'the lovers'],
  ar07: ['战车牌', 'chariot'],
  ar08: ['力量牌', 'strength'],
  ar09: ['隐者', '隐士牌', 'hermit'],
  ar10: ['命轮', '幸运之轮', 'wheel of fortune'],
  ar11: ['正义牌', 'justice'],
  ar12: ['吊人', '倒悬者', 'hanged man'],
  ar13: ['死亡', '死神牌', 'death'],
  ar14: ['节制牌', 'temperance'],
  ar15: ['恶魔牌', 'devil'],
  ar16: ['高塔', '塔牌', 'tower'],
  ar17: ['星', '星星牌', 'star'],
  ar18: ['月亮牌', 'moon'],
  ar19: ['太阳牌', 'sun'],
  ar20: ['审判牌', 'judgment', 'judgement'],
  ar21: ['宇宙', '世界牌', 'world'],
};

const normalizeCardSearchText = (value: string) => (
  value
    .toLowerCase()
    .replace(/[·・\s_\-—–,，.。:：'"]/g, '')
    .replace(/大阿尔克那/g, '大阿尔卡纳')
    .replace(/小阿尔克那/g, '小阿尔卡纳')
    .replace(/钱币/g, '星币')
    .replace(/金币/g, '星币')
    .replace(/硬币/g, '星币')
    .replace(/杯子/g, '圣杯')
    .replace(/水杯/g, '圣杯')
    .replace(/魔杖/g, '权杖')
    .replace(/火杖/g, '权杖')
);

const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const CATEGORY_ALIASES = new Set([
  '大阿尔卡纳',
  '大牌',
  '大阿',
  '小阿尔卡纳',
  '小牌',
].map(normalizeCardSearchText));

export const getCardSearchAliases = (card: TarotCardMetadata) => {
  const aliases = [card.id, card.name, card.english];

  if (card.id.startsWith('ar')) {
    aliases.push('大阿尔卡纳', '大牌', '大阿', ...(MAJOR_ALIASES[card.id] || []));
  } else {
    aliases.push('小阿尔卡纳', '小牌');

    const suitKey = card.id.slice(0, 2);
    const rankKey = card.id.slice(2);
    const suitAliases = SUIT_ALIASES[suitKey] || [];
    const rankAliases = RANK_ALIASES[rankKey] || [];

    aliases.push(...suitAliases, ...rankAliases);
    suitAliases.forEach(suit => {
      rankAliases.forEach(rank => {
        aliases.push(`${suit}${rank}`, `${rank}${suit}`);
      });
    });
  }

  return uniq(aliases).map(normalizeCardSearchText);
};

export const cardMatchesSearch = (card: TarotCardMetadata, search: string) => {
  const query = normalizeCardSearchText(search);
  if (!query) return true;

  if ((query.includes('大阿尔卡纳') || query.startsWith('大阿')) && !card.id.startsWith('ar')) {
    return false;
  }

  if ((query.includes('小阿尔卡纳') || query.startsWith('小阿')) && card.id.startsWith('ar')) {
    return false;
  }

  return getCardSearchAliases(card).some(alias => {
    if (alias.includes(query)) return true;
    if (CATEGORY_ALIASES.has(alias)) return false;

    return alias.length >= 3 && query.includes(alias);
  });
};

export const getCardSearchHint = (card: TarotCardMetadata) => (
  getCardSearchAliases(card).slice(0, 8).join(' ')
);
