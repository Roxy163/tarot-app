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

    expect(result.prompt).toContain('检查我的解读');
    expect(result.prompt).toContain('问题：未来三个月是否适合离职？');
    expect(result.prompt).toContain('牌阵：选择牌阵');
    expect(result.prompt).toContain('A：三个月内离职，和私人老板合作');
    expect(result.prompt).toContain('B：继续留在当前单位');
    expect(result.prompt.split(formData.choicePathA)).toHaveLength(2);
    expect(result.prompt).toContain('2. A近期发展：权杖女皇（逆位）');
    expect(result.prompt).toContain('我的理解：行动受阻');
    expect(result.prompt).toContain('疑问：为什么 A 路径会卡在行动上？');
    expect(result.prompt).toContain('我的整体解读：\nA 路径更急，B 路径更慢。');
    expect(result.prompt).toContain('优先回答我的疑问');
    expect(result.prompt).not.toContain('阿若');
    expect(result.prompt).not.toContain('火元素偏弱');
    expect(result.prompt).not.toContain('完整、细致');
    expect(result.prompt).not.toContain('整体牌阵主轴');
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

    expect(result.prompt).toContain('按韦特体系');
    expect(result.prompt).toContain('问题：未来三个月是否适合离职？');
    expect(result.prompt).toContain('A：三个月内离职，和私人老板合作');
    expect(result.prompt).toContain('牌阵：选择牌阵');
    expect(result.prompt).toContain('2. A近期发展：权杖女皇（逆位）');
    expect(result.prompt).toContain('5. B远期结果：星币骑士（逆位）');
    expect(result.prompt).toContain('避免确定性预言');
    expect(result.prompt).not.toContain('我的理解');
    expect(result.prompt).not.toContain('疑问：');
    expect(result.prompt).not.toContain('我的整体解读');
    expect(result.prompt).not.toContain('阿若');
    expect(result.prompt).not.toContain('行星星座影响');
  });

  it('requires some personal interpretation for mentor mode rather than an empty reading', () => {
    expect(buildReadingAiPrompt({
      mode: 'mentor',
      formData: { ...formData, combination: '', singleCard: '' },
      cardSlots: cards,
      cardInterpretations: ['', '', '', '', ''],
    })).toEqual({
      ok: false,
      notice: '还差一点：请给每张牌写一句你的解读。',
    });
  });

  it('accepts an overall thought without requiring a separate interpretation for every card', () => {
    const result = buildReadingAiPrompt({ formData, cardSlots: cards, cardInterpretations: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prompt).toContain('我的整体解读：\nA 路径更急，B 路径更慢。');
      expect(result.prompt).not.toContain('我的理解：');
      expect(result.prompt).toContain('5. B远期结果：星币骑士（逆位）');
    }
  });

  it('can discuss only the card interpretations the user chose to write', () => {
    const result = buildReadingAiPrompt({ formData: { ...formData, singleCard: '', combination: '' }, cardSlots: cards, cardInterpretations: ['我只想讨论现状', '', '', '', ''] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prompt.match(/我的理解：/g)).toHaveLength(1);
  });

  it('includes legacy thoughts stored in the single-card field of a multi-card reading', () => {
    const result = buildReadingAiPrompt({ formData: { ...formData, combination: '', singleCard: '旧手记里保留的原始想法' }, cardSlots: cards, cardInterpretations: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prompt.split('旧手记里保留的原始想法')).toHaveLength(2);
  });

  it('does not count notes from removed card positions as current thoughts', () => {
    const result = buildReadingAiPrompt({ formData: { ...formData, spread: '单牌阵', layoutType: 'horizontal', combination: '', singleCard: '' }, cardSlots: [cards[0]], cardInterpretations: ['', '已移除牌位的旧笔记'] });
    expect(result.ok).toBe(false);
  });

  it('does not repeat a legacy thought already included as a card interpretation', () => {
    const result = buildReadingAiPrompt({ formData: { ...formData, combination: '', singleCard: '相同的原始想法' }, cardSlots: cards, cardInterpretations: ['相同的原始想法'] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prompt.split('相同的原始想法')).toHaveLength(2);
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

  it('lists each horizontal slot once without repeating the labels in a separate guide', () => {
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

    expect(result.prompt).toContain('1. 过去：愚者（正位）');
    expect(result.prompt).toContain('3. 未来：女祭司（逆位）');
    expect(result.prompt.split('过去')).toHaveLength(2);
    expect(result.prompt).not.toContain('左右路径');
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

    expect(result.prompt).toContain('牌间关系');
    expect(result.prompt).toContain('2. 阻碍/情感：月亮（逆位）');
  });

  it('keeps a single-card prompt short and omits irrelevant multi-card tasks', () => {
    const result = buildReadingAiPrompt({ formData: { ...formData, question: '今天工作上需要留意什么？', spread: '单牌阵', layoutType: 'horizontal', isForClient: false, clientName: '', category: '日运', combination: '' }, cardSlots: [{ name: '隐士', isReversed: false, label: '今日日运' }], cardInterpretations: ['先独立整理思路，再和同事沟通。'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt.length).toBeLessThan(200);
    for (const irrelevant of ['A/B', '牌间关系', '多个路径', '主题或标签', '经验非常丰富', '行星星座影响']) expect(result.prompt).not.toContain(irrelevant);
  });

  it('does not require or export client names when generating either mode', () => {
    for (const mode of ['mentor', 'consultant'] as const) {
      const result = buildReadingAiPrompt({ mode, formData: { ...formData, clientName: '' }, cardSlots: cards, cardInterpretations: cards.map(() => '已有解读') });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.prompt).not.toContain('客户称呼');
    }
  });

  it('does not invent time periods or left/right positions for a custom A/B comparison', () => {
    const result = buildReadingAiPrompt({ mode: 'consultant', formData: { ...formData, spread: '自定义对比', layoutType: 'free' }, cardSlots: [{ name: '隐士', isReversed: false, label: 'A的优势' }, { name: '愚者', isReversed: true, label: 'B的优势' }], cardInterpretations: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const invented of ['近期', '远期', '现状', '左侧', '右侧']) expect(result.prompt).not.toContain(invented);
    expect(result.prompt).toContain('比较 A/B');
  });

  it('does not interpret English labels or a spread name alone as A/B paths', () => {
    const result = buildReadingAiPrompt({ mode: 'consultant', formData: { ...formData, spread: '职业选择单牌', layoutType: 'horizontal', choicePathA: '', choicePathB: '' }, cardSlots: [{ name: '隐士', isReversed: false, label: 'Advice' }], cardInterpretations: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prompt).not.toContain('A/B');
  });

  it('includes retrospective feedback and personal perspectives only on request and only in mentor mode', () => {
    const input = { formData: { ...formData, userFeedback: '事后真的换了工作', clientFeedback: '后来仍留在原单位' }, cardSlots: cards, cardInterpretations: cards.map(() => '已有解读') };
    for (const mode of ['mentor', 'consultant'] as const) {
      for (const includeSupplementary of [false, true]) {
        const result = buildReadingAiPrompt({ ...input, mode, includeSupplementary });
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        if (mode === 'mentor' && includeSupplementary) {
          expect(result.prompt).toContain('事后反馈（已发生）');
          expect(result.prompt).toContain(input.formData.userFeedback);
          expect(result.prompt).toContain(input.formData.clientFeedback);
          expect(result.prompt).toContain(input.formData.astrologyInfluence!);
        } else {
          expect(result.prompt).not.toContain(input.formData.userFeedback);
          expect(result.prompt).not.toContain(input.formData.clientFeedback);
          expect(result.prompt).not.toContain(input.formData.astrologyInfluence!);
        }
      }
    }
  });
});
