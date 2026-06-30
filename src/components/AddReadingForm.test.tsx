import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_SPREADS } from '../constants';
import { AddReadingForm } from './AddReadingForm';
import { SpreadDefinition } from '../types';

const renderForm = (overrides: { spreads?: SpreadDefinition[] } = {}) => {
  const props = {
    onSubmit: vi.fn(),
    isLoading: false,
    isLoggedIn: false,
    spreads: overrides.spreads || OFFICIAL_SPREADS,
    onUpdateSpreads: vi.fn(),
    cardMetadata: [],
    onUpdateCardMetadata: vi.fn(),
  };

  render(<AddReadingForm {...props} />);
  return props;
};

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
    vi.restoreAllMocks();
  });

  it('closes the spread designer after saving and using a new free layout spread', async () => {
    const user = userEvent.setup();
    const props = renderForm();

    await user.click(screen.getByRole('button', { name: '新建自定义牌阵' }));
    await user.click(screen.getByTestId('free-layout-canvas'));
    await user.click(screen.getByTestId('free-layout-pending-slot'));
    await user.click(screen.getByRole('button', { name: '保存并使用' }));

    expect(props.onUpdateSpreads).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: '个人牌阵',
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

    const spreadSelect = screen.getByText('牌阵：').closest('div')?.parentElement;
    expect(spreadSelect).toBeTruthy();
    expect(within(spreadSelect as HTMLElement).getByRole('button', { name: '编辑当前牌阵 个人牌阵' })).toBeInTheDocument();
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
  });
});
