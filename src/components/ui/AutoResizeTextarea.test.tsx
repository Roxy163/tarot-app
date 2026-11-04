import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoResizeTextarea } from './AutoResizeTextarea';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AutoResizeTextarea responsive text', () => {
  it('keeps all text visible when a narrower viewport wraps it into more lines', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    let width = 320;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => width < 240 ? 116 : 76);
    const value = '已知的背景\n这次想了解的重点\n未保存的补充';
    render(<AutoResizeTextarea aria-label="背景" value={value} readOnly minRows={3} maxRows={8} style={{ lineHeight: '20px', padding: '8px' }} />);
    const input = screen.getByRole('textbox', { name: '背景' });
    expect(input).toHaveStyle({ height: '76px' });
    width = 180;
    fireEvent(window, new Event('resize'));
    expect(input).toHaveStyle({ height: '116px', overflowY: 'hidden' });
    expect(input).toHaveValue(value);
    width = 400;
    fireEvent(window, new Event('resize'));
    expect(input).toHaveStyle({ height: '76px' });
  });

  it('responds to container width changes, caps long text with scrolling, and disconnects on exit', () => {
    let callback: ResizeObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(listener: ResizeObserverCallback) { callback = listener; }
      observe = observe;
      disconnect = disconnect;
    });
    let width = 320;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => width < 240 ? 400 : 76);
    const { unmount } = render(<AutoResizeTextarea aria-label="背景" value="保留长内容" readOnly minRows={3} maxRows={5} style={{ lineHeight: '20px', padding: '8px' }} />);
    const input = screen.getByRole('textbox', { name: '背景' });
    expect(observe).toHaveBeenCalledWith(input);
    width = 180;
    act(() => callback([], {} as ResizeObserver));
    expect(input).toHaveStyle({ height: '116px', overflowY: 'auto' });
    expect(input).toHaveValue('保留长内容');
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
