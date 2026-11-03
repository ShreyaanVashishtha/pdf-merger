/**
 * Service Worker for PDF Merger & Toolbox PWA
 * Strategy:
 *  - Same-origin assets & navigation: Network-First with Cache-Fallback (prevents stale code bugs)
 *  - CDN libraries (pdf-lib, sortablejs, pdf.js): Cache-First with Network-Fallback (immutable versions)
 */

const CACHE_NAME = 'pdf-toolbox-v2.3.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/css/styles.css?v=2.3.0',
  './src/js/main.js?v=2.3.0',
  './src/js/ui.js?v=2.3.0',
  './src/js/fileManager.js?v=2.3.0',
  './src/js/pdfMerger.js',
  './src/js/pdfTools.js?v=2.3.0',
  './src/js/pageRange.js?v=2.3.0',
  './src/js/thumbnailRenderer.js?v=2.3.0',
  './src/js/utils.js?v=2.3.0',
  './src/icons/icon-192.png',
  './src/icons/icon-512.png',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => console.warn('[SW] Precache notice:', err)))
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
              console.log('[SW] Clearing old cache:', key);
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
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 1. Navigation (HTML pages): Network-First, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // 2. Same-origin assets (JS/CSS/images): Network-First to guarantee latest code updates
  if (isSameOrigin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  // 3. Third-party CDN libraries: Cache-First, fallback to network
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(err => {
          console.warn('[SW] Fetch failed for:', request.url, err);
        });
    })
  );
});
