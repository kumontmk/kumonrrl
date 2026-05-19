// sw.js - Service Worker for Kumon RRL Library
// ⚠️ CHANGE THIS VERSION NUMBER EVERY TIME YOU UPDATE THE SITE ⬇️
const CACHE_VERSION = '4.3.2'; // 👈 INCREMENT THIS ON EVERY DEPLOY
const CACHE_NAME = `kumon-rrl-library-v${CACHE_VERSION}`;
const urlsToCache = [
  '/kumonrrl/',
  '/kumonrrl/index.html',
  '/kumonrrl/styles.css',
  '/kumonrrl/script.js',
  '/kumonrrl/manifest.json',
  '/kumonrrl/banner1.jpg',
  '/kumonrrl/banner2.jpg',
  '/kumonrrl/banner3.jpg'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// ✅ FIXED FETCH STRATEGY: Only cache static assets. Never cache Firebase/API calls.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Network-only for external APIs, Firebase, and dynamic requests
  if (url.origin !== location.origin || url.pathname.includes('/__/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for your own static files
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Activate Service Worker (Clean up old caches)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ✅ NEW: Allow client to skip waiting immediately
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

