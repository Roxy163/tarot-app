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

const talentCards: ReadingSlotData[] = [
  { name: '魔术师', isReversed: false, label: '核心天赋' },
  { name: '愚者', isReversed: false, label: '学习天赋' },
  { name: '正义', isReversed: false, label: '执行力天赋' },
  { name: '力量', isReversed: false, label: '人际关系天赋' },
];

const talentForm: ReadingFormState = {
  ...formData, question: '我的职业天赋', spread: '职业天赋牌阵', layoutType: 'grid', choicePathA: '', choicePathB: '',
};

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

  it('builds the actual four-card talent example with a concise method rather than prewritten card meanings', () => {
    const result = buildReadingAiPrompt({ mode: 'consultant', formData: talentForm, cardSlots: talentCards, cardInterpretations: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt).toContain('先回应核心问题');
    expect(result.prompt).toContain('牌位与正逆位说明依据及相关的可能表现或情境');
    expect(result.prompt).toContain('所有牌位都纳入综合，按与问题的相关性分配篇幅');
    expect(result.prompt).toContain('有依据再谈条件或盲点，不强行制造冲突');
    expect(result.prompt).toContain('可观察或尝试的建议');
    expect(result.prompt).toContain('问题：我的职业天赋');
    expect(result.prompt).toContain('牌阵：职业天赋牌阵');
    for (const line of ['1. 核心天赋：魔术师（正位）', '2. 学习天赋：愚者（正位）', '3. 执行力天赋：正义（正位）', '4. 人际关系天赋：力量（正位）']) {
      expect(result.prompt.split(line)).toHaveLength(2);
    }
    expect(result.prompt).toContain('有依据的关键牌间关系，不逐对硬配');
    expect(result.prompt).not.toMatch(/(?:魔术师|愚者|正义|力量)(?:代表|象征|说明你)/);
    expect(result.prompt).not.toMatch(/产品经理|程序员|销售岗位|七个部分|必须按以下/);
    expect(result.prompt.length).toBeLessThan(400);
  });

  it.each(['mentor', 'consultant'] as const)('protects ordinal-only positions from invented roles in %s mode', mode => {
    const result = buildReadingAiPrompt({
      mode,
      formData: { ...talentForm, question: '对事业方向的指示', spread: '无牌阵三张', combination: '我想检查这三张牌的整体指向。' },
      cardSlots: [
        { name: '皇后', isReversed: false, label: '第一张' },
        { name: '星币七', isReversed: true, label: '第二张' },
        { name: '圣杯十', isReversed: false, label: '第三张' },
      ],
      cardInterpretations: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt).toContain('牌位仅标注抽牌顺序、未定义具体含义时，只按顺序综合，不自行补设时间线或其他含义。');
    expect(result.prompt).toContain('1. 第一张：皇后（正位）');
    expect(result.prompt).toContain('2. 第二张：星币七（逆位）');
    expect(result.prompt).toContain('3. 第三张：圣杯十（正位）');
    expect(result.prompt).not.toMatch(/1\. (?:过去|现状)|2\. (?:现在|阻碍)|3\. (?:未来|结果)/);
  });

  it('preserves explicitly defined time positions while guarding only undefined meanings', () => {
    const result = buildReadingAiPrompt({
      mode: 'consultant', formData: { ...talentForm, spread: '时间流牌阵' },
      cardSlots: talentCards.slice(0, 3).map((card, index) => ({ ...card, label: ['过去', '现在', '未来'][index] })),
      cardInterpretations: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt).toContain('1. 过去：魔术师（正位）');
    expect(result.prompt).toContain('2. 现在：愚者（正位）');
    expect(result.prompt).toContain('3. 未来：正义（正位）');
    expect(result.prompt).toContain('未定义具体含义时');
  });

  it('adds only explicitly provided context to either mode without treating expectations as facts', () => {
    const aiContext = '刚换到新团队。\n我希望多参与沟通，假设同事愿意配合。';
    for (const mode of ['mentor', 'consultant'] as const) {
      const result = buildReadingAiPrompt({
        mode, includeSupplementary: true,
        formData: { ...talentForm, aiContext, combination: 'PRIVATE-THOUGHT', singleCard: 'PRIVATE-LEGACY', clientName: 'PRIVATE-CLIENT', clientFeedback: 'PRIVATE-FEEDBACK', userFeedback: 'PRIVATE-REVIEW', numerologyInfluence: 'PRIVATE-NUMEROLOGY', astrologyInfluence: 'PRIVATE-ASTROLOGY' },
        cardSlots: talentCards,
        cardInterpretations: ['PRIVATE-CARD', '', '', ''], cardQuestions: ['PRIVATE-QUESTION'],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.prompt).toContain(`用户描述的背景与关注点：\n${aiContext}`);
      expect(result.prompt.split(aiContext)).toHaveLength(2);
      expect(result.prompt).toContain('关注、期待与假设不等于已发生事实');
      expect(result.prompt).not.toContain('PRIVATE-CLIENT');
      if (mode === 'consultant') expect(result.prompt).not.toContain('PRIVATE-');
      else {
        expect(result.prompt).toContain('PRIVATE-THOUGHT');
        expect(result.prompt).toContain('PRIVATE-QUESTION');
        expect(result.prompt).toContain('PRIVATE-REVIEW');
      }
    }
  });

  it.each([undefined, '', ' \n\t '])('omits an empty optional context (%s) without adding a blank section or requirement', aiContext => {
    const input = { mode: 'consultant' as const, formData: talentForm, cardSlots: talentCards, cardInterpretations: [] };
    const baseline = buildReadingAiPrompt(input);
    const result = buildReadingAiPrompt({ ...input, formData: { ...talentForm, aiContext } });
    expect(result).toEqual(baseline);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prompt).not.toContain('用户描述的背景与关注点');
  });

  it('does not treat context as the user’s interpretation in mentor mode', () => {
    const result = buildReadingAiPrompt({
      mode: 'mentor', formData: { ...talentForm, aiContext: '我关心自己如何适应新团队', singleCard: '', combination: '' },
      cardSlots: talentCards, cardInterpretations: [],
    });
    expect(result).toEqual({ ok: false, notice: '还差一点：请给每张牌写一句你的解读。' });
  });

  it('keeps a single-card consultation free of card-pair or A/B tasks', () => {
    const result = buildReadingAiPrompt({
      mode: 'consultant', formData: { ...talentForm, question: '今天最需要留意什么？', spread: '单牌阵', layoutType: 'horizontal' },
      cardSlots: [{ name: '星币国王', isReversed: true, label: '今日提醒' }], cardInterpretations: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt).toContain('1. 今日提醒：星币国王（逆位）');
    expect(result.prompt).toContain('不代填缺失背景');
    expect(result.prompt).not.toMatch(/牌间关系|A\/B|逐对|我的理解/);
    expect(result.prompt.length).toBeLessThan(300);
  });

  it('uses the same general method for career, relationship and other questions instead of classifying keywords', () => {
    const prompts = ['我的职业天赋', '我与朋友合作时怎么改善关系？', '这个学习计划应注意什么？'].map(question => {
      const result = buildReadingAiPrompt({
        mode: 'consultant', formData: { ...talentForm, question, spread: '自定义观察' },
        cardSlots: [{ name: '隐士', isReversed: false, label: '我的位置' }, { name: '力量', isReversed: true, label: '互动中的提醒' }],
        cardInterpretations: [],
      });
      expect(result.ok).toBe(true);
      return result.ok ? result.prompt.replace(question, '[本次问题]') : '';
    });
    expect(new Set(prompts).size).toBe(1);
    expect(prompts[0]).toContain('1. 我的位置：隐士（正位）');
    expect(prompts[0]).toContain('2. 互动中的提醒：力量（逆位）');
    expect(prompts[0]).not.toMatch(/天赋框架|适合岗位|恋爱结局|左侧|右侧/);
  });

  it('keeps declared limits and actual A/B positions without inventing directions or time stages', () => {
    const result = buildReadingAiPrompt({
      mode: 'consultant', formData: { ...formData, question: '只考虑本月，预算不能超过两千，哪个方案更合适？', spread: '我的两方案', layoutType: 'free', choicePathA: '保留目前课程', choicePathB: '本月更换课程' },
      cardSlots: [{ name: '隐士', isReversed: false, label: '', position: 'A方案提醒' }, { name: '愚者', isReversed: true, label: '', position: 'B方案提醒' }], cardInterpretations: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt).toContain('问题：只考虑本月，预算不能超过两千，哪个方案更合适？');
    expect(result.prompt).toContain('A：保留目前课程\nB：本月更换课程');
    expect(result.prompt).toContain('1. A方案提醒：隐士（正位）');
    expect(result.prompt).toContain('比较 A/B 的差异与风险');
    expect(result.prompt).toContain('忠实保留已说明的时限、路径与限制');
    expect(result.prompt).not.toMatch(/近期|远期|左侧|右侧/);
  });

  it('checks a partial interpretation and its question without asking the mentor to redo the full reading', () => {
    const result = buildReadingAiPrompt({
      mode: 'mentor', formData: { ...talentForm, combination: '', singleCard: '', aiContext: '我想了解与同事相处的方式' },
      cardSlots: talentCards, cardInterpretations: ['', '我只写了学习位置的一点理解', '', ''], cardQuestions: ['', '这里的判断是不是跳得太快？'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prompt).toContain('重点回应已有理解');
    expect(result.prompt).toContain('牌面依据、推理跳跃与遗漏');
    expect(result.prompt).toContain('不必重做整套解牌');
    expect(result.prompt).toContain('优先回答我的疑问');
    expect(result.prompt.match(/我的理解：/g)).toHaveLength(1);
    expect(result.prompt).toContain('4. 人际关系天赋：力量（正位）');
    expect(result.prompt).not.toContain('先回应核心问题');
  });
});
