import { TarotCardMetadata } from './types';

export const TAROT_CARDS: TarotCardMetadata[] = [
  // Major Arcana
  { id: 'ar00', name: '愚者', english: 'The Fool', default_numerology: 0, astrology: { planet: '天王星', element: '风', house: '第零宫' } },
  { id: 'ar01', name: '魔术师', english: 'The Magician', default_numerology: 1, astrology: { planet: '水星', element: '风', house: '第一宫' } },
  { id: 'ar02', name: '女祭司', english: 'The High Priestess', default_numerology: 2, astrology: { planet: '月亮', element: '水', house: '第二宫' } },
  { id: 'ar03', name: '皇后', english: 'The Empress', default_numerology: 3, astrology: { planet: '金星', element: '土', house: '第三宫' } },
  { id: 'ar04', name: '皇帝', english: 'The Emperor', default_numerology: 4, astrology: { zodiac: '白羊座', element: '火', house: '第四宫' } },
  { id: 'ar05', name: '教皇', english: 'The Hierophant', default_numerology: 5, astrology: { zodiac: '金牛座', element: '土', house: '第五宫' } },
  { id: 'ar06', name: '恋人', english: 'The Lovers', default_numerology: 6, astrology: { zodiac: '双子座', element: '风', house: '第六宫' } },
  { id: 'ar07', name: '战车', english: 'The Chariot', default_numerology: 7, astrology: { zodiac: '巨蟹座', element: '水', house: '第七宫' } },
  { id: 'ar08', name: '力量', english: 'Strength', default_numerology: 8, astrology: { zodiac: '狮子座', element: '火', house: '第八宫' } },
  { id: 'ar09', name: '隐士', english: 'The Hermit', default_numerology: 9, astrology: { zodiac: '处女座', element: '土', house: '第九宫' } },
  { id: 'ar10', name: '命运之轮', english: 'The Wheel of Fortune', default_numerology: 10, astrology: { planet: '木星', element: '火', house: '第十宫' } },
  { id: 'ar11', name: '正义', english: 'Justice', default_numerology: 11, astrology: { zodiac: '天秤座', element: '风', house: '第十一宫' } },
  { id: 'ar12', name: '倒吊人', english: 'The Hanged Man', default_numerology: 12, astrology: { planet: '海王海星', element: '水', house: '第十二宫' } },
  { id: 'ar13', name: '死神', english: 'Death', default_numerology: 13, astrology: { zodiac: '天蝎座', element: '水', house: '第八宫' } },
  { id: 'ar14', name: '节制', english: 'Temperance', default_numerology: 14, astrology: { zodiac: '射手座', element: '火', house: '第九宫' } },
  { id: 'ar15', name: '恶魔', english: 'The Devil', default_numerology: 15, astrology: { zodiac: '摩羯座', element: '土', house: '第十宫' } },
  { id: 'ar16', name: '塔', english: 'The Tower', default_numerology: 16, astrology: { planet: '火星', element: '火', house: '第一宫' } },
  { id: 'ar17', name: '星星', english: 'The Star', default_numerology: 17, astrology: { zodiac: '水瓶座', element: '风', house: '第十一宫' } },
  { id: 'ar18', name: '月亮', english: 'The Moon', default_numerology: 18, astrology: { zodiac: '双鱼座', element: '水', house: '第十二宫' } },
  { id: 'ar19', name: '太阳', english: 'The Sun', default_numerology: 19, astrology: { planet: '太阳', element: '火', house: '第五宫' } },
  { id: 'ar20', name: '审判', english: 'Judgement', default_numerology: 20, astrology: { planet: '冥王星', element: '火', house: '第十宫' } },
  { id: 'ar21', name: '世界', english: 'The World', default_numerology: 21, astrology: { planet: '土星', element: '土', house: '第十宫' } },
  
  // Wands (Fire)
  { id: 'waac', name: '权杖王牌', english: 'Ace of Wands', default_numerology: 1, astrology: { element: '火', house: '第一宫' } },
  { id: 'wa02', name: '权杖二', english: 'Two of Wands', default_numerology: 2, astrology: { zodiac: '白羊座', planet: '火星', element: '火', house: '第一宫' } },
  { id: 'wa03', name: '权杖三', english: 'Three of Wands', default_numerology: 3, astrology: { zodiac: '白羊座', planet: '太阳', element: '火', house: '第一宫' } },
  { id: 'wa04', name: '权杖四', english: 'Four of Wands', default_numerology: 4, astrology: { zodiac: '白羊座', planet: '金星', element: '火', house: '第一宫' } },
  { id: 'wa05', name: '权杖五', english: 'Five of Wands', default_numerology: 5, astrology: { zodiac: '狮子座', planet: '土星', element: '火', house: '第五宫' } },
  { id: 'wa06', name: '权杖六', english: 'Six of Wands', default_numerology: 6, astrology: { zodiac: '狮子座', planet: '木星', element: '火', house: '第五宫' } },
  { id: 'wa07', name: '权杖七', english: 'Seven of Wands', default_numerology: 7, astrology: { zodiac: '狮子座', planet: '火星', element: '火', house: '第五宫' } },
  { id: 'wa08', name: '权杖八', english: 'Eight of Wands', default_numerology: 8, astrology: { zodiac: '射手座', planet: '水星', element: '火', house: '第九宫' } },
  { id: 'wa09', name: '权杖九', english: 'Nine of Wands', default_numerology: 9, astrology: { zodiac: '射手座', planet: '月亮', element: '火', house: '第九宫' } },
  { id: 'wa10', name: '权杖十', english: 'Ten of Wands', default_numerology: 10, astrology: { zodiac: '射手座', planet: '土星', element: '火', house: '第九宫' } },
  { id: 'wapa', name: '权杖侍从', english: 'Page of Wands', default_numerology: null, astrology: { element: '火', house: '第一宫' } },
  { id: 'wakn', name: '权杖骑士', english: 'Knight of Wands', default_numerology: null, astrology: { zodiac: '射手座', element: '火', house: '第九宫' } },
  { id: 'waqu', name: '权杖王后', english: 'Queen of Wands', default_numerology: null, astrology: { zodiac: '白羊座', element: '火', house: '第一宫' } },
  { id: 'waki', name: '权杖国王', english: 'King of Wands', default_numerology: null, astrology: { zodiac: '狮子座', element: '火', house: '第五宫' } },

  // Cups (Water)
  { id: 'cuac', name: '圣杯王牌', english: 'Ace of Cups', default_numerology: 1, astrology: { element: '水', house: '第四宫' } },
  { id: 'cu02', name: '圣杯二', english: 'Two of Cups', default_numerology: 2, astrology: { zodiac: '巨蟹座', planet: '金星', element: '水', house: '第四宫' } },
  { id: 'cu03', name: '圣杯三', english: 'Three of Cups', default_numerology: 3, astrology: { zodiac: '巨蟹座', planet: '木星', element: '水', house: '第四宫' } },
  { id: 'cu04', name: '圣杯四', english: 'Four of Cups', default_numerology: 4, astrology: { zodiac: '巨蟹座', planet: '月亮', element: '水', house: '第四宫' } },
  { id: 'cu05', name: '圣杯五', english: 'Five of Cups', default_numerology: 5, astrology: { zodiac: '天蝎座', planet: '火星', element: '水', house: '第八宫' } },
  { id: 'cu06', name: '圣杯六', english: 'Six of Cups', default_numerology: 6, astrology: { zodiac: '天蝎座', planet: '太阳', element: '水', house: '第八宫' } },
  { id: 'cu07', name: '圣杯七', english: 'Seven of Cups', default_numerology: 7, astrology: { zodiac: '天蝎座', planet: '金星', element: '水', house: '第八宫' } },
  { id: 'cu08', name: '圣杯八', english: 'Eight of Cups', default_numerology: 8, astrology: { zodiac: '双鱼座', planet: '土星', element: '水', house: '第十二宫' } },
  { id: 'cu09', name: '圣杯九', english: 'Nine of Cups', default_numerology: 9, astrology: { zodiac: '双鱼座', planet: '木星', element: '水', house: '第十二宫' } },
  { id: 'cu10', name: '圣杯十', english: 'Ten of Cups', default_numerology: 10, astrology: { zodiac: '双鱼座', planet: '火星', element: '水', house: '第十二宫' } },
  { id: 'cupa', name: '圣杯侍从', english: 'Page of Cups', default_numerology: null, astrology: { element: '水', house: '第四宫' } },
  { id: 'cukn', name: '圣杯骑士', english: 'Knight of Cups', default_numerology: null, astrology: { zodiac: '双鱼座', element: '水', house: '第十二宫' } },
  { id: 'cuqu', name: '圣杯王后', english: 'Queen of Cups', default_numerology: null, astrology: { zodiac: '巨蟹座', element: '水', house: '第四宫' } },
  { id: 'cuki', name: '圣杯国王', english: 'King of Cups', default_numerology: null, astrology: { zodiac: '天蝎座', element: '水', house: '第八宫' } },

  // Swords (Air)
  { id: 'swac', name: '宝剑王牌', english: 'Ace of Swords', default_numerology: 1, astrology: { element: '风', house: '第七宫' } },
  { id: 'sw02', name: '宝剑二', english: 'Two of Swords', default_numerology: 2, astrology: { zodiac: '天秤座', planet: '月亮', element: '风', house: '第七宫' } },
  { id: 'sw03', name: '宝剑三', english: 'Three of Swords', default_numerology: 3, astrology: { zodiac: '天秤座', planet: '土星', element: '风', house: '第七宫' } },
  { id: 'sw04', name: '宝剑四', english: 'Four of Swords', default_numerology: 4, astrology: { zodiac: '天秤座', planet: '木星', element: '风', house: '第七宫' } },
  { id: 'sw05', name: '宝剑五', english: 'Five of Swords', default_numerology: 5, astrology: { zodiac: '水瓶座', planet: '金星', element: '风', house: '第十一宫' } },
  { id: 'sw06', name: '宝剑六', english: 'Six of Swords', default_numerology: 6, astrology: { zodiac: '水瓶座', planet: '水星', element: '风', house: '第十一宫' } },
  { id: 'sw07', name: '宝剑七', english: 'Seven of Swords', default_numerology: 7, astrology: { zodiac: '水瓶座', planet: '月亮', element: '风', house: '第十一宫' } },
  { id: 'sw08', name: '宝剑八', english: 'Eight of Swords', default_numerology: 8, astrology: { zodiac: '双子座', planet: '木星', element: '风', house: '第三宫' } },
  { id: 'sw09', name: '宝剑九', english: 'Nine of Swords', default_numerology: 9, astrology: { zodiac: '双子座', planet: '火星', element: '风', house: '第三宫' } },
  { id: 'sw10', name: '宝剑十', english: 'Ten of Swords', default_numerology: 10, astrology: { zodiac: '双子座', planet: '太阳', element: '风', house: '第三宫' } },
  { id: 'swpa', name: '宝剑侍从', english: 'Page of Swords', default_numerology: null, astrology: { element: '风', house: '第七宫' } },
  { id: 'swkn', name: '宝剑骑士', english: 'Knight of Swords', default_numerology: null, astrology: { zodiac: '双子座', element: '风', house: '第三宫' } },
  { id: 'swqu', name: '宝剑王后', english: 'Queen of Swords', default_numerology: null, astrology: { zodiac: '天秤座', element: '风', house: '第七宫' } },
  { id: 'swki', name: '宝剑国王', english: 'King of Swords', default_numerology: null, astrology: { zodiac: '水瓶座', element: '风', house: '第十一宫' } },

  // Pentacles (Earth)
  { id: 'peac', name: '星币王牌', english: 'Ace of Pentacles', default_numerology: 1, astrology: { element: '土', house: '第十宫' } },
  { id: 'pe02', name: '星币二', english: 'Two of Pentacles', default_numerology: 2, astrology: { zodiac: '摩羯座', planet: '木星', element: '土', house: '第十宫' } },
  { id: 'pe03', name: '星币三', english: 'Three of Pentacles', default_numerology: 3, astrology: { zodiac: '摩羯座', planet: '火星', element: '土', house: '第十宫' } },
  { id: 'pe04', name: '星币四', english: 'Four of Pentacles', default_numerology: 4, astrology: { zodiac: '摩羯座', planet: '太阳', element: '土', house: '第十宫' } },
  { id: 'pe05', name: '星币五', english: 'Five of Pentacles', default_numerology: 5, astrology: { zodiac: '金牛座', planet: '水星', element: '土', house: '第二宫' } },
  { id: 'pe06', name: '星币六', english: 'Six of Pentacles', default_numerology: 6, astrology: { zodiac: '金牛座', planet: '月亮', element: '土', house: '第二宫' } },
  { id: 'pe07', name: '星币七', english: 'Seven of Pentacles', default_numerology: 7, astrology: { zodiac: '金牛座', planet: '土星', element: '土', house: '第二宫' } },
  { id: 'pe08', name: '星币八', english: 'Eight of Pentacles', default_numerology: 8, astrology: { zodiac: '处女座', planet: '太阳', element: '土', house: '第六宫' } },
  { id: 'pe09', name: '星币九', english: 'Nine of Pentacles', default_numerology: 9, astrology: { zodiac: '处女座', planet: '金星', element: '土', house: '第六宫' } },
  { id: 'pe10', name: '星币十', english: 'Ten of Pentacles', default_numerology: 10, astrology: { zodiac: '处女座', planet: '水星', element: '土', house: '第六宫' } },
  { id: 'pepa', name: '星币侍从', english: 'Page of Pentacles', default_numerology: null, astrology: { element: '土', house: '第十宫' } },
  { id: 'pekn', name: '星币骑士', english: 'Knight of Pentacles', default_numerology: null, astrology: { zodiac: '处女座', element: '土', house: '第六宫' } },
  { id: 'pequ', name: '星币王后', english: 'Queen of Pentacles', default_numerology: null, astrology: { zodiac: '摩羯座', element: '土', house: '第十宫' } },
  { id: 'peki', name: '星币国王', english: 'King of Pentacles', default_numerology: null, astrology: { zodiac: '金牛座', element: '土', house: '第二宫' } },
];

export const getCardImageUrl = (id: string) => {
  return `https://www.sacred-texts.com/tarot/pkt/img/${id}.jpg`;
};

export const INITIAL_READINGS = [
  {
    id: 'example-1',
    userId: 'system',
    date: new Date().toISOString(),
    question: '我近期的职业发展如何？',
    cards: [
      { name: '魔术师', isReversed: false },
      { name: '塔', isReversed: false },
      { name: '星币王牌', isReversed: false }
    ],
    interpretation: {
      singleCard: '魔术师代表你拥有所有必要的资源；塔预示着突如其来的变革；星币王牌意味着新的财务机会。',
      combination: '变革虽然痛苦，但它为你利用现有技能开启新篇章扫清了障碍。',
      summary: '这是一个置之死地而后生的过程，新的机会正在孕育。'
    },
    keywords: ['变革', '新机会', '资源整合', '突发事件', '职业转型'],
    spread: '圣三角牌阵',
    layoutType: 'triangle',
    slotLabels: ['现状/行动', '阻碍/情感', '结果/灵性'],
    slotPositions: ['col-start-3 row-start-2', 'col-start-2 row-start-1', 'col-start-4 row-start-1'],
    isPublic: true,
    authorName: '研习阁主',
    isAnonymous: false,
    isForClient: false,
    isExample: true,
    readingDate: new Date().toISOString(),
    category: '职业'
  }
];

export const LAYOUT_TEMPLATES: Record<string, { name: string, class: string, itemClasses: string[], defaultSlots: string[] }> = {
  'horizontal': { 
    name: '横排布局', 
    class: 'flex flex-wrap justify-center gap-1', 
    itemClasses: ['col-start-1 row-start-2', 'col-start-2 row-start-2', 'col-start-3 row-start-2', 'col-start-4 row-start-2', 'col-start-5 row-start-2'],
    defaultSlots: ['第一张', '第二张', '第三张', '第四张', '第五张']
  },
  'triangle': { 
    name: '圣三角牌阵', 
    class: 'grid grid-cols-3 gap-y-0.5 gap-x-1.5 max-w-[240px] mx-auto justify-items-center', 
    itemClasses: ['col-start-2 row-start-2', 'col-start-1 row-start-1', 'col-start-3 row-start-1'],
    defaultSlots: ['现状/行动', '阻碍/情感', '结果/灵性']
  },
  'cross': { 
    name: '十字牌阵', 
    class: 'grid grid-cols-3 gap-0.5 max-w-[220px] mx-auto justify-items-center', 
    itemClasses: ['col-start-2 row-start-2', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-2 row-start-1', 'col-start-2 row-start-3'],
    defaultSlots: ['中心', '左侧', '右侧', '上方', '下方']
  },
  'choice': { 
    name: '选择牌阵', 
    class: 'grid grid-cols-3 gap-y-0.5 gap-x-1.5 max-w-[280px] mx-auto justify-items-center', 
    itemClasses: ['col-start-2 row-start-3', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-1', 'col-start-3 row-start-1'],
    defaultSlots: ['现状', '选项A-1', '选项B-1', '选项A-2', '选项B-2']
  },
  'seasons': { 
    name: '四季牌阵', 
    class: 'grid grid-cols-3 gap-0.5 max-w-[220px] mx-auto justify-items-center', 
    itemClasses: ['col-start-2 row-start-2', 'col-start-2 row-start-1', 'col-start-3 row-start-2', 'col-start-2 row-start-3', 'col-start-1 row-start-2'],
    defaultSlots: ['大牌（核心课题）', '权杖牌组（火）', '星币牌组（土）', '宝剑牌组（风）', '圣杯牌组（水）']
  },
  'celtic': {
    name: '凯尔特十字牌阵',
    class: 'grid grid-cols-5 gap-x-6 gap-y-3 max-w-[520px] mx-auto justify-items-center items-center',
    itemClasses: [
      'col-start-2 row-start-2', // 1. 现状
      'col-start-2 row-start-2', // 2. 挑战
      'col-start-2 row-start-3', // 3. 基础
      'col-start-1 row-start-2', // 4. 过去
      'col-start-2 row-start-1', // 5. 目标
      'col-start-3 row-start-2', // 6. 未来
      'col-start-5 row-start-4', // 7. 自我
      'col-start-5 row-start-3', // 8. 环境
      'col-start-5 row-start-2', // 9. 希望/恐惧
      'col-start-5 row-start-1'  // 10. 结果
    ],
    defaultSlots: ['现状', '挑战', '基础', '过去', '目标', '未来', '自我', '环境', '希望/恐惧', '结果']
  },
  'custom': {
    name: '自由网格',
    class: 'grid grid-cols-5 gap-4 max-w-[350px] mx-auto justify-items-center',
    itemClasses: ['col-start-3 row-start-3'],
    defaultSlots: ['第一张']
  }
};

export const SPREAD_TO_LAYOUT: Record<string, string> = {
  '单牌阵': 'horizontal',
  '无牌阵三张': 'horizontal',
  '时间流牌阵': 'horizontal',
  '圣三角牌阵': 'triangle',
  '十字牌阵': 'cross',
  '选择牌阵': 'choice',
  '四季牌阵': 'seasons',
  '凯尔特十字牌阵': 'celtic'
};

export const OFFICIAL_SPREADS = [
  { name: '单牌阵', layout: 'horizontal', slots: ['主牌'], slotPositions: ['col-start-3 row-start-2'] },
  { name: '无牌阵三张', layout: 'horizontal', slots: ['第一张', '第二张', '第三张'], slotPositions: ['col-start-2 row-start-2', 'col-start-3 row-start-2', 'col-start-4 row-start-2'] },
  { name: '时间流牌阵', layout: 'horizontal', slots: ['过去', '现在', '未来'], slotPositions: ['col-start-2 row-start-2', 'col-start-3 row-start-2', 'col-start-4 row-start-2'] },
  { 
    name: '圣三角牌阵', 
    layout: 'triangle', 
    slots: ['现状/行动', '阻碍/情感', '结果/灵性'],
    slotPositions: ['col-start-3 row-start-2', 'col-start-2 row-start-1', 'col-start-4 row-start-1']
  },
  { 
    name: '选择牌阵', 
    layout: 'choice', 
    slots: ['现状', '选项A-1', '选项B-1', '选项A-2', '选项B-2'],
    slotPositions: ['col-start-3 row-start-3', 'col-start-2 row-start-2', 'col-start-4 row-start-2', 'col-start-1 row-start-1', 'col-start-5 row-start-1']
  },
  { 
    name: '十字牌阵', 
    layout: 'cross', 
    slots: ['中心', '左侧', '右侧', '上方', '下方'],
    slotPositions: ['col-start-3 row-start-2', 'col-start-2 row-start-2', 'col-start-4 row-start-2', 'col-start-3 row-start-1', 'col-start-3 row-start-3']
  },
  { 
    name: '四季牌阵', 
    layout: 'seasons', 
    slots: ['大牌（核心课题）', '权杖牌组（火）', '星币牌组（土）', '宝剑牌组（风）', '圣杯牌组（水）'],
    slotPositions: ['col-start-3 row-start-2', 'col-start-3 row-start-1', 'col-start-4 row-start-2', 'col-start-3 row-start-3', 'col-start-2 row-start-2']
  },
  { 
    name: '凯尔特十字牌阵', 
    layout: 'celtic', 
    slots: ['现状', '挑战', '基础', '过去', '目标', '未来', '自我', '环境', '希望/恐惧', '结果'],
    slotPositions: [
      'col-start-2 row-start-2', // 1. 现状
      'col-start-2 row-start-2', // 2. 挑战
      'col-start-2 row-start-3', // 3. 基础
      'col-start-1 row-start-2', // 4. 过去
      'col-start-2 row-start-1', // 5. 目标
      'col-start-3 row-start-2', // 6. 未来
      'col-start-5 row-start-4', // 7. 自由
      'col-start-5 row-start-3', // 8. 环境
      'col-start-5 row-start-2', // 9. 希望/恐惧
      'col-start-5 row-start-1'  // 10. 结果
    ],
    rotatedSlots: [1]
  }
];

export const PAVILION_PROVERBS = [
  "牌是镜子，照见的是你自己。",
  "静观其变，方见本心。",
  "万物皆有定数，亦皆有变数。",
  "研习塔罗，即是研习生命本身。",
  "灵见不假外求，只在方寸之间。",
  "每一张牌，都是通往潜意识的门户。",
  "在无序中寻找秩序，在变幻中守住初心。",
  "解读不是预言，而是觉察的艺术。",
  "心诚则灵，意动则见。",
  "研精覃思，洞见未来。"
];

export const OFFICIAL_AVATARS = [
  "🌿", "🌲", "🏺", "🕯️", "📖", "🌙", "🦉", "🔮", "✨", "📜"
];
