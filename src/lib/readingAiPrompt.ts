import { ReadingSlotData } from '../types';
import {
  EMPTY_READING_NOTICE,
  INCOMPLETE_CARDS_NOTICE,
  ReadingFormState,
  REQUIRED_CARD_INTERPRETATION_NOTICE,
  REQUIRED_CHOICE_PATH_NOTICE,
  REQUIRED_CLIENT_NAME_NOTICE,
  REQUIRED_QUESTION_NOTICE,
  REQUIRED_SPREAD_NOTICE,
  getReadingSlotInterpretation,
  validateReadingRequiredFields,
} from './readingSubmitPayload';

export type ReadingAiPromptMode = 'mentor' | 'consultant';

type BuildReadingAiPromptInput = {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
  cardInterpretations: string[];
  cardQuestions?: string[];
  mode?: ReadingAiPromptMode;
};

export type ReadingAiPromptResult =
  | { ok: true; prompt: string }
  | { ok: false; notice: string };

const compactText = (value?: string) => value?.trim().replace(/\n{3,}/g, '\n\n') || '';

const isChoiceSpread = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => (
  formData.layoutType === 'choice'
  || formData.spread.includes('选择')
  || cardSlots.some(slot => /^[ABＡＢ]/i.test((slot.label || '').trim()))
);

const isLinearSpread = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => (
  formData.layoutType === 'horizontal' && cardSlots.length > 1
);

const getChoicePathNotice = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => {
  if (!isChoiceSpread(formData, cardSlots)) return null;
  if (formData.choicePathA?.trim() && formData.choicePathB?.trim()) return null;
  return REQUIRED_CHOICE_PATH_NOTICE;
};

const getChoicePathForLabel = (label: string, formData: ReadingFormState) => {
  const normalizedLabel = label.trim().toUpperCase();
  if (normalizedLabel.startsWith('A') || normalizedLabel.startsWith('Ａ')) return formData.choicePathA?.trim();
  if (normalizedLabel.startsWith('B') || normalizedLabel.startsWith('Ｂ')) return formData.choicePathB?.trim();
  return '';
};

const getChoicePathKeyForLabel = (label: string) => {
  const normalizedLabel = label.trim().toUpperCase();
  if (normalizedLabel.startsWith('A') || normalizedLabel.startsWith('Ａ')) return 'A';
  if (normalizedLabel.startsWith('B') || normalizedLabel.startsWith('Ｂ')) return 'B';
  return '';
};

const getCardLine = (
  slot: ReadingSlotData,
  index: number,
  formData: ReadingFormState,
) => {
  const label = slot.label || slot.position || `位置${index + 1}`;
  const orientation = slot.isReversed ? '逆位' : '正位';
  const choicePath = getChoicePathForLabel(label, formData);
  const choicePathKey = getChoicePathKeyForLabel(label);
  const labelWithPath = choicePath && choicePathKey ? `${label}（${choicePathKey} 路：${choicePath}）` : label;
  return `${index + 1}. ${labelWithPath}：${slot.name}（${orientation}）`;
};

const getSpreadReadingGuide = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => {
  if (isChoiceSpread(formData, cardSlots)) {
    return [
      '牌阵结构：这是左右路径式的选择牌阵。',
      `A 路（左侧）代表：${formData.choicePathA?.trim() || '未填写'}`,
      `B 路（右侧）代表：${formData.choicePathB?.trim() || '未填写'}`,
      '请先看现状，再分别串联 A 路与 B 路的近期发展、远期结果，最后做对比。',
    ].join('\n');
  }

  if (isLinearSpread(formData, cardSlots)) {
    const labels = cardSlots
      .map((slot, index) => `${index + 1}. ${slot.label || `位置${index + 1}`}`)
      .join('；');
    return `牌阵结构：这是线性牌阵，请按从左至右的顺序阅读；从左至右分别是：${labels}。`;
  }

  if (cardSlots.length > 1) {
    return '牌阵结构：这是多牌牌阵，请以每张牌所在位置的具体代表含义为主，再观察牌与牌之间的关系。';
  }

  return '';
};

const validateConsultantPromptFields = ({
  formData,
  cardSlots,
}: {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
}) => {
  if (!formData.question.trim()) return REQUIRED_QUESTION_NOTICE;
  if (!formData.spread.trim()) return REQUIRED_SPREAD_NOTICE;
  if (formData.isForClient && !formData.clientName.trim()) return REQUIRED_CLIENT_NAME_NOTICE;
  if (cardSlots.length === 0) return EMPTY_READING_NOTICE;
  if (cardSlots.some(slot => !slot.name.trim())) return INCOMPLETE_CARDS_NOTICE;
  return null;
};

export const getGentleAiPromptNotice = (notice: string) => {
  switch (notice) {
    case REQUIRED_QUESTION_NOTICE:
      return '还差一点：先补上占卜问题，就能生成提示词。';
    case REQUIRED_SPREAD_NOTICE:
      return '还差一点：先选好牌阵，就能生成提示词。';
    case INCOMPLETE_CARDS_NOTICE:
      return '还差一点：把每个位置的牌面补齐后，就能生成提示词。';
    case REQUIRED_CARD_INTERPRETATION_NOTICE:
      return '还差一点：为每张牌写下你的解读后，就能生成提示词。';
    case REQUIRED_CHOICE_PATH_NOTICE:
      return '还差一点：先写清 A 路和 B 路分别代表什么，提示词会更准确。';
    case REQUIRED_CLIENT_NAME_NOTICE:
      return '还差一点：客户模式下先补上客户姓名，就能生成提示词。';
    default:
      return `还差一点：${notice.replace(/[。.]$/, '')}，就能生成提示词。`;
  }
};

export const buildReadingAiPrompt = ({
  formData,
  cardSlots,
  cardInterpretations,
  cardQuestions = [],
  mode = 'mentor',
}: BuildReadingAiPromptInput): ReadingAiPromptResult => {
  const notice = mode === 'consultant'
    ? validateConsultantPromptFields({ formData, cardSlots })
    : validateReadingRequiredFields({ formData, cardSlots, cardInterpretations });
  if (notice) return { ok: false, notice };

  const choicePathNotice = getChoicePathNotice(formData, cardSlots);
  if (choicePathNotice) return { ok: false, notice: choicePathNotice };

  const spreadReadingGuide = getSpreadReadingGuide(formData, cardSlots);
  const consultantCardLines = cardSlots.map((slot, index) => getCardLine(slot, index, formData));
  const mentorCardLines = cardSlots.map((slot, index) => {
    const interpretation = getReadingSlotInterpretation({
      formData,
      cardInterpretations,
      slotIndex: index,
      cardSlots,
    });
    const question = compactText(cardQuestions[index]);

    return [
      getCardLine(slot, index, formData),
      `   我的逐牌解读：${interpretation}`,
      question && `   我对这张牌的疑问：${question}`,
    ].filter(Boolean).join('\n');
  });
  const influenceLines = [
    formData.numerologyInfluence?.trim() && `灵数影响：${compactText(formData.numerologyInfluence)}`,
    formData.astrologyInfluence?.trim() && `行星星座影响：${compactText(formData.astrologyInfluence)}`,
    formData.houseInfluence?.trim() && `宫位影响：${compactText(formData.houseInfluence)}`,
    formData.elementInfluence?.trim() && `元素影响：${compactText(formData.elementInfluence)}`,
  ].filter(Boolean);
  const contextLines = [
    formData.isForClient ? `这是一条客户记录，客户称呼是「${formData.clientName.trim()}」。` : '这是我自己的塔罗记录。',
    formData.category.trim() && `主题或标签：${formData.category.trim()}`,
  ].filter(Boolean);
  const optionalSections = [
    formData.combination.trim() && `我已经写下的组合解读：\n${compactText(formData.combination)}`,
    formData.userFeedback.trim() && `我已经写下的复盘：\n${compactText(formData.userFeedback)}`,
    formData.clientFeedback.trim() && `客户反馈：\n${compactText(formData.clientFeedback)}`,
    influenceLines.length > 0 && `补充解读视角：\n${influenceLines.join('\n')}`,
  ].filter(Boolean);

  if (mode === 'consultant') {
    const consultantContext = formData.isForClient
      ? `现在有一位咨询者来问塔罗，客户称呼是「${formData.clientName.trim()}」。`
      : '现在我想请你帮我解读一组塔罗牌。';

    return {
      ok: true,
      prompt: [
        '你是一位经验非常丰富、擅长韦特体系的塔罗师。',
        consultantContext,
        formData.category.trim() && `咨询主题：${formData.category.trim()}`,
        `具体问题是：\n${formData.question.trim()}`,
        spreadReadingGuide,
        `我采用的是「${formData.spread.trim()}」，牌阵结果如下：\n${consultantCardLines.join('\n')}`,
        '请像正式接到一次咨询一样，结合问题、牌阵结构、每个位置、牌名和正逆位来解读。',
        '如果牌阵里包含 A/B、左右路径、近期/远期、发展/结果这类结构，请把每条路径串起来看，再做对比。',
        '请尽量完整、细致地帮我解读这组牌。',
      ].filter(Boolean).join('\n\n'),
    };
  }

  return {
    ok: true,
    prompt: [
      '你是一位经验非常丰富、擅长韦特体系的塔罗师。现在我想请你基于我已经抽出的牌阵，帮我做一次完整解读。',
      '请不要只逐张解释牌义，而要结合我的问题、牌阵结构、每个位置、正逆位、我已经写下的逐牌解读，以及牌与牌之间的联动来判断。',
      '如果位置里包含 A/B、左右路径、近期/远期、发展/结果这类结构，请把它们按路径串起来比较，不要割裂成单张牌。',
      '请避免绝对化预言，也不要替我做决定；请把重点放在现实处境、不同路径的倾向、可以继续观察的信号，以及我接下来可以如何理解这组牌。',
      contextLines.join('\n'),
      `我这次占卜的问题是：\n${formData.question.trim()}`,
      `我使用的牌阵是：${formData.spread.trim()}`,
      spreadReadingGuide,
      `这次牌阵里每个位置对应的牌如下：\n${mentorCardLines.join('\n')}`,
      ...optionalSections,
      [
        '请你拿出完整、细致的专业能力，按下面的顺序帮我解读：',
        '1. 整体牌阵主轴',
        '2. 各位置逐一解读',
        '3. 牌与牌之间的关系',
        '4. 如果有多个路径，请比较它们的差异与风险',
        '5. 回应我在逐牌里写下的疑问',
        '6. 可以继续观察的现实信号',
        '7. 给出温和但明确的建议',
      ].join('\n'),
    ].filter(Boolean).join('\n\n'),
  };
};
