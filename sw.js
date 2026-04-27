// Service Worker - PAF Wambrechies
// Cache-first strategy for all static assets + Push notifications

const CACHE_NAME = 'paf-wambrechies-v9';
const IMAGE_CACHE_NAME = 'paf-images-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/login-bg.png'
];

// ── Install: pre-cache all static assets ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Use individual requests to avoid aborting the whole install if one
      // optional asset (e.g. PNG icons that haven't been generated yet) fails.
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Could not cache ${url}:`, err);
          })
        )
      );
    })
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate: remove stale caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      })
  );
});

// ── Fetch: cache-first for static assets, network-only for everything else ──
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Supabase Storage public images: cache-first with no background refresh.
  // Photo paths embed a timestamp + random suffix, so a new upload yields a
  // brand-new URL — cached entries are safe to keep indefinitely.
  if (url.pathname.startsWith('/storage/v1/object/public/')) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(cache =>
        cache.match(event.request).then(hit => hit || fetch(event.request).then(res => {
          if (res && res.status === 200) cache.put(event.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Don't cache anything else cross-origin (Supabase REST API, CDNs, …).
  // Caching API responses caused stale data after edits.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Serve from cache; refresh the cache entry in background
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const cloned = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
            }
            return networkResponse;
          })
          .catch(() => { /* network unavailable, that's fine */ });

        // Return cached version immediately (stale-while-revalidate)
        return cachedResponse;
      }

      // Not in cache – fetch from network and cache it
      return fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});

// ── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'PAF Wambrechies', {
      body:  data.body || '',
      icon:  '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data:  { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
