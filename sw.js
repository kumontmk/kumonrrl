// sw.js - Service Worker for Kumon RRL Library

// ️ CHANGE THIS VERSION NUMBER EVERY TIME YOU UPDATE THE SITE ⬇️
const CACHE_VERSION = '2.5.4'; 
const CACHE_NAME = `kumon-rrl-library-v${CACHE_VERSION}`;

const urlsToCache = [
  '/kumonrrl/',
  '/kumonrrl/index.html',
  '/kumonrrl/styles.css',
  '/kumonrrl/script.js',
  '/kumonrrl/manifest.json',
  // Add your banner images here if they change often
  '/kumonrrl/banner1.jpg',
  '/kumonrrl/banner2.jpg',
  '/kumonrrl/banner3.jpg'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Fetch cached content
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
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
          // If the cache name is not in the whitelist, delete it
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});
