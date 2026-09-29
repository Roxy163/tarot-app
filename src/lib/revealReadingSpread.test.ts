import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealReadingSpread } from './revealReadingSpread';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const setup = (top: number, bottom: number) => {
  vi.stubGlobal('scrollY', 100);
  const scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  const navigation = document.createElement('nav');
  navigation.setAttribute('data-app-navigation', '');
  document.body.append(navigation);
  vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue({ top: 508 } as DOMRect);
  const board = document.createElement('div');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ top, bottom } as DOMRect);
  return { board, scrollTo };
};

describe('revealing a selected spread', () => {
  it('scrolls only far enough to clear the fixed navigation and its safe margin', () => {
    const { board, scrollTo } = setup(300, 650);
    revealReadingSpread(board);
    expect(scrollTo).toHaveBeenCalledWith({ top: 254, behavior: 'smooth' });
  });

  it('leaves an already visible spread in place', () => {
    const { board, scrollTo } = setup(20, 490);
    revealReadingSpread(board);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('reveals a spread above the viewport without animation when motion is reduced', () => {
    const { board, scrollTo } = setup(-30, 300);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    revealReadingSpread(board);
    expect(scrollTo).toHaveBeenCalledWith({ top: 58, behavior: 'instant' });
  });
});
