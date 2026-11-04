import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_SPREADS } from '../constants';
import { AddReadingForm } from './AddReadingForm';
import { readLocalDraft, resetDraftMemory } from '../hooks/useLocalDraft';
import { SpreadDefinition, TarotReading } from '../types';
import * as spreadReveal from '../lib/revealReadingSpread';
import { findResumableReading } from '../lib/resumableReading';

const renderForm = (overrides: {
  spreads?: SpreadDefinition[];
  initialData?: Partial<TarotReading>;
  existingReadings?: TarotReading[];
  userId?: string;
} = {}) => {
  const props = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
    isLoggedIn: false,
    userId: overrides.userId,
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

const pairedSpread: SpreadDefinition = { name: '关联回归双牌', layout: 'free', slots: ['左侧', '右侧'], freePositions: [
  { x: -20, y: 40, rotation: 17, scale: 0.8 }, { x: 190, y: 270, rotation: -12, scale: 1.2 },
] };
const pairedReading = (id: string) => makeReading(id, [], '2026-11-03', {
  spread: pairedSpread.name, layoutType: 'free', slotLabels: pairedSpread.slots,
  cards: pairedSpread.freePositions!.map((position, index) => ({ ...position, name: index ? '隐士' : '太阳', isReversed: Boolean(index), label: pairedSpread.slots[index] })),
  cardInterpretations: ['太阳独有注解', '隐士独有注解'], cardQuestions: ['太阳独有疑问', '隐士独有疑问'],
});

describe('AddReadingForm spread designer flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetDraftMemory();
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

  it('keeps the card, writing and active indices together through workbench reordering, draft reload, and undo', async () => {
    const user = userEvent.setup();
    const initialData = pairedReading('reorder-associations');
    const options = { spreads: [...OFFICIAL_SPREADS, pairedSpread], initialData };
    const first = renderForm(options);
    await user.click(screen.getByRole('button', { name: '逐牌研习（可选）' }));
    await user.click(screen.getByRole('button', { name: '打开第 2 个位置：右侧' }));
    await user.click(screen.getByRole('button', { name: `编辑当前牌阵 ${pairedSpread.name}` }));
    const workspace = screen.getByRole('main', { name: '牌阵工作台' });
    const order = within(workspace).getByRole('spinbutton', { name: '修改第 2 个位置序号' });
    await user.clear(order); await user.type(order, '1'); await user.tab();
    const key = 'tarot_reading_draft_guest_reorder-associations';
    const reordered = readLocalDraft<any>(key);
    expect(reordered.cardSlots.map((card: any) => card.name)).toEqual(['隐士', '太阳']);
    expect(reordered.cardInterpretations).toEqual(['隐士独有注解', '太阳独有注解']);
    expect(reordered.cardQuestions).toEqual(['隐士独有疑问', '太阳独有疑问']);
    expect([reordered.activeSlotIndex, reordered.readingDetailSlotIndex]).toEqual([0, 0]);
    first.unmount(); resetDraftMemory();
    const second = renderForm(options);
    const resumed = screen.getByRole('main', { name: '牌阵工作台' });
    expect(readLocalDraft<any>(key).cardInterpretations).toEqual(reordered.cardInterpretations);
    await user.click(within(resumed).getByRole('button', { name: '撤销' }));
    const restored = readLocalDraft<any>(key);
    expect(restored.cardSlots.map((card: any) => card.name)).toEqual(['太阳', '隐士']);
    expect(restored.cardInterpretations).toEqual(initialData.cardInterpretations);
    expect(restored.cardQuestions).toEqual(initialData.cardQuestions);
    expect([restored.activeSlotIndex, restored.readingDetailSlotIndex]).toEqual([1, 1]);
    await user.click(within(resumed).getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '牌阵工作台' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(second.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cardInterpretations: initialData.cardInterpretations, cardQuestions: initialData.cardQuestions }));
  });

  it('deletes writing with its slot and restores it with undo, and records the 600ms long press as one complete operation', async () => {
    const user = userEvent.setup();
    const initialData = pairedReading('delete-associations');
    renderForm({ spreads: [...OFFICIAL_SPREADS, pairedSpread], initialData });
    await user.click(screen.getByRole('button', { name: `编辑当前牌阵 ${pairedSpread.name}` }));
    const workspace = screen.getByRole('main', { name: '牌阵工作台' });
    await user.click(within(workspace).getByRole('button', { name: '删除位置：左侧' }));
    const key = 'tarot_reading_draft_guest_delete-associations';
    expect(readLocalDraft<any>(key).cardInterpretations).toEqual(['隐士独有注解']);
    expect(readLocalDraft<any>(key).cardQuestions).toEqual(['隐士独有疑问']);
    await user.click(within(workspace).getByRole('button', { name: '撤销' }));
    await user.click(within(workspace).getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '牌阵工作台' })).not.toBeInTheDocument());
    const face = screen.getAllByAltText('太阳').map(image => image.closest('button')).find(Boolean)!;
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(face);
      act(() => { vi.advanceTimersByTime(599); });
      expect(readLocalDraft<any>(key).cardSlots[0].name).toBe('太阳');
      act(() => { vi.advanceTimersByTime(1); });
      fireEvent.pointerUp(face);
      expect(readLocalDraft<any>(key).cardSlots[0].name).toBe('');
      expect(readLocalDraft<any>(key).cardInterpretations).toEqual(['', '隐士独有注解']);
      expect(readLocalDraft<any>(key).cardQuestions).toEqual(['', '隐士独有疑问']);
      fireEvent.click(screen.getByRole('button', { name: '撤销牌位操作' }));
      expect(readLocalDraft<any>(key).cardSlots[0]).toMatchObject(initialData.cards[0]);
      expect(readLocalDraft<any>(key).cardInterpretations).toEqual(initialData.cardInterpretations);
      expect(readLocalDraft<any>(key).cardQuestions).toEqual(initialData.cardQuestions);
    } finally { vi.useRealTimers(); }
  });

  it('submits the matching notes and questions after accepting a reordered design', async () => {
    const user = userEvent.setup();
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, pairedSpread], initialData: pairedReading('reorder-save') });
    await user.click(screen.getByRole('button', { name: `编辑当前牌阵 ${pairedSpread.name}` }));
    const workspace = screen.getByRole('main', { name: '牌阵工作台' });
    const order = within(workspace).getByRole('spinbutton', { name: '修改第 2 个位置序号' });
    await user.clear(order); await user.type(order, '1'); await user.tab();
    await user.click(within(workspace).getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '牌阵工作台' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    const saved = props.onSubmit.mock.calls[0][0];
    expect(saved.cards.map((card: any) => card.name)).toEqual(['隐士', '太阳']);
    expect(saved.cardInterpretations).toEqual(['隐士独有注解', '太阳独有注解']);
    expect(saved.cardQuestions).toEqual(['隐士独有疑问', '太阳独有疑问']);
  });

  it.each(['template', 'blank'] as const)('confirms %s replacement and undoes the entire unsaved workspace, including after reload', async action => {
    const user = userEvent.setup();
    const initialData = pairedReading(`workspace-${action}`);
    const options = { spreads: [...OFFICIAL_SPREADS, pairedSpread], initialData };
    const first = renderForm(options);
    const key = `tarot_reading_draft_guest_workspace-${action}`;
    const originalSlots = readLocalDraft<any>(key).cardSlots;
    await user.click(screen.getByRole('button', { name: `编辑当前牌阵 ${pairedSpread.name}` }));
    const workspace = screen.getByRole('main', { name: '牌阵工作台' });
    await user.clear(within(workspace).getByRole('textbox', { name: '名称' }));
    await user.type(within(workspace).getByRole('textbox', { name: '名称' }), '还没保存的名字');
    await user.click(within(workspace).getByRole('button', { name: '自适应居中' }));
    const before = readLocalDraft<any>(key);
    if (action === 'template') await user.selectOptions(within(workspace).getByRole('combobox', { name: '基于已有改造' }), '时间流牌阵');
    else await user.click(within(workspace).getByRole('button', { name: '新建空白' }));
    const confirmation = screen.getByRole('dialog', { name: action === 'template' ? '切换牌阵模板' : '新建空白牌阵' });
    expect(readLocalDraft<any>(key).cardSlots).toEqual(before.cardSlots);
    await user.click(within(confirmation).getByRole('button', { name: '继续替换' }));
    const changed = readLocalDraft<any>(key);
    expect(changed.workspaceBackup.cardSlots).toEqual(originalSlots);
    if (action === 'template') expect(changed.cardSlots.map((card: any) => card.name)).toEqual(['太阳', '隐士', '']);
    else expect(changed.cardSlots).toEqual([]);
    first.unmount(); resetDraftMemory();
    renderForm(options);
    const resumed = screen.getByRole('main', { name: '牌阵工作台' });
    await user.click(within(resumed).getByRole('button', { name: '撤销' }));
    const restored = readLocalDraft<any>(key);
    for (const field of ['cardSlots', 'cardInterpretations', 'cardQuestions', 'newSpreadName', 'freeLayoutSaveMode', 'activeSlotIndex', 'readingDetailSlotIndex', 'designActiveSlot']) expect(restored[field]).toEqual(before[field]);
    await user.click(within(resumed).getByRole('button', { name: '返回（牌阵工作台）' }));
    await user.click(screen.getByRole('button', { name: '放弃修改并返回' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '牌阵工作台' })).not.toBeInTheDocument());
    expect(readLocalDraft<any>(key).cardSlots).toEqual(originalSlots);
    expect(readLocalDraft<any>(key).cardInterpretations).toEqual(initialData.cardInterpretations);
    expect(readLocalDraft<any>(key).cardQuestions).toEqual(initialData.cardQuestions);
  });

  it('restores old slot-only undo entries without moving the current writing onto another card', async () => {
    const user = userEvent.setup();
    const initialData = pairedReading('legacy-slot-history');
    const options = { spreads: [...OFFICIAL_SPREADS, pairedSpread], initialData };
    const first = renderForm(options);
    const key = 'tarot_reading_draft_guest_legacy-slot-history';
    const old = readLocalDraft<any>(key);
    first.unmount();
    old.history = [old.cardSlots];
    old.cardSlots = [...old.cardSlots].reverse();
    old.cardInterpretations = [...old.cardInterpretations].reverse();
    old.cardQuestions = [...old.cardQuestions].reverse();
    sessionStorage.clear(); resetDraftMemory();
    localStorage.setItem(key, JSON.stringify(old));
    renderForm(options);
    await user.click(screen.getByRole('button', { name: '撤销牌位操作' }));
    expect(readLocalDraft<any>(key).cardSlots.map((card: any) => card.name)).toEqual(['太阳', '隐士']);
    expect(readLocalDraft<any>(key).cardInterpretations).toEqual(initialData.cardInterpretations);
    expect(readLocalDraft<any>(key).cardQuestions).toEqual(initialData.cardQuestions);
  });

  it('keeps the source reading intact while applying a blank new design and confirms before reducing its written positions', async () => {
    const user = userEvent.setup();
    const initialData = pairedReading('blank-design-source');
    const props = renderForm({ spreads: [...OFFICIAL_SPREADS, pairedSpread], initialData });
    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    const workspace = screen.getByRole('main', { name: '牌阵工作台' });
    await user.click(within(workspace).getByTestId('free-layout-canvas'));
    await user.click(within(workspace).getByTestId('free-layout-pending-slot'));
    await user.type(within(workspace).getByRole('textbox', { name: '名称' }), '新的单位置设计');
    await user.click(within(workspace).getByRole('button', { name: '保存并使用' }));
    expect(screen.getByRole('dialog', { name: '应用较少的位置？' })).toBeInTheDocument();
    expect(props.onUpdateSpreads).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '应用新设计' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: '牌阵工作台' })).not.toBeInTheDocument());
    const saved = readLocalDraft<any>('tarot_reading_draft_guest_blank-design-source');
    expect(saved.cardSlots[0].name).toBe('太阳');
    expect(saved.cardInterpretations).toEqual(['太阳独有注解']);
    expect(saved.cardQuestions).toEqual(['太阳独有疑问']);
    await user.click(screen.getByRole('button', { name: '撤销牌位操作' }));
    expect(readLocalDraft<any>('tarot_reading_draft_guest_blank-design-source').cardSlots.map((card: any) => card.name)).toEqual(['太阳', '隐士']);
  });

  it('confirms shrinking a filled spread and restores every card and note after reopening and undoing', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('switch-protection', [], '2026-10-21', {
      spread: '无牌阵三张', layoutType: 'horizontal',
      cards: [{ name: '愚者', isReversed: false }, { name: '魔术师', isReversed: true }, { name: '女祭司', isReversed: false }],
      cardInterpretations: ['保留第一段', '保留第二段', '保留第三段'], cardQuestions: ['', '', '第三张的问题'],
    });
    const first = renderForm({ initialData });
    await user.selectOptions(screen.getByRole('combobox'), '单牌阵');
    await user.click(screen.getByRole('button', { name: '保留当前牌阵' }));
    expect(screen.getByRole('combobox')).toHaveValue('无牌阵三张');
    expect(readLocalDraft<any>('tarot_reading_draft_guest_switch-protection').cardSlots).toHaveLength(3);
    await user.selectOptions(screen.getByRole('combobox'), '单牌阵');
    await user.click(screen.getByRole('button', { name: '切换牌阵' }));
    expect(readLocalDraft<any>('tarot_reading_draft_guest_switch-protection').cardSlots).toHaveLength(1);
    first.unmount();
    renderForm({ initialData });
    await user.click(screen.getByRole('button', { name: '撤销牌阵切换' }));
    const draft = readLocalDraft<any>('tarot_reading_draft_guest_switch-protection');
    expect(draft.cardSlots.map((card: any) => card.name)).toEqual(['愚者', '魔术师', '女祭司']);
    expect(draft.cardSlots[1].isReversed).toBe(true);
    expect(draft.cardInterpretations).toEqual(initialData.cardInterpretations);
    expect(draft.cardQuestions).toEqual(initialData.cardQuestions);
    expect(screen.getByRole('combobox')).toHaveValue('无牌阵三张');
  });

  it('protects edits made after a switch before restoring the previous snapshot', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByRole('combobox'), '无牌阵三张');
    expect(screen.queryByRole('dialog', { name: '切换牌阵' })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '切换后新增的问题');
    await user.click(screen.getByRole('button', { name: '撤销牌阵切换' }));
    expect(screen.getByRole('dialog', { name: '撤销牌阵切换' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保留当前内容' }));
    expect(screen.getByPlaceholderText('占卜的问题是什么？')).toHaveValue('切换后新增的问题');
  });

  it('does not mark an existing reading as changed merely by opening it', () => {
    renderForm({ initialData: makeReading('unchanged', [], '2026-10-21') });
    expect(readLocalDraft<any>('tarot_reading_draft_guest_unchanged').hasUnsavedChanges).toBe(false);
  });

  it('keeps an older edited draft resumable after opening it without further changes', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('legacy-edit', [], '2026-10-21');
    const first = renderForm({ initialData });
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), ' 之前未保存的修改');
    first.unmount();
    const key = 'tarot_reading_draft_guest_legacy-edit';
    const legacy = readLocalDraft<any>(key);
    delete legacy.hasUnsavedChanges;
    sessionStorage.clear();
    resetDraftMemory();
    localStorage.setItem(key, JSON.stringify(legacy));
    expect(findResumableReading('guest', [initialData])?.id).toBe(initialData.id);
    const second = renderForm({ initialData });
    expect(screen.getByPlaceholderText('占卜的问题是什么？')).toHaveValue(legacy.formData.question);
    second.unmount();
    expect(findResumableReading('guest', [initialData])?.id).toBe(initialData.id);
    expect(readLocalDraft<any>(key).hasUnsavedChanges).toBe(true);
  });

  it('does not submit an untouched old review when resuming an edit after a newer review was saved', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('review-rebase', [], '2026-11-02', { userFeedback: '原复盘' });
    const first = renderForm({ initialData });
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), ' 未完成的问题修改');
    first.unmount();
    const second = renderForm({ initialData: { ...initialData, userFeedback: '后来补写的复盘' } });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    expect(screen.getByRole('textbox', { name: '手记复盘' })).toHaveValue('后来补写的复盘');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(second.onSubmit).toHaveBeenCalledOnce();
    expect(second.onSubmit.mock.calls[0][0]).not.toHaveProperty('userFeedback');
  });

  it('still submits a deliberate review deletion from a resumed edit', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('review-erasure', [], '2026-11-02', { userFeedback: '原复盘' });
    const first = renderForm({ initialData });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.clear(screen.getByRole('textbox', { name: '手记复盘' }));
    first.unmount();
    const second = renderForm({ initialData });
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(second.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ userFeedback: '' }));
  });

  it('restores exact custom coordinates, rotation and scale when undoing a spread switch', async () => {
    const user = userEvent.setup();
    const cards = [
      { name: '愚者', isReversed: false, x: -110, y: 50, rotation: 17, scale: 0.8 },
      { name: '隐士', isReversed: true, x: 300, y: 220, rotation: -12, scale: 1.2 },
    ];
    const custom: SpreadDefinition = { name: '自由坐标回归', layout: 'free', slots: ['左', '右'], freePositions: cards };
    renderForm({ spreads: [...OFFICIAL_SPREADS, custom], initialData: makeReading('custom-undo', [], '2026-10-21', { spread: custom.name, layoutType: 'free', cards }) });
    await user.selectOptions(screen.getByRole('combobox'), '单牌阵');
    await user.click(screen.getByRole('button', { name: '切换牌阵' }));
    await user.click(screen.getByRole('button', { name: '撤销牌阵切换' }));
    const restored = readLocalDraft<any>('tarot_reading_draft_guest_custom-undo');
    expect(restored.formData.layoutType).toBe('free');
    cards.forEach((card, index) => expect(restored.cardSlots[index]).toMatchObject(card));
  });

  it('reveals the complete cloth after selecting a spread but not while writing', async () => {
    const reveal = vi.spyOn(spreadReveal, 'revealReadingSpread').mockImplementation(() => {});
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '接下来需要关注什么');
    expect(reveal).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByRole('combobox'), '选择牌阵');
    await waitFor(() => expect(reveal).toHaveBeenCalledOnce());
    expect(reveal.mock.calls[0][0]).toHaveAttribute('data-required-field', 'cards');
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '？');
    expect(reveal).toHaveBeenCalledOnce();
  });

  it('switches quick themes without submitting an otherwise valid reading', async () => {
    const reveal = vi.spyOn(spreadReveal, 'revealReadingSpread').mockImplementation(() => {});
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '接下来需要关注什么');
    await user.click(screen.getByRole('button', { name: '1 主牌' }));
    await user.click(screen.getByRole('button', { name: '愚者 愚者' }));
    await user.click(screen.getByRole('button', { name: '年运' }));
    expect(screen.getByRole('combobox')).toHaveValue('年运十二宫牌阵');
    await waitFor(() => expect(reveal).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: '四季' }));
    expect(screen.getByRole('combobox')).toHaveValue('四季牌阵');
    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(2));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('discards the edit draft when cancelling without changing the saved reading', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('cancelled-edit', [], '2026-09-16');
    const view = renderForm({ initialData });
    await user.clear(screen.getByPlaceholderText('占卜的问题是什么？'));
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '不要保存这次修改');
    await user.click(screen.getByRole('button', { name: '取消修改' }));
    expect(view.onCancel).toHaveBeenCalledOnce();
    expect(view.onSubmit).not.toHaveBeenCalled();
    view.unmount();
    resetDraftMemory();
    expect(readLocalDraft('tarot_reading_draft_guest_cancelled-edit')).toBeNull();
    renderForm({ initialData });
    expect(screen.getByPlaceholderText('占卜的问题是什么？')).toHaveValue(initialData.question);
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

  it('recovers an unfinished question without requiring a selected card', async () => {
    const user = userEvent.setup();
    const first = renderForm();
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '切换页面也要保留的问题');
    first.unmount();
    resetDraftMemory();
    renderForm();
    expect(screen.getByPlaceholderText('占卜的问题是什么？')).toHaveValue('切换页面也要保留的问题');
    expect(screen.getByText(/已恢复上次未完成的手记/)).toBeInTheDocument();
  });

  it('retains a tags-only draft and does not resurrect text the user erased', async () => {
    const user = userEvent.setup();
    const first = renderForm();
    await user.type(screen.getByPlaceholderText('添加标签...'), '旅行');
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '随后清除');
    await user.clear(screen.getByPlaceholderText('占卜的问题是什么？'));
    first.unmount();
    resetDraftMemory();
    renderForm();
    expect(screen.getByPlaceholderText('占卜的问题是什么？')).toHaveValue('');
    expect(screen.getByPlaceholderText('添加标签...')).toHaveValue('旅行');
  });

  it('preserves a resumed free layout and reversal when editing an existing reading', async () => {
    const user = userEvent.setup();
    const initialData: Partial<TarotReading> = {
      id: 'saved-edit', question: '原问题', spread: '单牌阵', layoutType: 'free',
      cards: [{ name: '愚者', isReversed: true, x: 120, y: 200, rotation: 15, scale: 1 }],
      cardInterpretations: ['原解读'], readingDate: '2026-09-16T01:30:00+08:00',
    };
    const first = renderForm({ initialData });
    await user.clear(screen.getByPlaceholderText('占卜的问题是什么？'));
    await user.type(screen.getByPlaceholderText('占卜的问题是什么？'), '新问题');
    first.unmount();
    resetDraftMemory();
    const resumed = renderForm({ initialData });
    expect(screen.getByPlaceholderText('占卜的问题是什么？')).toHaveValue('新问题');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(resumed.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      question: '新问题', readingDate: initialData.readingDate,
      cards: expect.arrayContaining([expect.objectContaining({ name: '愚者', isReversed: true, x: 120, y: 200, rotation: 15, scale: 1 })]),
    }));
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

    expect(screen.getByRole('textbox', { name: '我的想法' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('记录关于“第一张”的直觉与洞察...')).not.toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '逐牌研习（可选）' }));
    expect(screen.getByPlaceholderText('记录关于“第一张”的直觉与洞察...')).toBeInTheDocument();
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('已填 1/3');
    expect(screen.getByTestId('spread-overview-status')).toHaveTextContent('可继续补齐牌面，也可下滑给已选牌写解读。');
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
    expect(screen.getByRole('textbox', { name: '我的想法' })).toBeInTheDocument();
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

  it('keeps the daily question editable and saves the quick theme with a default title', async () => {
    const user = userEvent.setup();
    const props = renderForm();
    await user.click(screen.getByRole('button', { name: '日运' }));
    expect(screen.getByRole('textbox', { name: '占卜问题' })).toHaveValue('今日抽牌记录');
    await user.click(screen.getByRole('button', { name: /1 主牌/ }));
    await user.click(screen.getByRole('button', { name: '隐士 隐士' }));
    await user.click(screen.getByRole('button', { name: '保存手记' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      question: '今日抽牌记录', category: '日运',
      cards: expect.arrayContaining([expect.objectContaining({ name: '隐士' })]),
    }));
  });

  it('never clears cards, spread, question or notes when adding and removing the daily tag', async () => {
    const user = userEvent.setup();
    const props = renderForm();
    await user.type(screen.getByRole('textbox', { name: '占卜问题' }), '保留我的记录');
    await user.selectOptions(screen.getByRole('combobox'), '无牌阵三张');
    await user.click(screen.getByRole('button', { name: '1 第一张' }));
    await user.click(screen.getByRole('button', { name: '隐士 隐士' }));
    await user.click(screen.getByRole('button', { name: '逐牌研习（可选）' }));
    await user.type(screen.getByRole('textbox', { name: /灵见注疏/ }), '已经写好的解读');
    const tag = screen.getByPlaceholderText('添加标签...');
    await user.type(tag, '日运');
    expect(screen.getByRole('combobox')).toHaveValue('无牌阵三张');
    expect(screen.getByRole('textbox', { name: '占卜问题' })).toHaveValue('保留我的记录');
    await user.clear(tag);
    await user.type(tag, '学习');
    await user.click(screen.getByRole('button', { name: '保存手记' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      question: '保留我的记录', spread: '无牌阵三张',
      cards: expect.arrayContaining([expect.objectContaining({ name: '隐士' })]),
      cardInterpretations: ['已经写好的解读', '', ''],
    }));
  });

  it('saves an overall thought as complete without opening optional card study', async () => {
    const user = userEvent.setup();
    const cards = [{ name: '隐士', isReversed: false }, { name: '太阳', isReversed: true }, { name: '魔术师', isReversed: false }];
    const props = renderForm({ initialData: makeReading('overall-only', ['日运'], '2026-11-02', { spread: '无牌阵三张', layoutType: 'horizontal', cards, cardInterpretations: ['', '', ''] }) });
    expect(screen.queryByRole('textbox', { name: /灵见注疏/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /牌面疑问/ })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: '我的想法' }), '只记这一段，不逐张分析。');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 'complete', cardInterpretations: ['', '', ''], interpretation: expect.objectContaining({ combination: '只记这一段，不逐张分析。' }), cards: expect.arrayContaining(cards.map(card => expect.objectContaining(card))) }));
  });

  it('keeps single-card thoughts in sync with optional study and does not restore erased legacy text', async () => {
    const user = userEvent.setup();
    const props = renderForm({ initialData: makeReading('single-thought', [], '2026-11-02', { interpretation: { singleCard: '旧文字', combination: '', summary: '' } }) });
    const thought = screen.getByRole('textbox', { name: '我的想法' });
    expect(thought).toHaveValue('旧文字');
    await user.clear(thought); await user.type(thought, '我的新想法');
    await user.click(screen.getByRole('button', { name: '逐牌研习（可选）' }));
    const cardThought = screen.getByRole('textbox', { name: /灵见注疏/ });
    expect(cardThought).toHaveValue('我的新想法');
    await user.clear(cardThought);
    expect(thought).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 'complete', interpretation: expect.objectContaining({ singleCard: '' }) }));
  });

  it('keeps official spreads visible even if legacy data marked one as hidden', () => {
    const hiddenSpreads = OFFICIAL_SPREADS.map((spread, index) => (
      index === 1 ? { ...spread, isHidden: true } : spread
    ));
    renderForm({ spreads: hiddenSpreads });

    const spreadSelect = screen.getByRole('combobox') as HTMLSelectElement;
    const optionValues = Array.from(spreadSelect.options).map(option => option.value);

    expect(optionValues).toContain(OFFICIAL_SPREADS[1].name);
    expect(screen.queryByRole('button', { name: /隐藏官方牌阵/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /恢复隐藏的官方牌阵/ })).not.toBeInTheDocument();
  });

  it('restores only the current official spread through a top-level confirmation dialog', async () => {
    const user = userEvent.setup();
    const changedOfficial = { ...OFFICIAL_SPREADS[0], slots: ['被改过的主牌'] };
    const props = renderForm({ spreads: [changedOfficial, ...OFFICIAL_SPREADS.slice(1)] });

    await user.click(screen.getByRole('button', { name: '编辑当前牌阵 单牌阵' }));
    await user.click(screen.getByRole('button', { name: '恢复当前' }));

    const dialog = screen.getByRole('dialog', { name: '恢复官方默认' });
    expect(dialog.parentElement).toHaveClass('fixed');
    expect(dialog.parentElement?.parentElement).toBe(document.body);

    await user.click(within(dialog).getByRole('button', { name: '恢复' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        name: OFFICIAL_SPREADS[0].name,
        slots: OFFICIAL_SPREADS[0].slots,
      }),
    ]));
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
    expect(prompt.value).toContain('检查我的解读');
    expect(prompt.value).toContain('问题：这次工作选择该怎么看？');
    expect(prompt.value).toContain('1. 主牌：愚者（正位）');
    expect(prompt.value).toContain('我的理解：新的开始，也有不确定。');
    expect(prompt.value).toContain('疑问：这张牌是在鼓励我开始，还是提醒我太冲动？');
    expect(prompt).not.toHaveAttribute('readonly');
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
    expect(prompt.value).toContain('先回应核心问题');
    expect(prompt.value).toContain('1. 主牌：愚者（正位）');
    expect(prompt.value).not.toContain('这是我自己的思路');
    expect(prompt.value).not.toContain('这里也不应该给到咨询版');
    expect(prompt.value).not.toContain('我的理解');
  });

  it('keeps AI context optional, shares it between modes, and updates only unedited prompts', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderForm({ initialData: makeReading('context-modes', [], '2026-11-04', { cardInterpretations: ['我想先观察'] }) });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    const toggle = screen.getByRole('button', { name: '补充背景与关注点（选填）' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: '补充背景与关注点' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '咨询解牌直接看牌阵' }));
    await user.click(screen.getByRole('button', { name: '生成咨询提示词' }));
    const consultant = screen.getByLabelText('生成的 AI 解牌提示词：咨询解牌');
    expect((consultant as HTMLTextAreaElement).value).not.toContain('背景与关注点');
    await user.click(toggle);
    const context = screen.getByRole('textbox', { name: '补充背景与关注点' });
    const firstContext = '目前准备转行。\n这次希望了解可迁移的能力。';
    fireEvent.change(context, { target: { value: firstContext } });
    expect((consultant as HTMLTextAreaElement).value).toContain(firstContext);
    expect((consultant as HTMLTextAreaElement).value).not.toContain('我想先观察');
    await user.click(screen.getByRole('button', { name: '复制提示词' }));
    expect(writeText).toHaveBeenLastCalledWith((consultant as HTMLTextAreaElement).value);
    await user.click(screen.getByRole('button', { name: '导师复盘看我的解读' }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));
    const mentor = screen.getByLabelText('生成的 AI 解牌提示词：导师复盘');
    expect((mentor as HTMLTextAreaElement).value).toContain(firstContext);
    expect((mentor as HTMLTextAreaElement).value).toContain('我想先观察');
    fireEvent.change(mentor, { target: { value: '保留我手动写下的解读要求。' } });
    fireEvent.change(context, { target: { value: '背景已改变，这次更关心合作。' } });
    expect(mentor).toHaveValue('保留我手动写下的解读要求。');
    expect(screen.getByText('手记内容已变化，当前保留你修改的提示词。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新生成提示词' }));
    await user.click(screen.getByRole('button', { name: '保留修改' }));
    expect(mentor).toHaveValue('保留我手动写下的解读要求。');
    await user.click(screen.getByRole('button', { name: '重新生成提示词' }));
    await user.click(screen.getByRole('button', { name: '重新生成' }));
    expect((mentor as HTMLTextAreaElement).value).toContain('背景已改变，这次更关心合作。');
    expect((mentor as HTMLTextAreaElement).value).not.toContain(firstContext);
    fireEvent.change(context, { target: { value: '' } });
    expect((mentor as HTMLTextAreaElement).value).not.toContain('背景与关注点');
  });

  it('restores context drafts only for their current account and reading, and saves explicit clearing', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('context-scope', [], '2026-11-04', { aiContext: '已保存的背景' });
    const first = renderForm({ initialData, userId: 'owner-a' });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    const context = screen.getByRole('textbox', { name: '补充背景与关注点' });
    expect(context).toHaveValue('已保存的背景');
    fireEvent.change(context, { target: { value: '未保存的新背景\n还有一个关注点' } });
    expect(readLocalDraft<any>('tarot_reading_draft_owner-a_context-scope').formData.aiContext).toBe('未保存的新背景\n还有一个关注点');
    first.unmount();
    resetDraftMemory();
    const otherReading = renderForm({ initialData: makeReading('context-other', [], '2026-11-04'), userId: 'owner-a' });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    expect(screen.getByRole('button', { name: '补充背景与关注点（选填）' })).toHaveAttribute('aria-expanded', 'false');
    otherReading.unmount();
    const otherAccount = renderForm({ initialData: { ...initialData, aiContext: undefined }, userId: 'owner-b' });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '补充背景与关注点（选填）' }));
    expect(screen.getByRole('textbox', { name: '补充背景与关注点' })).toHaveValue('');
    otherAccount.unmount();
    const restored = renderForm({ initialData, userId: 'owner-a' });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    const restoredContext = screen.getByRole('textbox', { name: '补充背景与关注点' });
    expect(restoredContext).toHaveValue('未保存的新背景\n还有一个关注点');
    fireEvent.change(restoredContext, { target: { value: '' } });
    fireEvent.submit(restored.container.querySelector('form')!);
    await waitFor(() => expect(restored.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ aiContext: '' })));
    expect(initialData.aiContext).toBe('已保存的背景');
  });

  it('keeps saved context when restoring a legacy draft without that field', async () => {
    const user = userEvent.setup();
    const initialData = makeReading('legacy-context', [], '2026-11-04', { aiContext: '后来保存的背景' });
    const first = renderForm({ initialData });
    first.unmount();
    const key = 'tarot_reading_draft_guest_legacy-context';
    const legacy = JSON.parse(localStorage.getItem(key)!);
    delete legacy.formData.aiContext;
    localStorage.setItem(key, JSON.stringify(legacy));
    sessionStorage.clear();
    resetDraftMemory();
    renderForm({ initialData });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    expect(screen.getByRole('textbox', { name: '补充背景与关注点' })).toHaveValue('后来保存的背景');
  });

  it('copies edited prompt text, preserves it across source changes, mode switches and reopening, and never changes the reading', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const initialData = makeReading('prompt-edit', [], '2026-11-02', { cardInterpretations: ['先观察再行动'] });
    const first = renderForm({ initialData });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));
    const prompt = screen.getByLabelText('生成的 AI 解牌提示词：导师复盘');
    await user.clear(prompt);
    expect(screen.getByRole('button', { name: '复制提示词' })).toBeDisabled();
    const edited = '只讨论这张牌为什么可以这样理解。\n保留我的措辞。';
    await user.type(prompt, edited);
    await user.clear(screen.getByRole('textbox', { name: '占卜问题' }));
    await user.type(screen.getByRole('textbox', { name: '占卜问题' }), '更新后的问题');
    expect(prompt).toHaveValue(edited);
    expect(screen.getByText('手记内容已变化，当前保留你修改的提示词。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '复制提示词' }));
    expect(writeText).toHaveBeenLastCalledWith(edited);
    expect(readLocalDraft<any>('tarot_reading_draft_guest_prompt-edit').cardInterpretations).toEqual(initialData.cardInterpretations);
    await user.click(screen.getByRole('button', { name: '咨询解牌直接看牌阵' }));
    await user.click(screen.getByRole('button', { name: '生成咨询提示词' }));
    expect(screen.getByLabelText('生成的 AI 解牌提示词：咨询解牌')).not.toHaveValue(edited);
    await user.click(screen.getByRole('button', { name: '导师复盘看我的解读' }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));
    expect(screen.getByLabelText('生成的 AI 解牌提示词：导师复盘')).toHaveValue(edited);
    first.unmount();
    resetDraftMemory();
    renderForm({ initialData });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));
    expect(screen.getByLabelText('生成的 AI 解牌提示词：导师复盘')).toHaveValue(edited);
    expect(screen.getByRole('textbox', { name: '占卜问题' })).toHaveValue('更新后的问题');
    expect(initialData.question).toBe('测试问题 prompt-edit');
  });

  it('requires confirmation before changing supplementary material on an edited prompt', async () => {
    const user = userEvent.setup();
    renderForm({ initialData: makeReading('prompt-materials', [], '2026-11-02', { cardInterpretations: ['先观察再行动'], userFeedback: '事后才知道的结果', interpretation: { singleCard: '', combination: '我原先的整体判断', summary: '', elementInfluence: '我自己的元素笔记' } }) });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));
    const prompt = screen.getByLabelText('生成的 AI 解牌提示词：导师复盘');
    const materialToggle = screen.getByRole('checkbox', { name: '附带复盘和补充视角' });
    expect(materialToggle).not.toBeChecked();
    expect((prompt as HTMLTextAreaElement).value).toContain('我原先的整体判断');
    expect((prompt as HTMLTextAreaElement).value).not.toContain('事后才知道的结果');
    await user.clear(prompt);
    await user.type(prompt, '我在提示词中单独补写的要求');
    await user.click(materialToggle);
    await user.click(screen.getByRole('button', { name: '保留修改' }));
    expect(prompt).toHaveValue('我在提示词中单独补写的要求');
    expect(materialToggle).not.toBeChecked();
    await user.click(materialToggle);
    await user.click(screen.getByRole('button', { name: '重新生成' }));
    expect(materialToggle).toBeChecked();
    expect((prompt as HTMLTextAreaElement).value).toContain('事后反馈（已发生）');
    expect((prompt as HTMLTextAreaElement).value).toContain('事后才知道的结果');
    expect((prompt as HTMLTextAreaElement).value).toContain('我自己的元素笔记');
    await user.click(materialToggle);
    expect((prompt as HTMLTextAreaElement).value).not.toContain('事后才知道的结果');
    expect((prompt as HTMLTextAreaElement).value).not.toContain('我自己的元素笔记');
  });

  it('refreshes unedited prompts with source changes and confirms explicitly resetting custom text', async () => {
    const user = userEvent.setup();
    renderForm({ initialData: makeReading('prompt-reset', [], '2026-11-02', { cardInterpretations: ['先观察再行动'] }) });
    await user.click(screen.getByRole('button', { name: /添加复盘/ }));
    await user.click(screen.getByRole('button', { name: '生成导师提示词' }));
    const prompt = screen.getByLabelText('生成的 AI 解牌提示词：导师复盘');
    await user.type(screen.getByRole('textbox', { name: '占卜问题' }), ' 新补充');
    expect((prompt as HTMLTextAreaElement).value).toContain('新补充');
    const question = screen.getByRole('textbox', { name: '占卜问题' });
    const updatedQuestion = (question as HTMLInputElement).value;
    await user.clear(question);
    expect(prompt).toHaveValue('');
    expect(screen.getByRole('button', { name: '复制提示词' })).toBeDisabled();
    expect(screen.getByText('还差一点：先补上占卜问题，就能生成提示词。')).toBeInTheDocument();
    await user.type(question, updatedQuestion);
    expect((prompt as HTMLTextAreaElement).value).toContain('新补充');
    await user.clear(prompt);
    await user.type(prompt, '只问这一点');
    await user.click(screen.getByRole('button', { name: '重新生成提示词' }));
    await user.click(screen.getByRole('button', { name: '保留修改' }));
    expect(prompt).toHaveValue('只问这一点');
    await user.click(screen.getByRole('button', { name: '重新生成提示词' }));
    await user.click(screen.getByRole('button', { name: '重新生成' }));
    expect((prompt as HTMLTextAreaElement).value).toContain('新补充');
    expect((prompt as HTMLTextAreaElement).value).toContain('先观察再行动');
  });
});
