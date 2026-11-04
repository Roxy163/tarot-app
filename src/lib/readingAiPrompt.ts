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
  includeSupplementary?: boolean;
};

export type ReadingAiPromptResult =
  | { ok: true; prompt: string }
  | { ok: false; notice: string };

const compactText = (value?: string) => value?.trim().replace(/\n{3,}/g, '\n\n') || '';

const getChoicePathKeyForLabel = (label: string) => (
  label.trim().normalize('NFKC').match(/^([AB])(?=$|[^a-z])/i)?.[1].toUpperCase()
);

export const isReadingChoiceSpread = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => (
  formData.layoutType === 'choice'
  || formData.spread === '选择牌阵'
  || ['A', 'B'].every(key => cardSlots.some(slot => getChoicePathKeyForLabel(slot.label?.trim() || slot.position?.trim() || '') === key))
);

const getChoicePathNotice = (formData: ReadingFormState, cardSlots: ReadingSlotData[]) => {
  if (!isReadingChoiceSpread(formData, cardSlots)) return null;
  if (formData.choicePathA?.trim() && formData.choicePathB?.trim()) return null;
  return REQUIRED_CHOICE_PATH_NOTICE;
};

const getCardLine = (
  slot: ReadingSlotData,
  index: number,
) => {
  const label = slot.label?.trim() || slot.position?.trim() || `位置${index + 1}`;
  const orientation = slot.isReversed ? '逆位' : '正位';
  return `${index + 1}. ${label}：${slot.name}（${orientation}）`;
};

export const hasReadingAiSupplementary = (formData: ReadingFormState) => [
  formData.userFeedback, formData.clientFeedback, formData.numerologyInfluence,
  formData.astrologyInfluence, formData.houseInfluence, formData.elementInfluence,
].some(value => Boolean(value?.trim()));

const validateConsultantPromptFields = ({
  formData,
  cardSlots,
}: {
  formData: ReadingFormState;
  cardSlots: ReadingSlotData[];
}) => {
  if (!formData.question.trim()) return REQUIRED_QUESTION_NOTICE;
  if (!formData.spread.trim()) return REQUIRED_SPREAD_NOTICE;
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
      return '还差一点：先记下一点自己的想法，就能生成导师提示词。';
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
  includeSupplementary = false,
}: BuildReadingAiPromptInput): ReadingAiPromptResult => {
  const notice = mode === 'consultant'
    ? validateConsultantPromptFields({ formData, cardSlots })
    : validateReadingRequiredFields({ formData: { ...formData, isForClient: false }, cardSlots, cardInterpretations });
  const hasOwnThoughts = [formData.combination, formData.singleCard, ...cardInterpretations.slice(0, cardSlots.length)].some(value => Boolean(value?.trim()));
  if (notice && !(mode === 'mentor' && notice === REQUIRED_CARD_INTERPRETATION_NOTICE && hasOwnThoughts)) return { ok: false, notice };

  const choicePathNotice = getChoicePathNotice(formData, cardSlots);
  if (choicePathNotice) return { ok: false, notice: choicePathNotice };

  const choice = isReadingChoiceSpread(formData, cardSlots);
  const consultantCardLines = cardSlots.map(getCardLine);
  const mentorCardLines = cardSlots.map((slot, index) => {
    const interpretation = getReadingSlotInterpretation({
      formData,
      cardInterpretations,
      slotIndex: index,
      cardSlots,
    });
    const question = compactText(cardQuestions[index]);

    return [
      getCardLine(slot, index),
      interpretation && `   我的理解：${interpretation}`,
      question && `   疑问：${question}`,
    ].filter(Boolean).join('\n');
  });
  const legacyThought = compactText(formData.singleCard);
  const additionalThought = legacyThought && legacyThought !== compactText(formData.combination)
    && !cardSlots.some((_, slotIndex) => compactText(getReadingSlotInterpretation({ formData, cardSlots, cardInterpretations, slotIndex })) === legacyThought)
    ? legacyThought : '';
  const influenceLines = [
    formData.numerologyInfluence?.trim() && `灵数影响：${compactText(formData.numerologyInfluence)}`,
    formData.astrologyInfluence?.trim() && `行星星座影响：${compactText(formData.astrologyInfluence)}`,
    formData.houseInfluence?.trim() && `宫位影响：${compactText(formData.houseInfluence)}`,
    formData.elementInfluence?.trim() && `元素影响：${compactText(formData.elementInfluence)}`,
  ].filter(Boolean);
  const retrospective = [
    formData.userFeedback.trim() && `我的复盘：${compactText(formData.userFeedback)}`,
    formData.clientFeedback.trim() && `客户反馈：${compactText(formData.clientFeedback)}`,
  ].filter(Boolean);
  const optionalSections = [
    retrospective.length > 0 && `事后反馈（已发生）：\n${retrospective.join('\n')}\n请对照原解读与实际经历，避免事后倒推。`,
    influenceLines.length > 0 && `补充解读视角：\n${influenceLines.join('\n')}`,
  ].filter(Boolean);
  const mentor = mode === 'mentor';
  const context = compactText(formData.aiContext);
  return {
    ok: true,
    prompt: [
      mentor
        ? '按韦特体系，检查我的解读，重点回应已有理解，指出牌面依据、推理跳跃与遗漏，不必重做整套解牌。'
        : '按韦特体系，先回应核心问题，再用牌位与正逆位说明依据及相关的可能表现或情境。所有牌位都纳入综合，按与问题的相关性分配篇幅；有依据再谈条件或盲点，不强行制造冲突。给出与问题相应、可观察或尝试的建议。',
      [
        `问题：${compactText(formData.question)}`,
        `牌阵：${formData.spread.trim()}`,
        choice && `A：${compactText(formData.choicePathA)}\nB：${compactText(formData.choicePathB)}`,
      ].filter(Boolean).join('\n'),
      context && `用户描述的背景与关注点：\n${context}\n其中的关注、期待与假设不等于已发生事实。`,
      (mentor ? mentorCardLines : consultantCardLines).join('\n'),
      mentor && formData.combination.trim() && `我的整体解读：\n${compactText(formData.combination)}`,
      mentor && additionalThought && `我的想法：\n${additionalThought}`,
      ...(mentor && includeSupplementary ? optionalSections : []),
      [
        cardSlots.length > 1 && `${mentor ? '检验我的理解时，' : ''}结合实际牌位说明有依据的关键牌间关系，不逐对硬配。`,
        cardSlots.length > 1 && '牌位仅标注抽牌顺序、未定义具体含义时，只按顺序综合，不自行补设时间线或其他含义。',
        choice && (mentor ? '检查我的 A/B 比较是否符合已说明的路径与牌位。' : '比较 A/B 的差异与风险。'),
        mentor && cardQuestions.slice(0, cardSlots.length).some(question => question?.trim()) && '优先回答我的疑问。',
        '不代填缺失背景，忠实保留已说明的时限、路径与限制。',
        '区分牌面依据与推测，避免确定性预言。',
      ].filter(Boolean).join(''),
    ].filter(Boolean).join('\n\n'),
  };
};
