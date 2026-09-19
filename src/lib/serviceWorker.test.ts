import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const worker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
const response = (body: string, type = 'text/html') => ({
  ok: true, body, headers: new Headers({ 'content-type': type }),
  clone() { return response(body, type); },
});

function setup() {
  const handlers: Record<string, (event: any) => void> = {};
  const entries = new Map<string, Map<string, any>>();
  const cacheKey = (key: string | { url: string }) => typeof key === 'string' ? key : key.url;
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
  runInNewContext(worker, {
    self: { location: { origin: 'https://tarot.test' }, addEventListener: (name: string, handler: any) => { handlers[name] = handler; }, skipWaiting, clients: { claim } },
    caches, fetch, URL, Response: { error: () => ({ ok: false }) },
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
});
