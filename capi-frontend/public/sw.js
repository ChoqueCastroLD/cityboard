const CACHE = 'capichan-monopoly-v1';
const BASE = new URL(self.registration.scope).pathname;

const isStaticAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith(BASE) && (url.pathname.startsWith(`${BASE}boards/`) || url.pathname.startsWith(`${BASE}assets/`) || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([`${BASE}index.html`, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.pathname.startsWith(BASE) || url.pathname.startsWith(`${BASE}api/`) || url.pathname.startsWith(`${BASE}ws/`)) return;
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(`${BASE}index.html`).then((cached) => cached ?? Response.error())));
  }
});
