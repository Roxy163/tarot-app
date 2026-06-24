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
    title: '入阁敕令',
    subtitle: '开启您的塔罗研习之旅',
    content: '今有问道者一人，于虚无中开辟一方灵台，赐号"塔罗研习阁"。汝为第一任阁主。愿汝勤加研习，自注牌义，成一家之言。',
    icon: Sparkles,
    action: '开始导览',
    showSkip: true,
  },
  {
    title: '研习台',
    subtitle: '每日灵见的起点',
    content: '研习台是您的每日入口，展示箴言、快捷抽牌和研习模块。在这里开启您的每日灵见之旅。',
    icon: BookOpen,
    action: '了解更多',
    showSkip: true,
  },
  {
    title: '抽牌手记',
    subtitle: '记录每一次灵见',
    content: '选择牌阵、抽取卡牌、撰写解读，完整记录您的占卜之旅。长按卡牌可快速清空。',
    icon: PenLine,
    action: '开始研习',
    showSkip: true,
  },
];

export const GUIDE_SECTIONS = {
  intro: {
    title: '欢迎来到塔罗研习阁',
    subtitle: '探索未知，洞见内心',
    content: '塔罗研习阁是一款专注于个人成长与灵性探索的塔罗占卜应用。在这里，你可以进行每日运势占卜、记录塔罗手记、创建自定义牌阵，开启你的灵性之旅。',
    features: [
      { icon: Sparkles, text: '每日运势自动生成' },
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
      '找一个安静的空间进行占卜',
      '深呼吸，集中注意力',
      '相信你的第一直觉',
      '记录每次占卜的感悟',
      '定期回顾你的占卜记录',
      '尊重每张牌传达的信息',
    ],
  },
};

export const SPREAD_GUIDE_FEATURES = [
  {
    id: 'daily',
    icon: Sun,
    title: '日运占卜',
    description: '每日一抽，探索今日能量指引。支持即时揭晓或延迟揭晓，让你的一天充满期待。',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    id: 'weekly',
    icon: Calendar,
    title: '周运预测',
    description: '三张牌解读本周趋势，帮助你提前规划，把握机遇。',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: 'monthly',
    icon: Moon,
    title: '月运分析',
    description: '时间流牌阵解读本月能量变化，洞察未来发展趋势。',
    color: 'from-purple-400 to-pink-500',
  },
  {
    id: 'yearly',
    icon: Star,
    title: '年运展望',
    description: '十二宫牌阵揭示全年运势，1-12月各有指引，底牌揭示深层能量。',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: 'seasonal',
    icon: Leaf,
    title: '四季牌阵',
    description: '感受四季更迭的能量变化，与自然节律同步。',
    color: 'from-green-400 to-forest-500',
  },
];
