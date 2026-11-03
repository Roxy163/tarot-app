import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTarotImageWarmupNetworkProfile } from './tarotImagePreload';

const setConnection = (connection: { saveData?: boolean; effectiveType?: string } | undefined) => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: connection,
  });
};

describe('tarot image preload network profile', () => {
  afterEach(() => {
    setConnection(undefined);
  });

  it('limits warmup when data saver is enabled', () => {
    setConnection({ saveData: true, effectiveType: '4g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('constrained');
  });

  it('limits warmup on very slow connections', () => {
    setConnection({ effectiveType: '2g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('constrained');
  });

  it('uses a moderate warmup on 3g connections', () => {
    setConnection({ effectiveType: '3g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('moderate');
  });

  it('keeps full warmup for normal connections', () => {
    setConnection({ effectiveType: '4g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('standard');
  });
});

describe('tarot image preload completion and reconnects', () => {
  let images: HTMLImageElement[];
  let decodeResult: (() => Promise<void>) | undefined;
  let onlineListeners: EventListener[];
  let nextImageToSettle: number;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    images = [];
    onlineListeners = [];
    nextImageToSettle = 0;
    decodeResult = undefined;
    setConnection({ effectiveType: '4g' });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('image-preload-browser-test');
    document.getElementById('tarot-picture-preload-root')?.remove();

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      const element = createElement(tag, options);
      if (tag === 'img') {
        const image = element as HTMLImageElement;
        Object.defineProperty(image, 'decode', { configurable: true, value: decodeResult });
        images.push(image);
      }
      return element;
    });
    const addEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'online') onlineListeners.push(listener as EventListener);
      addEventListener(type, listener, options);
    });
  });

  afterEach(() => {
    onlineListeners.forEach(listener => window.removeEventListener('online', listener));
    document.getElementById('tarot-picture-preload-root')?.remove();
    setConnection(undefined);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Use actual DOM image events; requests are deliberately never sent by jsdom.
  const settleImages = async (event: 'load' | 'error') => {
    for (let pass = 0; pass < 100; pass += 1) {
      while (nextImageToSettle < images.length) {
        images[nextImageToSettle].dispatchEvent(new Event(event));
        nextImageToSettle += 1;
      }
      await Promise.resolve();
      await Promise.resolve();
      if (nextImageToSettle === images.length) {
        await Promise.resolve();
        if (nextImageToSettle === images.length) return;
      }
    }
    throw new Error('Image preload workers did not settle.');
  };

  it('deduplicates concurrent requests and only skips a URL after an actual successful load', async () => {
    const { preloadTarotImageUrl } = await import('./tarotImagePreload');
    const first = preloadTarotImageUrl('/tarot-cards/ar00.jpg');
    expect(preloadTarotImageUrl('/tarot-cards/ar00.jpg')).toBe(first);
    expect(images).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
    images[0].dispatchEvent(new Event('load'));
    await first;
    expect(vi.getTimerCount()).toBe(0);
    expect(document.getElementById('tarot-picture-preload-root')?.childElementCount).toBe(0);
    await preloadTarotImageUrl('/tarot-cards/ar00.jpg');
    expect(images).toHaveLength(1);
  });

  it.each(['error', 'decode rejection', 'decode throw', 'timeout'] as const)('clears pending state and the timer after %s so the same URL can retry', async outcome => {
    if (outcome === 'decode rejection') decodeResult = () => Promise.reject(new Error('decode failed'));
    if (outcome === 'decode throw') decodeResult = () => { throw new Error('decode failed'); };
    const { preloadTarotImageUrl } = await import('./tarotImagePreload');
    const first = preloadTarotImageUrl('/tarot-cards/ar01.jpg');
    if (outcome === 'error') images[0].dispatchEvent(new Event('error'));
    if (outcome === 'timeout') await vi.advanceTimersByTimeAsync(15000);
    await first;
    expect(vi.getTimerCount()).toBe(0);
    expect(images[0].onload).toBeNull();
    expect(images[0].onerror).toBeNull();
    expect(document.getElementById('tarot-picture-preload-root')?.childElementCount).toBe(0);

    decodeResult = undefined;
    const retry = preloadTarotImageUrl('/tarot-cards/ar01.jpg');
    expect(images).toHaveLength(2);
    expect(retry).not.toBe(first);
    images[1].dispatchEvent(new Event('load'));
    await retry;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans the timeout when decoding succeeds without a later load event', async () => {
    decodeResult = () => Promise.resolve();
    const { preloadTarotImageUrl } = await import('./tarotImagePreload');
    await preloadTarotImageUrl('/tarot-cards/ar02.jpg');
    expect(vi.getTimerCount()).toBe(0);
    await preloadTarotImageUrl('/tarot-cards/ar02.jpg');
    expect(images).toHaveLength(1);
  });

  it('does not record a skipped test-environment request as loaded', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('jsdom');
    const { preloadTarotImageUrl } = await import('./tarotImagePreload');
    await preloadTarotImageUrl('/tarot-cards/ar03.jpg');
    expect(images).toHaveLength(0);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('image-preload-browser-test');
    const retry = preloadTarotImageUrl('/tarot-cards/ar03.jpg');
    expect(images).toHaveLength(1);
    images[0].dispatchEvent(new Event('load'));
    await retry;
  });

  it('keeps the requested concurrency while each completed image starts the next one', async () => {
    const { preloadTarotImageUrls } = await import('./tarotImagePreload');
    const preload = preloadTarotImageUrls(['/tarot-cards/ar00.jpg', '/tarot-cards/ar01.jpg', '/tarot-cards/ar02.jpg'], { concurrency: 2 });
    expect(images).toHaveLength(2);
    images[0].dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(images).toHaveLength(3);
    await settleImages('load');
    await preload;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('registers one reconnect listener and combines repeated online events into one bounded retry', async () => {
    setConnection({ saveData: true, effectiveType: '2g' });
    const { warmTarotDeckImages } = await import('./tarotImagePreload');
    warmTarotDeckImages();
    warmTarotDeckImages();
    expect(onlineListeners).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(900);
    expect(images).toHaveLength(1); // The constrained profile still uses one worker.
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    await settleImages('error');
    expect(images).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(3600); // Finish the first cycle; remaining cards are skipped.
    await vi.advanceTimersByTimeAsync(900);
    await settleImages('load');
    expect(images).toHaveLength(8); // The original four failures are retried once, within the same budget.
    await vi.advanceTimersByTimeAsync(3600);
    expect(vi.getTimerCount()).toBe(0);

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(4500);
    expect(images).toHaveLength(8); // Successful cards are neither reloaded nor replaced by extra targets.
    expect(onlineListeners).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
