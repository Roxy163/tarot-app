import {
  BookOpen,
  Calendar,
  Heart,
  Leaf,
  Moon,
  PenLine,
  Settings,
  Share2,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';

export const FIRST_ENTRY_STEPS = [
  {
    title: '先从一张牌开始',
    subtitle: '不用一次弄懂全部功能',
    content: '如果你是第一次来，先做一件小事就够了：抽或录入今天的一张牌，写下第一直觉。之后再慢慢使用手记、复盘和牌义注疏。',
    icon: Sparkles,
    preview: 'overview',
    action: '看推荐路线',
    showSkip: true,
  },
  {
    title: '日运抽牌',
    subtitle: '每天只需要一张牌',
    content: '你可以用系统抽牌，也可以录入现实中抽到的牌。这里更像单牌练习：先说出关键词，再把它和今天发生的事对应起来。',
    icon: Sun,
    preview: 'home',
    action: '看如何记录',
    showSkip: true,
  },
  {
    title: '抽牌手记',
    subtitle: '记录每一次灵见',
    content: '当你有一个完整问题时，再进入手记：选择牌阵、抽取卡牌、切换正逆位，并写下当下直觉。以后回看时，记录会比答案更有价值。',
    icon: PenLine,
    preview: 'reading',
    action: '看进阶玩法',
    showSkip: true,
  },
  {
    title: '牌阵工作台',
    subtitle: '熟悉之后再自由摆牌',
    content: '如果系统牌阵不够用，你可以在自由画布里像现实摆牌一样设计结构。新手不必急着使用它，先套用已有牌阵也完全可以。',
    icon: Settings,
    preview: 'workspace',
    action: '看复盘方式',
    showSkip: true,
  },
  {
    title: '典籍与牌义',
    subtitle: '把经验沉淀为自己的理解',
    content: '记录不是结束。你可以在典籍里复盘过往手记，也可以在牌义注疏里批量修改每张单牌的释义，慢慢长出自己的牌义体系。',
    icon: BookOpen,
    preview: 'library',
    action: '进入研习台',
    showSkip: true,
  },
];

export const GUIDE_SECTIONS = {
  intro: {
    title: '欢迎来到塔罗研习阁',
    subtitle: '探索未知，洞见内心',
    content: '塔罗研习阁是一款专注于个人成长与灵性探索的塔罗研习应用。在这里，你可以进行日运抽牌、记录塔罗手记、创建自定义牌阵，开启你的灵性之旅。',
    features: [
      { icon: Sparkles, text: '日运抽牌与现实牌记录' },
      { icon: BookOpen, text: '丰富的牌阵选择' },
      { icon: PenLine, text: '记录与回顾功能' },
      { icon: Settings, text: '自定义牌阵设计' },
      { icon: Share2, text: '分享你的解读' },
      { icon: Heart, text: '建立个人占卜档案' },
    ],
  },
  spreads: {
    title: '牌阵介绍',
    subtitle: '选择适合你的占卜方式',
  },
  tips: {
    title: '使用小贴士',
    subtitle: '让占卜更有仪式感',
    tips: [
      '找一个安静的空间记录抽牌',
      '深呼吸，集中注意力',
      '相信你的第一直觉',
      '记录每次抽牌的感悟',
      '定期回顾你的抽牌手记',
      '尊重每张牌传达的信息',
    ],
  },
};

export const SPREAD_GUIDE_FEATURES = [
  {
    id: 'daily',
    icon: Sun,
    title: '日运记录',
    description: '每日一抽或录入现实抽到的牌，把单牌含义和当天真实事件对应起来。',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    id: 'weekly',
    icon: Calendar,
    title: '周运手记',
    description: '用三张牌记录本周主题，方便之后回看当时的判断与变化。',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: 'monthly',
    icon: Moon,
    title: '月运复盘',
    description: '用时间流牌阵记录本月的开始、过程与结果，形成可回看的月度轨迹。',
    color: 'from-purple-400 to-pink-500',
  },
  {
    id: 'yearly',
    icon: Star,
    title: '年运档案',
    description: '用十二宫牌阵记录年度主题，日后可以按月份回看和修正理解。',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: 'seasonal',
    icon: Leaf,
    title: '四季牌阵',
    description: '记录四季阶段的牌面主题，把观察放进更长的时间尺度里。',
    color: 'from-green-400 to-forest-500',
  },
];
