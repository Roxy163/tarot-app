const CACHE_VERSION = 'dev';
const APP_CACHE = `tarot-pavilion-app-${CACHE_VERSION}`;
const STATIC_CACHE = `tarot-pavilion-static-${CACHE_VERSION}`;
const PRECACHE_ASSETS = /* BUILD_ASSETS */ [];
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)),
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)),
    ])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('tarot-pavilion-') && ![APP_CACHE, STATIC_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
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
      if (response.ok) {
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
  if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
    await staticCache.put(request, response.clone());
  }
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
      url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)
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
