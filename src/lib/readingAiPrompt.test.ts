import { describe, expect, it } from 'vitest';
import { ReadingSlotData } from '../types';
import { ReadingFormState, REQUIRED_QUESTION_NOTICE } from './readingSubmitPayload';
import { buildReadingAiPrompt, getGentleAiPromptNotice } from './readingAiPrompt';

const formData: ReadingFormState = {
  question: '未来三个月是否适合离职？',
  spread: '选择牌阵',
  layoutType: 'choice',
  cardInput: '',
  singleCard: '',
  combination: 'A 路径更急，B 路径更慢。',
  numerologyInfluence: '',
  astrologyInfluence: '火元素偏弱，执行力需要补足。',
  houseInfluence: '',
  elementInfluence: '',
  isAnonymous: false,
  isPublic: false,
  isForClient: true,
  clientName: '阿若',
  clientFeedback: '',
  userFeedback: '',
  choicePathA: '三个月内离职，和私人老板合作',
  choicePathB: '继续留在当前单位',
  readingDate: '2026-07-28T12:00',
  isTimePrecise: false,
  category: '事业',
  skipAi: true,
};

const cards: ReadingSlotData[] = [
  { name: '圣杯七', isReversed: false, label: '现状' },
  { name: '权杖女皇', isReversed: true, label: 'A近期发展' },
  { name: '宝剑八', isReversed: true, label: 'B近期发展' },
  { name: '权杖九', isReversed: true, label: 'A远期结果' },
  { name: '星币骑士', isReversed: true, label: 'B远期结果' },
];

describe('buildReadingAiPrompt', () => {
  it('formats missing-field notices as gentle prompt guidance', () => {
    expect(getGentleAiPromptNotice(REQUIRED_QUESTION_NOTICE)).toBe('还差一点：先补上占卜问题，就能生成提示词。');
  });

  it('does not build a prompt before required reading fields are completed', () => {
    expect(buildReadingAiPrompt({
      formData: { ...formData, question: '' },
      cardSlots: cards,
      cardInterpretations: ['现状', 'A近', 'B近', 'A远', 'B远'],
    })).toEqual({ ok: false, notice: REQUIRED_QUESTION_NOTICE });
  });

  it('builds a mentor-style prompt from the reading information', () => {
    const result = buildReadingAiPrompt({
      formData,
      cardSlots: cards,
      cardInterpretations: ['选择很多', '行动受阻', '开始脱困', '疲惫防御', '推进很慢'],
      cardQuestions: ['这张牌是在说选择太多，还是在说逃避现实？', '为什么 A 路径会卡在行动上？'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.prompt).toContain('你是一位经验非常丰富、擅长韦特体系的塔罗师');
    expect(result.prompt).toContain('这是一条客户记录，客户称呼是「阿若」。');
    expect(result.prompt).toContain('我这次占卜的问题是：\n未来三个月是否适合离职？');
    expect(result.prompt).toContain('我使用的牌阵是：选择牌阵');
    expect(result.prompt).toContain('A 路（左侧）代表：三个月内离职，和私人老板合作');
    expect(result.prompt).toContain('B 路（右侧）代表：继续留在当前单位');
    expect(result.prompt).toContain('2. A近期发展（A 路：三个月内离职，和私人老板合作）：权杖女皇（逆位）');
    expect(result.prompt).toContain('我的逐牌解读：行动受阻');
    expect(result.prompt).toContain('我对这张牌的疑问：为什么 A 路径会卡在行动上？');
    expect(result.prompt).toContain('我已经写下的组合解读：\nA 路径更急，B 路径更慢。');
    expect(result.prompt).toContain('行星星座影响：火元素偏弱，执行力需要补足。');
    expect(result.prompt).not.toContain('全世界最厉害');
  });

  it('builds a consultant-style prompt without exposing the user interpretation notes', () => {
    const result = buildReadingAiPrompt({
      mode: 'consultant',
      formData,
      cardSlots: cards,
      cardInterpretations: ['', '', '', '', ''],
      cardQuestions: ['这张牌是在说选择太多，还是在说逃避现实？'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.prompt).toContain('你是一位经验非常丰富、擅长韦特体系的塔罗师。');
    expect(result.prompt).toContain('现在有一位咨询者来问塔罗，客户称呼是「阿若」。');
    expect(result.prompt).toContain('具体问题是：\n未来三个月是否适合离职？');
    expect(result.prompt).toContain('牌阵结构：这是左右路径式的选择牌阵。');
    expect(result.prompt).toContain('A 路（左侧）代表：三个月内离职，和私人老板合作');
    expect(result.prompt).toContain('我采用的是「选择牌阵」，牌阵结果如下：');
    expect(result.prompt).toContain('2. A近期发展（A 路：三个月内离职，和私人老板合作）：权杖女皇（逆位）');
    expect(result.prompt).toContain('5. B远期结果（B 路：继续留在当前单位）：星币骑士（逆位）');
    expect(result.prompt).toContain('请像正式接到一次咨询一样');
    expect(result.prompt).not.toContain('我的逐牌解读');
    expect(result.prompt).not.toContain('我对这张牌的疑问');
    expect(result.prompt).not.toContain('我已经写下的组合解读');
    expect(result.prompt).not.toContain('行星星座影响');
  });

  it('still requires card interpretations for mentor mode', () => {
    expect(buildReadingAiPrompt({
      mode: 'mentor',
      formData,
      cardSlots: cards,
      cardInterpretations: ['', '', '', '', ''],
    })).toEqual({
      ok: false,
      notice: '还差一点：请给每张牌写一句你的解读。',
    });
  });

  it('asks for A and B path descriptions before generating choice-spread prompts', () => {
    expect(buildReadingAiPrompt({
      mode: 'consultant',
      formData: { ...formData, choicePathA: '', choicePathB: '' },
      cardSlots: cards,
      cardInterpretations: [],
    })).toEqual({
      ok: false,
      notice: '还差一点：先写清 A 路和 B 路分别代表什么。',
    });
  });

  it('describes horizontal spreads as left-to-right in the prompt', () => {
    const result = buildReadingAiPrompt({
      mode: 'consultant',
      formData: {
        ...formData,
        spread: '时间流牌阵',
        layoutType: 'horizontal',
        isForClient: false,
        clientName: '',
        choicePathA: '',
        choicePathB: '',
      },
      cardSlots: [
        { name: '愚者', isReversed: false, label: '过去' },
        { name: '魔术师', isReversed: false, label: '现在' },
        { name: '女祭司', isReversed: true, label: '未来' },
      ],
      cardInterpretations: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.prompt).toContain('牌阵结构：这是线性牌阵，请按从左至右的顺序阅读；从左至右分别是：1. 过去；2. 现在；3. 未来。');
    expect(result.prompt).toContain('1. 过去：愚者（正位）');
    expect(result.prompt).toContain('3. 未来：女祭司（逆位）');
  });

  it('describes other multi-card spreads by each slot meaning', () => {
    const result = buildReadingAiPrompt({
      mode: 'consultant',
      formData: {
        ...formData,
        spread: '圣三角牌阵',
        layoutType: 'triangle',
        isForClient: false,
        clientName: '',
        choicePathA: '',
        choicePathB: '',
      },
      cardSlots: [
        { name: '太阳', isReversed: false, label: '现状/行动' },
        { name: '月亮', isReversed: true, label: '阻碍/情感' },
        { name: '世界', isReversed: false, label: '结果/灵性' },
      ],
      cardInterpretations: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.prompt).toContain('牌阵结构：这是多牌牌阵，请以每张牌所在位置的具体代表含义为主，再观察牌与牌之间的关系。');
    expect(result.prompt).toContain('2. 阻碍/情感：月亮（逆位）');
  });
});
