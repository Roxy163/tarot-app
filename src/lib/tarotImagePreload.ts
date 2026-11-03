import { TAROT_CARDS, getCardImageFormatUrl, getCardImageUrl } from '../constants';

type ImageFetchPriority = 'high' | 'low' | 'auto';
type TarotWarmupNetworkProfile = 'constrained' | 'moderate' | 'standard';

interface NavigatorConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

interface PreloadOptions {
  concurrency?: number;
  limit?: number;
  priority?: ImageFetchPriority;
}

const preloadedUrls = new Set<string>();
const pendingUrls = new Map<string, Promise<void>>();
let hasScheduledDeckWarmup = false;
let isDeckWarmupRunning = false;
let repeatDeckWarmupAfterOnline = false;

const isTestEnvironment = () => (
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom')
);

const canPreloadImages = () => (
  typeof window !== 'undefined' &&
  typeof Image !== 'undefined' &&
  typeof document !== 'undefined' &&
  !isTestEnvironment()
);

const getPicturePreloadRoot = () => {
  const existing = document.getElementById('tarot-picture-preload-root');
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = 'tarot-picture-preload-root';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
  (document.body || document.documentElement).appendChild(root);
  return root;
};

export const getTarotImageWarmupNetworkProfile = (): TarotWarmupNetworkProfile => {
  if (typeof navigator === 'undefined') return 'standard';

  const nav = navigator as Navigator & {
    connection?: NavigatorConnectionLike;
    mozConnection?: NavigatorConnectionLike;
    webkitConnection?: NavigatorConnectionLike;
  };
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const effectiveType = connection?.effectiveType?.toLowerCase();

  if (connection?.saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'constrained';
  }

  if (effectiveType === '3g') {
    return 'moderate';
  }

  return 'standard';
};

export const preloadTarotImageUrl = (
  src: string,
  priority: ImageFetchPriority = 'auto',
) => {
  if (!src || preloadedUrls.has(src)) return Promise.resolve();
  const pending = pendingUrls.get(src);
  if (pending) return pending;

  if (!canPreloadImages()) {
    return Promise.resolve();
  }

  let resolvePreload!: () => void;
  const promise = new Promise<void>(resolve => { resolvePreload = resolve; });
  // Register before assigning a source: cached images can finish immediately.
  pendingUrls.set(src, promise);
  {
    const avifSrc = getCardImageFormatUrl(src, 'avif');
    const webpSrc = getCardImageFormatUrl(src, 'webp');
    const image = document.createElement('img');
    const picture = avifSrc || webpSrc ? document.createElement('picture') : null;
    let isSettled = false;
    let timeoutId: number | null = null;

    const finish = (succeeded: boolean) => {
      if (isSettled) return;
      isSettled = true;
      if (succeeded) preloadedUrls.add(src);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      pendingUrls.delete(src);
      image.onload = null;
      image.onerror = null;
      picture?.remove();
      resolvePreload();
    };

    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    (image as HTMLImageElement & { fetchPriority?: ImageFetchPriority }).fetchPriority = priority;
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    timeoutId = window.setTimeout(() => finish(false), 15000);

    if (picture) {
      if (avifSrc) {
        const source = document.createElement('source');
        source.srcset = avifSrc;
        source.type = 'image/avif';
        picture.appendChild(source);
      }
      if (webpSrc) {
        const source = document.createElement('source');
        source.srcset = webpSrc;
        source.type = 'image/webp';
        picture.appendChild(source);
      }
      picture.appendChild(image);
      getPicturePreloadRoot().appendChild(picture);
    }

    image.src = src;

    if (!isSettled && image.decode) {
      try {
        void image.decode().then(() => finish(true), () => finish(false));
      } catch {
        finish(false);
      }
    }
  }
  return promise;
};

export const preloadTarotImageUrls = (
  urls: string[],
  { concurrency = 4, limit, priority = 'auto' }: PreloadOptions = {},
) => {
  const uniqueUrls = Array.from(new Set(urls))
    .filter(url => !preloadedUrls.has(url))
    .slice(0, limit ?? urls.length);

  if (!uniqueUrls.length) return Promise.resolve();

  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), uniqueUrls.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < uniqueUrls.length) {
      const url = uniqueUrls[cursor];
      cursor += 1;
      await preloadTarotImageUrl(url, priority);
    }
  });

  return Promise.allSettled(workers).then(() => undefined);
};

export const preloadTarotCardImages = (
  cardIds: string[],
  options?: PreloadOptions,
) => preloadTarotImageUrls(cardIds.map(getCardImageUrl), options);

const scheduleDeckWarmup = () => {
  if (!canPreloadImages()) return;
  if (isDeckWarmupRunning) {
    repeatDeckWarmupAfterOnline = true;
    return;
  }
  isDeckWarmupRunning = true;
  const networkProfile = getTarotImageWarmupNetworkProfile();

  const firstInteractionIds = Array.from(new Set([
    'ar00',
    'ar01',
    'ar02',
    'ar03',
    'ar04',
    'ar07',
    'pepa',
  ]));

  const remainingIds = TAROT_CARDS
    .map(card => card.id)
    .filter(id => !firstInteractionIds.includes(id));

  let remainingPhases = 2;
  const finishPhase = () => {
    remainingPhases -= 1;
    if (remainingPhases > 0) return;
    isDeckWarmupRunning = false;
    if (repeatDeckWarmupAfterOnline) {
      repeatDeckWarmupAfterOnline = false;
      scheduleDeckWarmup();
    }
  };

  // Apply the profile budget before skipping successes so reconnects do not expand its target set.
  const warmInitialDeck = () => {
    void preloadTarotCardImages(firstInteractionIds.slice(0, networkProfile === 'constrained' ? 4 : undefined), {
      concurrency: networkProfile === 'constrained' ? 1 : 3,
      priority: 'high',
    }).finally(finishPhase);
  };

  const warmRemainingDeck = () => {
    if (networkProfile === 'constrained') { finishPhase(); return; }

    void preloadTarotCardImages(remainingIds.slice(0, networkProfile === 'moderate' ? 18 : undefined), {
      concurrency: networkProfile === 'moderate' ? 1 : 2,
      priority: 'low',
    }).finally(finishPhase);
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(warmInitialDeck, { timeout: 1200 });
    idleWindow.requestIdleCallback(warmRemainingDeck, { timeout: 6000 });
    return;
  }

  window.setTimeout(warmInitialDeck, 900);
  window.setTimeout(warmRemainingDeck, 4500);
};

export const warmTarotDeckImages = () => {
  if (hasScheduledDeckWarmup || !canPreloadImages()) return;
  hasScheduledDeckWarmup = true;
  window.addEventListener('online', scheduleDeckWarmup);
  scheduleDeckWarmup();
};
