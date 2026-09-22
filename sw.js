/* ============================================
   EmailVault Pro - Service Worker
   Offline-first app shell with runtime caching
   ============================================ */

const VERSION = '2.0.0';
const CACHE_NAME = `emailvault-${VERSION}`;

const APP_ASSETS = [
  './index.html',
  './icons/favicon.svg',
  './manifest.json',
  './css/style.css',
  './css/dark-theme.css',
  './css/animations.css',
  './css/mobile.css',
  './js/firebase-config.js',
  './js/utils.js',
  './js/notifications.js',
  './js/ui.js',
  './js/export.js',
  './js/analytics.js',
  './js/pwa.js',
  './js/settings.js',
  './js/clients.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

function resolveUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

// Install: precache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS.map(resolveUrl)))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first same-origin (stays fresh), cache-first for CDN
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests over http(s)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation requests: network first, fall back to cached index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(resolveUrl('./index.html'), copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match(resolveUrl('./index.html'))
          )
        )
    );
    return;
  }

  // Same-origin assets (our CSS/JS): network first so updates show immediately,
  // cached copy as fallback when offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cross-origin (CDN: fonts, Firebase, Chart.js): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});

// Skip waiting on new service worker message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================
// WEB PUSH - phone notifications (daily digest)
// ============================================

// Show the notification pushed from the server
self.addEventListener('push', (event) => {
  let data = { title: 'EmailVault Pro', body: 'Check your expiring accounts', url: './' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) { /* keep defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url || './' },
      tag: 'emailvault-daily'
    })
  );
});

// Open the app when the notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || './',
    self.location.origin
  ).toString();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});