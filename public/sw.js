const CACHE_VERSION = 'dev';
const APP_CACHE = `tarot-pavilion-app-${CACHE_VERSION}`;
const STATIC_CACHE = `tarot-pavilion-static-${CACHE_VERSION}`;
const PRECACHE_ASSETS = /* BUILD_ASSETS */ [];
const PRECACHE_CARD_IMAGES = /* BUILD_CARD_IMAGES */ [];
const INSTALL_CONTEXT_PATH = '/__tarot-pavilion-install-context__';
const APP_SHELL = [
  '/',
  '/site.webmanifest',
  '/app-icon-192.png',
  '/app-icon-512.png',
  '/apple-touch-icon.png',
];

const isSameOrigin = (url) => url.origin === self.location.origin;

const isStaticAsset = (url) => (
  url.pathname.startsWith('/assets/')
  || url.pathname.startsWith('/tarot-cards/')
  || url.pathname === '/site.webmanifest'
  || url.pathname.endsWith('.png')
  || url.pathname.endsWith('.jpg')
  || url.pathname.endsWith('.jpeg')
  || url.pathname.endsWith('.ico')
  || url.pathname.endsWith('.svg')
  || url.pathname.endsWith('.webp')
  || url.pathname.endsWith('.woff2')
);

const shouldBypassCache = (request, url) => (
  request.method !== 'GET'
  || !isSameOrigin(url)
  || url.pathname.startsWith('/api/')
  || request.headers.has('authorization')
);

const isCardImage = (url) => url.pathname.startsWith('/tarot-cards/');
const isValidStaticResponse = (response, url) => {
  if (!response?.ok || response.redirected) return false;
  if (response.url) {
    const actual = new URL(response.url);
    if (!isSameOrigin(actual) || actual.pathname !== url.pathname) return false;
  }
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (isCardImage(url)) {
    const expected = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' }[url.pathname.split('.').at(-1)];
    return Boolean(expected) && type === expected;
  }
  return Boolean(type) && type !== 'text/html';
};

// Every supported picture format must be present before this worker can become
// active. A partially downloaded deck must not replace the working old worker.
const precacheStaticAssets = async () => {
  const cache = await caches.open(STATIC_CACHE);
  const paths = [...PRECACHE_ASSETS, ...PRECACHE_CARD_IMAGES];
  let cursor = 0;
  let failure;
  await Promise.all(Array.from({ length: Math.min(4, paths.length) }, async () => {
    while (cursor < paths.length && !failure) {
      const path = paths[cursor++];
      try {
        const url = new URL(path, self.location.origin);
        const response = await fetch(url.href, { cache: 'reload', redirect: 'error' });
        if (!isValidStaticResponse(response, url)) throw new Error(`Invalid offline asset: ${path}`);
        await cache.put(path, response);
      } catch (error) {
        failure = error;
      }
    }
  }));
  if (failure) throw failure;
};

const installOfflineCache = async () => {
  const firstInstall = !self.registration?.active;
  const results = await Promise.allSettled([
      caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)),
      precacheStaticAssets(),
  ]);
  const failed = results.find(result => result.status === 'rejected');
  try {
    if (failed) throw failed.reason;
    // A worker can restart between install and activate. Store the decision in
    // this version's cache rather than recalculating it in a new global scope.
    const cache = await caches.open(APP_CACHE);
    await cache.put(INSTALL_CONTEXT_PATH, new Response(JSON.stringify({ firstInstall }), {
      headers: { 'content-type': 'application/json' },
    }));
  } catch (error) {
    await Promise.all([caches.delete(APP_CACHE), caches.delete(STATIC_CACHE)]);
    throw error;
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(installOfflineCache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('tarot-pavilion-') && ![APP_CACHE, STATIC_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(async () => {
        const context = await (await caches.open(APP_CACHE)).match(INSTALL_CONTEXT_PATH);
        // Missing metadata must not turn an update into a takeover of old pages.
        if (context && (await context.json()).firstInstall === true) await self.clients.claim();
      })
  );
});

const refreshAppShell = async (request) => {
  const cache = await caches.open(APP_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
};

// A new worker waits for existing pages to close, so their hashed modules remain
// available. Navigation loads the current shell online and falls back offline.
const appShellFirst = async (request) => {
  const cache = await caches.open(APP_CACHE);
  const response = await refreshAppShell(request);
  if (response?.ok) return response;
  return await cache.match(request) || await cache.match('/') || response || Response.error();
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  const fetched = fetch(request)
    .then((response) => {
      if (isValidStaticResponse(response, new URL(request.url))) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetched;
};

const cacheFirst = async (request) => {
  const staticCache = await caches.open(STATIC_CACHE);
  const cached = await staticCache.match(request, { ignoreVary: true })
    || await (await caches.open(APP_CACHE)).match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (isValidStaticResponse(response, new URL(request.url))) {
    await staticCache.put(request, response.clone());
  }
  return response;
};

const cardImageFirst = async (request) => {
  const url = new URL(request.url);
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(url.pathname, { ignoreVary: true });
  if (isValidStaticResponse(cached, url)) return cached;
  const response = await fetch(request, { redirect: 'error' });
  if (!isValidStaticResponse(response, url)) return Response.error();
  await cache.put(url.pathname, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (shouldBypassCache(event.request, url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(appShellFirst(event.request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      isCardImage(url)
        ? cardImageFirst(event.request)
        : url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)
        ? cacheFirst(event.request)
        : staleWhileRevalidate(event.request)
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
