/**
 * Service Worker for PDF Merger PWA
 * Provides offline caching for application shell and vendor libraries.
 */

const CACHE_NAME = 'pdf-merger-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/css/styles.css',
  './src/js/main.js',
  './src/js/ui.js',
  './src/js/fileManager.js',
  './src/js/pdfMerger.js',
  './src/js/pdfTools.js',
  './src/js/pageRange.js',
  './src/js/thumbnailRenderer.js',
  './src/js/utils.js',
  './src/icons/icon-192.png',
  './src/icons/icon-512.png',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => console.warn('[SW] Precache issue:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then(response => {
          // Cache successful responses from same-origin or authorized CDNs
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const shouldCache =
            request.url.startsWith(self.location.origin) ||
            request.url.includes('unpkg.com') ||
            request.url.includes('jsdelivr.net') ||
            request.url.includes('cdnjs.cloudflare.com');

          if (shouldCache) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // If offline and request is for navigation, return cached index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
