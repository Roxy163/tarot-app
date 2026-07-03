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
    title: '先看全貌',
    subtitle: '这是一座会积累的塔罗研习阁',
    content: '这里不是抽完即走的占卜工具。你会从每日一问开始，留下手记、复盘和自己的牌义，慢慢整理出一套属于自己的理解。',
    icon: Sparkles,
    preview: 'overview',
    action: '开始导览',
    showSkip: true,
  },
  {
    title: '研习台',
    subtitle: '每日灵见的起点',
    content: '首页会把日运练习、快捷手记入口、最近手记和牌意小考放在一起，帮助你从一个真实问题开始今天的观察。',
    icon: Sun,
    preview: 'home',
    action: '下一步',
    showSkip: true,
  },
  {
    title: '抽牌手记',
    subtitle: '记录每一次灵见',
    content: '选择牌阵、抽取卡牌、切换正逆位，再写下直觉与复盘。每一次抽牌都会成为可以回看的手记。',
    icon: PenLine,
    preview: 'reading',
    action: '下一步',
    showSkip: true,
  },
  {
    title: '牌阵工作台',
    subtitle: '像现实摆牌一样设计结构',
    content: '自由画布可以摆放位置、对齐、镜像复制，并保存为可复用的个人牌阵。你可以先套用已有牌阵，也可以从空白开始。',
    icon: Settings,
    preview: 'workspace',
    action: '下一步',
    showSkip: true,
  },
  {
    title: '个人典籍',
    subtitle: '把经验沉淀为自己的牌义',
    content: '用久之后，手记、复盘和牌义会回到你的个人典籍里。你看到的不只是系统解释，而是自己长期积累出的理解。',
    icon: BookOpen,
    preview: 'library',
    action: '开始使用',
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
