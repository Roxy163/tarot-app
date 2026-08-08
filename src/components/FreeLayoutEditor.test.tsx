import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FreeLayoutEditor } from './FreeLayoutEditor';

const renderEditor = (overrides = {}) => {
  const props = {
    cardSlots: [
      { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
    ],
    designActiveSlot: 0,
    onSetDesignActiveSlot: vi.fn(),
    onRemoveSlot: vi.fn(),
    onUpdateSlots: vi.fn(),
    ...overrides,
  };

  const renderResult = render(<FreeLayoutEditor {...props} />);
  return { ...props, renderResult };
};

describe('FreeLayoutEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window.navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(() => true),
    });
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
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('previews a slot on blank canvas click without placing it', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });

    fireEvent.click(screen.getByTestId('free-layout-canvas'), {
      clientX: 220,
      clientY: 220,
    });

    expect(onUpdateSlots).not.toHaveBeenCalled();
    expect(screen.getByTestId('free-layout-pending-slot')).toHaveStyle('left: 180px; top: 150px');
  });

  it('does not show a separate add-position button in free canvas mode', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: '添加位置' })).not.toBeInTheDocument();
  });

  it('keeps the canvas action hint outside the scaled infinite canvas', () => {
    renderEditor();

    const canvas = screen.getByTestId('free-layout-canvas');
    const actionHint = screen.getByTestId('free-layout-action-hint');

    expect(actionHint).toHaveTextContent('点击添加，拖动画布；Shift 拖动可框选');
    expect(actionHint.querySelector('span')).toHaveClass('whitespace-nowrap');
    expect(canvas).not.toContainElement(actionHint);
  });

  it('zooms the free canvas directly with the wheel inside the viewport', () => {
    renderEditor();

    fireEvent.wheel(screen.getByTestId('free-layout-viewport'), {
      deltaY: -100,
      clientX: 320,
      clientY: 230,
    });

    expect(screen.getByText('108%')).toBeInTheDocument();
  });

  it('previews a new position by clicking the canvas center', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });

    fireEvent.click(screen.getByTestId('free-layout-canvas'), {
      clientX: 320,
      clientY: 230,
    });

    expect(onUpdateSlots).not.toHaveBeenCalled();
    expect(screen.getByTestId('free-layout-pending-slot')).toHaveStyle('left: 280px; top: 160px');
  });

  it('places previews using the current viewport offset after panning', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });
    const viewport = screen.getByTestId('free-layout-viewport');

    fireEvent.pointerDown(viewport, {
      pointerId: 8,
      clientX: 320,
      clientY: 230,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 8,
      clientX: 380,
      clientY: 250,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 8,
      clientX: 380,
      clientY: 250,
    });

    act(() => {
      vi.advanceTimersByTime(181);
    });

    fireEvent.click(viewport, {
      clientX: 220,
      clientY: 220,
    });

    expect(onUpdateSlots).not.toHaveBeenCalled();
    expect(screen.getByTestId('free-layout-pending-slot')).toHaveStyle('left: 120px; top: 130px');
  });

  it('shows an empty guide and disables clear before any slot is added', () => {
    renderEditor({
      cardSlots: [],
      designActiveSlot: -1,
    });

    expect(screen.getByTestId('free-layout-empty-guide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /清空/ })).toBeDisabled();
  });

  it('shows center axes and active-slot symmetry axes on the canvas', () => {
    renderEditor();

    expect(screen.getByTestId('free-layout-center-axis-vertical')).toBeInTheDocument();
    expect(screen.getByTestId('free-layout-center-axis-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('free-layout-active-axis-vertical')).toBeInTheDocument();
    expect(screen.getByTestId('free-layout-active-axis-horizontal')).toBeInTheDocument();
  });

  it('places a preview slot only after clicking the preview', () => {
    const onUpdateSlots = vi.fn();
    const onSetDesignActiveSlot = vi.fn();
    renderEditor({ onUpdateSlots, onSetDesignActiveSlot });

    fireEvent.click(screen.getByTestId('free-layout-canvas'), {
      clientX: 220,
      clientY: 220,
    });
    fireEvent.click(screen.getByTestId('free-layout-pending-slot'));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
      expect.objectContaining({ label: '位置2', x: 180, y: 150 }),
    ]);
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(1);
  });

  it('syncs a single selected badge to the active slot after the active slot changes', () => {
    const props = renderEditor({
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 0,
    });

    expect(screen.getByTestId('free-layout-slot-0')).toHaveTextContent('已选');

    const { renderResult, ...componentProps } = props;
    renderResult.rerender(
      <FreeLayoutEditor
        {...componentProps}
        designActiveSlot={1}
      />
    );

    expect(screen.getByTestId('free-layout-slot-0')).not.toHaveTextContent('同组');
    expect(screen.getByTestId('free-layout-slot-1')).toHaveTextContent('已选');
  });

  it('lets users change a free layout position order number', () => {
    const onSwapSlotIndex = vi.fn();
    renderEditor({
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 1,
      onSwapSlotIndex,
    });

    const orderInput = screen.getByLabelText('修改第 2 个位置序号');
    fireEvent.change(orderInput, { target: { value: '1' } });
    fireEvent.blur(orderInput);

    expect(onSwapSlotIndex).toHaveBeenCalledWith(1, 0);
  });

  it('removes an unconfirmed preview slot after two seconds', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });

    fireEvent.click(screen.getByTestId('free-layout-canvas'), {
      clientX: 220,
      clientY: 220,
    });

    expect(screen.getByTestId('free-layout-pending-slot')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByTestId('free-layout-pending-slot')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('free-layout-pending-slot')).not.toBeVisible();
    expect(onUpdateSlots).not.toHaveBeenCalled();
  });

  it('keeps a dragged preview pending until the next deliberate click', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });

    fireEvent.click(screen.getByTestId('free-layout-canvas'), {
      clientX: 220,
      clientY: 220,
    });
    const pendingSlot = screen.getByTestId('free-layout-pending-slot');

    fireEvent.pointerDown(pendingSlot, {
      pointerId: 2,
      clientX: 220,
      clientY: 220,
    });
    fireEvent.pointerMove(pendingSlot, {
      pointerId: 2,
      clientX: 285,
      clientY: 257,
    });
    fireEvent.pointerUp(pendingSlot, {
      pointerId: 2,
      clientX: 285,
      clientY: 257,
    });

    expect(onUpdateSlots).not.toHaveBeenCalled();
    expect(pendingSlot).toHaveStyle('left: 250px; top: 190px');

    act(() => {
      vi.advanceTimersByTime(181);
    });
    fireEvent.click(pendingSlot);

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
      expect.objectContaining({ label: '位置2', x: 250, y: 190 }),
    ]);
  });

  it('moves an existing slot from its actual pointer delta without forcing a long press wait', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });
    const slot = screen.getByTestId('free-layout-slot-0');

    fireEvent.pointerDown(slot, {
      pointerId: 3,
      clientX: 120,
      clientY: 120,
    });
    fireEvent.pointerMove(slot, {
      pointerId: 3,
      clientX: 181,
      clientY: 154,
    });
    fireEvent.pointerUp(slot, {
      pointerId: 3,
      clientX: 181,
      clientY: 154,
    });

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 180, y: 150, rotation: 0, scale: 1 },
    ]);
  });

  it('moves an existing slot when dragging from the label input area', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });
    const labelInput = screen.getByPlaceholderText('位置标签');

    fireEvent.pointerDown(labelInput, {
      pointerId: 31,
      clientX: 120,
      clientY: 150,
    });
    fireEvent.pointerMove(labelInput, {
      pointerId: 31,
      clientX: 170,
      clientY: 170,
    });
    fireEvent.pointerUp(labelInput, {
      pointerId: 31,
      clientX: 170,
      clientY: 170,
    });

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 170, y: 140, rotation: 0, scale: 1 },
    ]);
  });

  it('moves an existing slot with mouse drag events as a desktop fallback', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });
    const slot = screen.getByTestId('free-layout-slot-0');

    fireEvent.mouseDown(slot, {
      button: 0,
      clientX: 120,
      clientY: 120,
    });
    fireEvent.mouseMove(document, {
      clientX: 171,
      clientY: 154,
    });
    fireEvent.mouseUp(document, {
      clientX: 171,
      clientY: 154,
    });

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 170, y: 150, rotation: 0, scale: 1 },
    ]);
  });

  it('box-selects multiple slots without creating a preview slot', () => {
    const onUpdateSlots = vi.fn();
    const onSetDesignActiveSlot = vi.fn();
    renderEditor({
      onUpdateSlots,
      onSetDesignActiveSlot,
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '三', x: 500, y: 320, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 0,
    });
    const viewport = screen.getByTestId('free-layout-viewport');

    fireEvent.pointerDown(viewport, {
      pointerId: 12,
      clientX: 100,
      clientY: 100,
      shiftKey: true,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 12,
      clientX: 340,
      clientY: 240,
    });

    expect(screen.getByTestId('free-layout-selection-box')).toBeInTheDocument();

    fireEvent.pointerUp(viewport, {
      pointerId: 12,
      clientX: 340,
      clientY: 240,
    });

    expect(screen.queryByTestId('free-layout-pending-slot')).not.toBeInTheDocument();
    expect(screen.getByText('已选中 2 个位置')).toBeInTheDocument();
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(0);
    expect(onUpdateSlots).not.toHaveBeenCalled();
  });

  it('keeps pinch zoom separate from box selection', () => {
    const onSetDesignActiveSlot = vi.fn();
    renderEditor({
      onSetDesignActiveSlot,
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '三', x: 500, y: 320, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 0,
    });
    const viewport = screen.getByTestId('free-layout-viewport');

    fireEvent.pointerDown(viewport, { pointerId: 21, clientX: 120, clientY: 120 });
    fireEvent.pointerDown(viewport, { pointerId: 22, clientX: 240, clientY: 120 });
    fireEvent.pointerMove(viewport, { pointerId: 21, clientX: 90, clientY: 120 });
    fireEvent.pointerMove(viewport, { pointerId: 22, clientX: 270, clientY: 120 });

    expect(screen.queryByTestId('free-layout-selection-box')).not.toBeInTheDocument();

    fireEvent.pointerUp(viewport, { pointerId: 22, clientX: 270, clientY: 120 });
    fireEvent.pointerMove(viewport, { pointerId: 21, clientX: 340, clientY: 240 });
    fireEvent.pointerUp(viewport, { pointerId: 21, clientX: 340, clientY: 240 });

    expect(screen.queryByTestId('free-layout-selection-box')).not.toBeInTheDocument();
    expect(onSetDesignActiveSlot).not.toHaveBeenCalled();
  });

  it('moves selected slots together by dragging any selected slot', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({
      onUpdateSlots,
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '三', x: 500, y: 320, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 0,
    });
    const viewport = screen.getByTestId('free-layout-viewport');

    fireEvent.pointerDown(viewport, { pointerId: 13, clientX: 100, clientY: 100, shiftKey: true });
    fireEvent.pointerMove(viewport, { pointerId: 13, clientX: 340, clientY: 240 });
    fireEvent.pointerUp(viewport, { pointerId: 13, clientX: 340, clientY: 240 });

    const firstSlot = screen.getByTestId('free-layout-slot-0');
    fireEvent.pointerDown(firstSlot, {
      pointerId: 14,
      clientX: 120,
      clientY: 120,
    });
    fireEvent.pointerMove(firstSlot, {
      pointerId: 14,
      clientX: 160,
      clientY: 140,
    });
    fireEvent.pointerUp(firstSlot, {
      pointerId: 14,
      clientX: 160,
      clientY: 140,
    });

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '一', x: 160, y: 140, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '二', x: 280, y: 150, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '三', x: 500, y: 320, rotation: 0, scale: 1 },
    ]);
  });

  it('centers selected slots as a group without changing their spacing', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({
      onUpdateSlots,
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '三', x: 500, y: 320, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 0,
    });
    const viewport = screen.getByTestId('free-layout-viewport');

    fireEvent.pointerDown(viewport, { pointerId: 16, clientX: 100, clientY: 100, shiftKey: true });
    fireEvent.pointerMove(viewport, { pointerId: 16, clientX: 340, clientY: 300 });
    fireEvent.pointerUp(viewport, { pointerId: 16, clientX: 340, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: '所选水平' }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '一', x: 220, y: 120, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '二', x: 340, y: 130, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '三', x: 500, y: 320, rotation: 0, scale: 1 },
    ]);
  });

  it('keeps the free canvas quick toolbar focused while offering direct delete', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: '复制' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '左右镜像' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '上下镜像' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '左旋' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '右旋' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '缩小' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '放大' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '水平居中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '垂直居中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '居中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除位置' })).toBeInTheDocument();
  });

  it('deletes the active free layout slot from the quick toolbar', () => {
    const onUpdateSlots = vi.fn();
    const onSetDesignActiveSlot = vi.fn();
    renderEditor({
      onUpdateSlots,
      onSetDesignActiveSlot,
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 0,
    });

    fireEvent.click(screen.getByRole('button', { name: '删除位置' }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
    ]);
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(0);
  });

  it('deletes a specific free layout slot from the slot corner button', () => {
    const onUpdateSlots = vi.fn();
    const onSetDesignActiveSlot = vi.fn();
    renderEditor({
      onUpdateSlots,
      onSetDesignActiveSlot,
      cardSlots: [
        { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '二', x: 240, y: 130, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: '删除位置：二' }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '一', x: 120, y: 120, rotation: 0, scale: 1 },
    ]);
    expect(onSetDesignActiveSlot).toHaveBeenCalledWith(0);
  });

  it('shows alignment guides and snaps while dragging near another slot', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({
      onUpdateSlots,
      cardSlots: [
        { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '辅助', x: 260, y: 120, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 1,
    });
    const slot = screen.getByTestId('free-layout-slot-1');

    fireEvent.pointerDown(slot, {
      pointerId: 9,
      clientX: 260,
      clientY: 120,
    });
    fireEvent.pointerMove(slot, {
      pointerId: 9,
      clientX: 123,
      clientY: 120,
    });

    expect(screen.getByTestId('free-layout-guide-vertical')).toBeInTheDocument();

    fireEvent.pointerUp(slot, {
      pointerId: 9,
      clientX: 123,
      clientY: 120,
    });

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '辅助', x: 120, y: 120, rotation: 0, scale: 1 },
    ]);
  });

  it('shows horizontal alignment guides and snaps rows while dragging near another slot', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({
      onUpdateSlots,
      cardSlots: [
        { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
        { name: '', isReversed: false, label: '辅助', x: 260, y: 260, rotation: 0, scale: 1 },
      ],
      designActiveSlot: 1,
    });
    const slot = screen.getByTestId('free-layout-slot-1');

    fireEvent.pointerDown(slot, {
      pointerId: 19,
      clientX: 260,
      clientY: 260,
    });
    fireEvent.pointerMove(slot, {
      pointerId: 19,
      clientX: 260,
      clientY: 123,
    });

    expect(screen.getByTestId('free-layout-guide-horizontal')).toBeInTheDocument();

    fireEvent.pointerUp(slot, {
      pointerId: 19,
      clientX: 260,
      clientY: 123,
    });

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 120, y: 120, rotation: 0, scale: 1 },
      { name: '', isReversed: false, label: '辅助', x: 260, y: 120, rotation: 0, scale: 1 },
    ]);
  });

  it('centers the active slot horizontally from the quick positioning toolbar', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });

    fireEvent.click(screen.getByRole('button', { name: '水平居中' }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 280, y: 120, rotation: 0, scale: 1 },
    ]);
  });

  it('centers the active slot on both axes from the quick positioning toolbar', () => {
    const onUpdateSlots = vi.fn();
    renderEditor({ onUpdateSlots });

    fireEvent.click(screen.getByRole('button', { name: '居中' }));

    expect(onUpdateSlots).toHaveBeenCalledWith([
      { name: '', isReversed: false, label: '核心', x: 280, y: 160, rotation: 0, scale: 1 },
    ]);
  });
});
