import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_SPREADS } from '../constants';
import { AddReadingForm } from './AddReadingForm';
import { SpreadDefinition, TarotReading } from '../types';

const renderForm = (overrides: {
  spreads?: SpreadDefinition[];
  initialData?: Partial<TarotReading>;
  existingReadings?: TarotReading[];
} = {}) => {
  const props = {
    onSubmit: vi.fn(),
    isLoading: false,
    isLoggedIn: false,
    spreads: overrides.spreads || OFFICIAL_SPREADS,
    onUpdateSpreads: vi.fn(),
    cardMetadata: [],
    onUpdateCardMetadata: vi.fn(),
    initialData: overrides.initialData,
    existingReadings: overrides.existingReadings || [],
  };

  const utils = render(<AddReadingForm {...props} />);
  return { ...props, ...utils };
};

const makeReading = (
  id: string,
  manualTags: string[],
  readingDate: string,
  overrides: Partial<TarotReading> = {},
): TarotReading => ({
  id,
  userId: 'user-1',
  date: readingDate,
  question: `测试问题 ${id}`,
  spread: '单牌阵',
  cards: [{ name: '愚者', isReversed: false }],
  interpretation: { singleCard: '', combination: '', summary: '' },
  keywords: [],
  manualTags,
  isPublic: false,
  authorName: '见习阁主',
  isAnonymous: false,
  readingDate,
  ...overrides,
});

describe('AddReadingForm spread designer flow', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 640,
      height: 460,
      top: 0,
      right: 640,
      bottom: 460,
      left: 0,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    vi.restoreAllMocks();
  });

  it('closes the spread designer after saving and using a new free layout spread', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    await user.click(screen.getByTestId('free-layout-canvas'));
    await user.click(screen.getByTestId('free-layout-pending-slot'));
    await user.type(screen.getByLabelText('名称'), '命名牌阵');
    await user.click(screen.getByRole('button', { name: '保存并使用' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: '命名牌阵',
          layout: 'free',
          slots: ['位置1'],
          freePositions: [expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), scale: 1 })],
        }),
      ]),
    );
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '牌阵工作台' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('已保存，当前手记正在使用这个牌阵')).toBeInTheDocument();

    expect(screen.getByText('牌阵：')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑当前牌阵 命名牌阵' })).toBeInTheDocument();
  });

  it('asks before overwriting an existing custom spread name', async () => {
    const user = userEvent.setup();
    const existingSpread: SpreadDefinition = {
      name: '个人牌阵',
      layout: 'free',
      slots: ['旧位置'],
      freePositions: [{ x: 10, y: 20, rotation: 0, scale: 1 }],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, existingSpread] });

    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    await user.click(screen.getByTestId('free-layout-canvas'));
    await user.click(screen.getByTestId('free-layout-pending-slot'));
    await user.type(screen.getByLabelText('名称'), '个人牌阵');
    await user.click(screen.getByRole('button', { name: '保存并使用' }));

    expect(screen.getByText('牌阵名称已存在')).toBeInTheDocument();
    expect(props.onUpdateSpreads).not.toHaveBeenCalled();
  });

  it('can save a conflicting spread as a copy', async () => {
    const user = userEvent.setup();
    const existingSpread: SpreadDefinition = {
      name: '个人牌阵',
      layout: 'free',
      slots: ['旧位置'],
      freePositions: [{ x: 10, y: 20, rotation: 0, scale: 1 }],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, existingSpread] });

    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    await user.click(screen.getByTestId('free-layout-canvas'));
    await user.click(screen.getByTestId('free-layout-pending-slot'));
    await user.type(screen.getByLabelText('名称'), '个人牌阵');
    await user.click(screen.getByRole('button', { name: '保存并使用' }));
    await user.click(screen.getByRole('button', { name: '另存为副本' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(
      expect.arrayContaining([
        existingSpread,
        expect.objectContaining({
          name: '个人牌阵 副本',
          layout: 'free',
          slots: ['位置1'],
        }),
      ]),
    );
  });

  it('can overwrite a conflicting custom spread after confirmation', async () => {
    const user = userEvent.setup();
    const existingSpread: SpreadDefinition = {
      name: '个人牌阵',
      layout: 'free',
      slots: ['旧位置'],
      freePositions: [{ x: 10, y: 20, rotation: 0, scale: 1 }],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, existingSpread] });

    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    await user.click(screen.getByTestId('free-layout-canvas'));
    await user.click(screen.getByTestId('free-layout-pending-slot'));
    await user.type(screen.getByLabelText('名称'), '个人牌阵');
    await user.click(screen.getByRole('button', { name: '保存并使用' }));
    await user.click(screen.getByRole('button', { name: '覆盖原牌阵' }));

    const updatedSpreads = props.onUpdateSpreads.mock.calls[0][0] as SpreadDefinition[];
    const overwritten = updatedSpreads.find(spread => spread.name === '个人牌阵');

    expect(updatedSpreads.filter(spread => spread.name === '个人牌阵')).toHaveLength(1);
    expect(overwritten).toEqual(expect.objectContaining({
      name: '个人牌阵',
      layout: 'free',
      slots: ['位置1'],
    }));
  });

  it('opens the selected custom spread in edit context and confirms before deletion', async () => {
    const user = userEvent.setup();
    const customSpread: SpreadDefinition = {
      name: '镜像牌阵',
      layout: 'free',
      slots: ['左侧', '右侧'],
      freePositions: [
        { x: 120, y: 140, rotation: 0, scale: 1 },
        { x: 260, y: 140, rotation: 0, scale: 1 },
      ],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, customSpread] });

    await user.selectOptions(screen.getByRole('combobox'), '镜像牌阵');
    await user.click(screen.getByRole('button', { name: '编辑当前牌阵 镜像牌阵' }));

    expect(screen.getByRole('button', { name: '保存修改' })).toBeInTheDocument();
    expect(screen.getByLabelText('名称')).toHaveValue('镜像牌阵');
    expect(screen.getByText('位置数量：2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '删除牌阵 镜像牌阵' }));

    expect(screen.getByText('删除自定义牌阵')).toBeInTheDocument();
    expect(props.onUpdateSpreads).not.toHaveBeenCalled();

    const deleteDialog = screen.getByRole('dialog', { name: '删除自定义牌阵' });
    await user.click(within(deleteDialog).getByRole('button', { name: '删除' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(expect.not.arrayContaining([
      expect.objectContaining({ name: '镜像牌阵' }),
    ]));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '牌阵工作台' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('已删除自定义牌阵')).toBeInTheDocument();
  });

  it('lets users delete the selected custom spread from the spread control bar', async () => {
    const user = userEvent.setup();
    const customSpread: SpreadDefinition = {
      name: '二择镜像',
      layout: 'choice',
      slots: ['现状', 'A近期发展', 'B近期发展', 'A远期结果', 'B远期结果'],
      slotPositions: [
        'col-start-3 row-start-3',
        'col-start-2 row-start-2',
        'col-start-4 row-start-2',
        'col-start-1 row-start-1',
        'col-start-5 row-start-1',
      ],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, customSpread] });

    await user.selectOptions(screen.getByRole('combobox'), '二择镜像');
    await user.click(screen.getByRole('button', { name: '删除当前自定义牌阵 二择镜像' }));

    expect(screen.getByRole('dialog', { name: '删除自定义牌阵' })).toBeInTheDocument();
    expect(props.onUpdateSpreads).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole('dialog', { name: '删除自定义牌阵' })).getByRole('button', { name: '删除' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(expect.not.arrayContaining([
      expect.objectContaining({ name: '二择镜像' }),
    ]));
  });

  it('renames an existing custom spread instead of creating a duplicate', async () => {
    const user = userEvent.setup();
    const customSpread: SpreadDefinition = {
      name: '旧名字牌阵',
      layout: 'free',
      slots: ['左侧', '右侧'],
      freePositions: [
        { x: 120, y: 140, rotation: 0, scale: 1 },
        { x: 260, y: 140, rotation: 0, scale: 1 },
      ],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, customSpread] });

    await user.selectOptions(screen.getByRole('combobox'), '旧名字牌阵');
    await user.click(screen.getByRole('button', { name: '编辑当前牌阵 旧名字牌阵' }));
    await user.clear(screen.getByLabelText('名称'));
    await user.type(screen.getByLabelText('名称'), '新名字牌阵');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    const updatedSpreads = props.onUpdateSpreads.mock.calls[0][0] as SpreadDefinition[];

    expect(updatedSpreads).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '新名字牌阵' }),
    ]));
    expect(updatedSpreads).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ name: '旧名字牌阵' }),
    ]));
  });

  it('uses an existing custom spread as a template without replacing it when creating a new spread', async () => {
    const user = userEvent.setup();
    const customSpread: SpreadDefinition = {
      name: '镜像牌阵',
      layout: 'free',
      slots: ['左侧', '右侧'],
      freePositions: [
        { x: 120, y: 140, rotation: 0, scale: 1 },
        { x: 260, y: 140, rotation: 0, scale: 1 },
      ],
    };
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, customSpread] });

    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    await user.selectOptions(screen.getByLabelText('基于已有改造'), '镜像牌阵');
    await user.click(screen.getByRole('button', { name: '保存并使用' }));

    const updatedSpreads = props.onUpdateSpreads.mock.calls[0][0] as SpreadDefinition[];

    expect(updatedSpreads).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '镜像牌阵' }),
      expect.objectContaining({ name: '镜像牌阵 改造' }),
    ]));
    expect(updatedSpreads.filter(spread => spread.name === '镜像牌阵')).toHaveLength(1);
    expect(updatedSpreads.filter(spread => spread.name.includes('副本'))).toHaveLength(0);
  });

  it('groups official and custom spreads in the selector with separate edit and create actions', () => {
    const customSpread: SpreadDefinition = {
      name: '镜像牌阵',
      layout: 'free',
      slots: ['左侧'],
      freePositions: [{ x: 120, y: 140, rotation: 0, scale: 1 }],
    };

    renderForm({ spreads: [...OFFICIAL_SPREADS, customSpread] });

    const spreadSelect = screen.getByRole('combobox');
    expect(spreadSelect.querySelector('optgroup[label="官方牌阵"]')).toBeInTheDocument();
    expect(spreadSelect.querySelector('optgroup[label="自定义牌阵 (1)"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑当前牌阵 单牌阵' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建自定义牌阵' })).toBeInTheDocument();
    expect(screen.getByTestId('spread-control-bar').firstElementChild).toHaveClass('sm:flex');
  });

  it('does not expose the quick add-position button for official spreads', async () => {
    const user = userEvent.setup();
    const customSpread: SpreadDefinition = {
      name: '镜像牌阵',
      layout: 'free',
      slots: ['左侧', '右侧'],
      freePositions: [
        { x: 120, y: 140, rotation: 0, scale: 1 },
        { x: 260, y: 140, rotation: 0, scale: 1 },
      ],
    };

    renderForm({ spreads: [...OFFICIAL_SPREADS, customSpread] });

    expect(screen.queryByRole('button', { name: '添加自定义位置' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), '镜像牌阵');

    expect(screen.getByRole('button', { name: '添加自定义位置' })).toBeInTheDocument();
  });

  it('shows A and B path fields for choice spreads', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText('A 路代表')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), '选择牌阵');

    expect(screen.getByTestId('choice-path-fields')).toBeInTheDocument();
    expect(screen.getByLabelText('A 路代表')).toHaveAttribute('placeholder', '例如：三个月内离职，和私人老板合作');
    expect(screen.getByLabelText('B 路代表')).toHaveAttribute('placeholder', '例如：继续留在当前单位');
  });

  it('does not expose per-position remove controls while filling a finished spread', () => {
    renderForm();

    expect(screen.queryByRole('button', { name: /移除第 1 个位置/ })).not.toBeInTheDocument();
  });

  it('keeps public sharing and anonymous sharing mutually exclusive in advanced options', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /高级选项/ }));

    const publicShare = screen.getByLabelText('公开到研习广场') as HTMLInputElement;
    const anonymousShare = screen.getByLabelText('匿名分享到广场') as HTMLInputElement;

    await user.click(publicShare);

    expect(publicShare).toBeChecked();
    expect(anonymousShare).not.toBeChecked();

    await user.click(anonymousShare);

    expect(publicShare).not.toBeChecked();
    expect(anonymousShare).toBeChecked();

    await user.click(anonymousShare);

    expect(publicShare).not.toBeChecked();
    expect(anonymousShare).not.toBeChecked();
  });

  it('shows a compact mobile slot navigator for complex spreads', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByRole('combobox'), '凯尔特十字牌阵');

    const mobileNav = screen.getByTestId('mobile-slot-quick-nav');
    expect(mobileNav).toBeInTheDocument();
    expect(within(mobileNav).getByRole('button', { name: '打开第 10 个位置：结果' })).toBeInTheDocument();
  });

  it('keeps users in card-entry flow until every spread position has a card', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
    window.scrollTo = scrollTo;

    renderForm();

    await user.selectOptions(screen.getByRole('combobox'), '无牌阵三张');
    await user.click(screen.getByRole('button', { name: '1 第一张' }));
    expect(screen.getByRole('heading', { name: '选择第 1 张：第一张' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '愚者 愚者' }));

    expect(screen.getByPlaceholderText('记录关于“第一张”的直觉与洞察...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /组合解读/ })).toBeInTheDocument();
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 1/3');
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('可继续补齐牌面，也可下滑给已选牌写解读。');
    expect(scrollTo).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '打开第 2 个位置：第二张' }));
    expect(screen.getByRole('heading', { name: '选择第 2 张：第二张' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '魔术师 魔术师' }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('记录关于“第二张”的直觉与洞察...')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '3 第三张' }));
    expect(screen.getByRole('heading', { name: '选择第 3 张：第三张' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '女祭司 女祭司' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('记录关于“第三张”的直觉与洞察...')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /组合解读/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    });

    await user.click(screen.getByRole('button', { name: '打开第 1 个位置：第一张' }));
    expect(screen.queryByRole('heading', { name: /选择第/ })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('记录关于“第一张”的直觉与洞察...')).toBeInTheDocument();
    });
  });

  it('saves an incomplete multi-card reading from the unified save action', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '先把牌面记下来');
    await user.selectOptions(screen.getByRole('combobox'), '无牌阵三张');
    await user.click(screen.getByRole('button', { name: '1 第一张' }));
    await user.click(screen.getByRole('button', { name: '愚者 愚者' }));
    await user.click(screen.getByRole('button', { name: '保存手记' }));

    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      question: '先把牌面记下来',
      cards: expect.arrayContaining([
        expect.objectContaining({ name: '愚者' }),
      ]),
      cardInterpretations: ['', '', ''],
    }));
  });

  it('lets users hide an official spread without deleting it', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: '隐藏官方牌阵 单牌阵' }));
    expect(screen.getByRole('dialog', { name: '隐藏官方牌阵' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: '隐藏官方牌阵' })).getByRole('button', { name: '隐藏' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: '单牌阵', isHidden: true }),
    ]));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).not.toBe('单牌阵');
  });

  it('restores hidden official spreads from the spread selector', async () => {
    const user = userEvent.setup();

    const hiddenSpreads = OFFICIAL_SPREADS.map((spread, index) => (
      index === 1 ? { ...spread, isHidden: true } : spread
    ));
    const props = renderForm({ spreads: hiddenSpreads });

    await user.click(screen.getByRole('button', { name: '恢复隐藏的官方牌阵，共 1 个' }));
    await user.click(within(screen.getByRole('dialog', { name: '恢复默认设置' })).getByRole('button', { name: '确定恢复' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: OFFICIAL_SPREADS[1].name }),
    ]));
    const restoredSpreads = props.onUpdateSpreads.mock.calls[0][0] as SpreadDefinition[];
    expect(restoredSpreads.find(spread => spread.name === OFFICIAL_SPREADS[1].name)?.isHidden).toBeUndefined();
  });

  it('shows a gentle AI prompt reminder only after users try to generate it too early', async () => {
    const user = userEvent.setup();
    renderForm({
      initialData: {
        question: '',
        spread: '单牌阵',
        layoutType: 'horizontal',
        category: '事业',
        interpretation: { singleCard: '', combination: '', summary: '' },
        cards: [{ name: '愚者', isReversed: false }],
        cardInterpretations: ['新的开始'],
        slotLabels: ['主牌'],
        slotPositions: [''],
        rotatedSlots: [],
      },
    });

    await user.click(screen.getByRole('button', { name: /添加复盘/ }));

    const generateButton = screen.getByRole('button', { name: '生成导师提示词' });
    expect(generateButton).toBeEnabled();
    expect(screen.queryByText(/还差一点/)).not.toBeInTheDocument();

    await user.click(generateButton);

    expect(screen.getByText('还差一点：先补上占卜问题，就能生成提示词。')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '测试问题');

    expect(screen.queryByText(/还差一点/)).not.toBeInTheDocument();
  });

  it('generates a copyable AI prompt inside the feedback section from completed reading information', async () => {
    const user = userEvent.setup();
    renderForm({
      initialData: {
        question: '这次工作选择该怎么看？',
        spread: '单牌阵',
        layoutType: 'horizontal',
        category: '事业',
        interpretation: { singleCard: '', combination: '', summary: '' },
        cards: [{ name: '愚者', isReversed: false }],
        cardInterpretations: ['新的开始，也有不确定。'],
        cardQuestions: ['这张牌是在鼓励我开始，还是提醒我太冲动？'],
        slotLabels: ['主牌'],
        slotPositions: [''],
        rotatedSlots: [],
      },
    });

    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));

    const prompt = screen.getByLabelText('生成的 AI 解牌提示词：导师复盘') as HTMLTextAreaElement;
    expect(prompt.value).toContain('你是一位经验非常丰富、擅长韦特体系的塔罗师');
    expect(prompt.value).toContain('我这次占卜的问题是：\n这次工作选择该怎么看？');
    expect(prompt.value).toContain('1. 主牌：愚者（正位）');
    expect(prompt.value).toContain('我的逐牌解读：新的开始，也有不确定。');
    expect(prompt.value).toContain('我对这张牌的疑问：这张牌是在鼓励我开始，还是提醒我太冲动？');
  });

  it('suggests recent and matching historical tags in the tag field', async () => {
    const user = userEvent.setup();
    renderForm({
      existingReadings: [
        makeReading('career', ['事业'], '2026-07-01T08:00:00.000Z'),
        makeReading('emotion', ['情绪'], '2026-07-03T08:00:00.000Z'),
        makeReading('career-repeat', ['事业'], '2026-07-04T08:00:00.000Z'),
      ],
    });

    const tagInput = screen.getByRole('textbox', { name: '标签' });

    expect(screen.queryByTestId('tag-suggestion-bar')).not.toBeInTheDocument();

    await user.click(tagInput);
    expect(screen.getByTestId('tag-suggestion-bar')).toBeInTheDocument();
    expect(screen.getAllByRole('option')[0]).toHaveAccessibleName('使用历史标签：事业，用过 2 次');

    await user.type(tagInput, '事');
    expect(screen.getByRole('option', { name: '使用历史标签：事业，用过 2 次' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '使用历史标签：情绪' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '使用历史标签：事业，用过 2 次' }));
    expect(tagInput).toHaveValue('事业');
    await waitFor(() => {
      expect(screen.queryByTestId('tag-suggestion-bar')).not.toBeInTheDocument();
    });
  });

  it('can generate a consultant AI prompt without exposing the user interpretation notes', async () => {
    const user = userEvent.setup();
    renderForm({
      initialData: {
        question: '这次工作选择该怎么看？',
        spread: '单牌阵',
        layoutType: 'horizontal',
        category: '事业',
        interpretation: { singleCard: '', combination: '', summary: '' },
        cards: [{ name: '愚者', isReversed: false }],
        cardInterpretations: ['这是我自己的思路，不应该放进咨询版。'],
        cardQuestions: ['这里也不应该给到咨询版。'],
        slotLabels: ['主牌'],
        slotPositions: [''],
        rotatedSlots: [],
      },
    });

    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '咨询解牌直接看牌阵' }));
    await user.click(screen.getByRole('button', { name: '生成咨询提示词' }));

    const prompt = screen.getByLabelText('生成的 AI 解牌提示词：咨询解牌') as HTMLTextAreaElement;
    expect(prompt.value).toContain('请像正式接到一次咨询一样');
    expect(prompt.value).toContain('1. 主牌：愚者（正位）');
    expect(prompt.value).not.toContain('这是我自己的思路');
    expect(prompt.value).not.toContain('这里也不应该给到咨询版');
    expect(prompt.value).not.toContain('我的逐牌解读');
  });
});
