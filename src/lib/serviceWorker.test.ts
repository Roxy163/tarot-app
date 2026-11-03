import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { TAROT_CARDS, getCardImageSources } from '../constants';

const worker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
const response = (body: string, type = 'text/html', url = '', redirected = false) => ({
  ok: true, body, url, redirected, headers: new Headers({ 'content-type': type }),
  clone() { return response(body, type, url, redirected); },
});

function setup({ firstInstall = false, cardImages = [] as string[], assets = [] as string[], existingEntries = undefined as Map<string, Map<string, any>> | undefined } = {}) {
  const handlers: Record<string, (event: any) => void> = {};
  const entries = existingEntries || new Map<string, Map<string, any>>();
  const cacheKey = (key: string | { url: string }) => new URL(typeof key === 'string' ? key : key.url, 'https://tarot.test').href;
  const caches = {
    open: async (name: string) => {
      if (!entries.has(name)) entries.set(name, new Map());
      const cache = entries.get(name)!;
      return {
        match: async (key: string | { url: string }) => cache.get(cacheKey(key)),
        put: async (key: string | { url: string }, value: any) => { cache.set(cacheKey(key), value); },
        addAll: vi.fn().mockResolvedValue(undefined),
      };
    },
    keys: async () => [...entries.keys()],
    delete: async (key: string) => entries.delete(key),
  };
  const fetch = vi.fn().mockResolvedValue(response('new shell'));
  const skipWaiting = vi.fn();
  const claim = vi.fn();
  const builtWorker = worker
    .replace('const PRECACHE_CARD_IMAGES = /* BUILD_CARD_IMAGES */ [];', `const PRECACHE_CARD_IMAGES = ${JSON.stringify(cardImages)};`)
    .replace('const PRECACHE_ASSETS = /* BUILD_ASSETS */ [];', `const PRECACHE_ASSETS = ${JSON.stringify(assets)};`);
  runInNewContext(builtWorker, {
    self: { registration: { active: firstInstall ? null : {} }, location: { origin: 'https://tarot.test' }, addEventListener: (name: string, handler: any) => { handlers[name] = handler; }, skipWaiting, clients: { claim } },
    caches, fetch, URL, Response,
  });
  const lifecycle = async (name: string) => {
    let work: Promise<unknown> | undefined;
    handlers[name]({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
  };
  const request = async (path = '/', mode = 'navigate') => {
    let work: Promise<any> | undefined;
    handlers.fetch({ request: { url: `https://tarot.test${path}`, method: 'GET', mode, headers: new Headers() }, respondWith: (promise: Promise<any>) => { work = promise; } });
    return work;
  };
  return { caches, entries, fetch, skipWaiting, claim, lifecycle, request };
}

describe('PWA updates and offline navigation', () => {
  it('keeps the existing worker in control until open pages close', async () => {
    const app = setup();
    await app.lifecycle('install');
    expect(app.skipWaiting).not.toHaveBeenCalled();
    await app.lifecycle('activate');
    expect(app.claim).not.toHaveBeenCalled();
  });
  it('controls the first online visit after the complete offline cache is installed', async () => {
    const app = setup({ firstInstall: true });
    await app.lifecycle('install');
    await app.lifecycle('activate');
    expect(app.claim).toHaveBeenCalledOnce();
    expect(app.skipWaiting).not.toHaveBeenCalled();
  });
  it('remembers a first install across a worker restart before activation', async () => {
    const installing = setup({ firstInstall: true });
    await installing.lifecycle('install');
    const restarted = setup({ firstInstall: false, existingEntries: installing.entries });
    await restarted.lifecycle('activate');
    expect(restarted.claim).toHaveBeenCalledOnce();
    expect(restarted.skipWaiting).not.toHaveBeenCalled();
  });
  it('does not claim old pages after an update worker restarts even if the old worker and caches are unavailable', async () => {
    const installing = setup({ firstInstall: false });
    await installing.lifecycle('install');
    const restarted = setup({ firstInstall: true, existingEntries: installing.entries });
    await restarted.lifecycle('activate');
    expect(restarted.claim).not.toHaveBeenCalled();
    expect(restarted.skipWaiting).not.toHaveBeenCalled();
  });
  it('loads the current shell online and retains it for offline navigation', async () => {
    const app = setup();
    const cache = await app.caches.open('tarot-pavilion-app-dev');
    await cache.put('/', response('old shell'));
    expect((await app.request()).body).toBe('new shell');
    app.fetch.mockRejectedValue(new Error('offline'));
    expect((await app.request()).body).toBe('new shell');
  });
  it('does not cache a missing module fallback as JavaScript', async () => {
    const app = setup();
    await app.request('/assets/missing.js', 'cors');
    const cache = await app.caches.open('tarot-pavilion-static-dev');
    expect(await cache.match('https://tarot.test/assets/missing.js')).toBeUndefined();
  });
  it('cleans only caches belonging to this application', async () => {
    const app = setup();
    await app.caches.open('tarot-pavilion-static-old');
    await app.caches.open('another-app-cache');
    await app.lifecycle('activate');
    expect(app.entries.has('tarot-pavilion-static-old')).toBe(false);
    expect(app.entries.has('another-app-cache')).toBe(true);
  });
  it('precaches all 78 cards in every picture format and serves unseen cards without a network request', async () => {
    const paths = TAROT_CARDS.flatMap(card => Object.values(getCardImageSources(card.id)));
    expect(paths).toHaveLength(234);
    const app = setup({ cardImages: paths });
    app.fetch.mockImplementation(async (url: string) => {
      const format = url.split('.').at(-1);
      return response('real card bytes', format === 'jpg' ? 'image/jpeg' : `image/${format}`, url);
    });
    await app.lifecycle('install');
    expect(app.fetch).toHaveBeenCalledTimes(234);
    expect(app.fetch).toHaveBeenCalledWith(expect.any(String), { cache: 'reload', redirect: 'error' });
    app.fetch.mockClear().mockRejectedValue(new Error('offline'));
    for (const path of paths) expect((await app.request(path, 'cors')).body).toBe('real card bytes');
    expect((await app.request('/tarot-cards/peki.avif?v=old', 'cors')).body).toBe('real card bytes');
    expect(app.fetch).not.toHaveBeenCalled();
  });
  it('rejects HTML and redirected image fallbacks and leaves the previous worker’s cache intact', async () => {
    for (const invalid of [response('app shell', 'text/html'), response('wrong image', 'image/avif', 'https://elsewhere.test/ar00.avif', true)]) {
      const app = setup({ cardImages: ['/tarot-cards/ar00.avif'] });
      await app.caches.open('tarot-pavilion-static-previous');
      app.fetch.mockResolvedValue(invalid);
      await expect(app.lifecycle('install')).rejects.toThrow('Invalid offline asset');
      expect(app.entries.has('tarot-pavilion-static-dev')).toBe(false);
      expect(app.entries.has('tarot-pavilion-app-dev')).toBe(false);
      expect(app.entries.has('tarot-pavilion-static-previous')).toBe(true);
    }
  });
  it('does not activate an incomplete offline deck if a single card cannot download', async () => {
    const app = setup({ cardImages: ['/tarot-cards/ar00.avif', '/tarot-cards/ar01.avif'] });
    app.fetch.mockImplementation(async (url: string) => {
      if (url.includes('ar01')) throw new Error('interrupted download');
      return response('image', 'image/avif', url);
    });
    await expect(app.lifecycle('install')).rejects.toThrow('interrupted download');
    expect(app.entries.has('tarot-pavilion-static-dev')).toBe(false);
    expect(app.entries.has('tarot-pavilion-app-dev')).toBe(false);
    expect(app.claim).not.toHaveBeenCalled();
  });
  it('rejects a missing built module instead of completing an offline install with HTML', async () => {
    const app = setup({ assets: ['/assets/missing.js'] });
    await expect(app.lifecycle('install')).rejects.toThrow('Invalid offline asset');
    expect(app.entries.has('tarot-pavilion-static-dev')).toBe(false);
  });
  it('does not cache HTML as a card when a runtime image request is missing', async () => {
    const app = setup();
    expect((await app.request('/tarot-cards/ar00.avif', 'cors')).ok).toBe(false);
    const cache = await app.caches.open('tarot-pavilion-static-dev');
    expect(await cache.match('/tarot-cards/ar00.avif')).toBeUndefined();
  });
});
