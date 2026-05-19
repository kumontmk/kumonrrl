// sw.js
const CACHE_VERSION = '4.2.6'; // ⚠️ INCREMENT THIS ON EVERY DEPLOY
const CACHE_NAME = `kumon-rrl-v${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/kumonrrl/',
  '/kumonrrl/index.html',
  '/kumonrrl/styles.css',
  '/kumonrrl/script.js',
  '/kumonrrl/manifest.json',
  '/kumonrrl/banner1.jpg',
  '/kumonrrl/banner2.jpg',
  '/kumonrrl/banner3.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // ✅ NETWORK-ONLY for Firebase, APIs, WebSockets, and external requests
  if (url.origin !== location.origin || 
      url.pathname.includes('firebase') || 
      url.pathname.includes('googleapis') || 
      url.pathname.includes('openlibrary') || 
      url.pathname.includes('itunes.apple')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ✅ CACHE-FIRST for your static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ✅ CROSS-BROWSER SKIP_WAITING LISTENER
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
