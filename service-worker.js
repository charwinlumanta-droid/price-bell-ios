'use strict';
// Change this version only when publishing a complete new app-shell release.
const VERSION = 'v2';
const CACHE_PREFIX = 'icc-price-bell-iphone-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const SHELL_FILES = [
 './', './index.html', './app.js', './engine.js', './style.css',
 './logo.png', './manifest.webmanifest', './INSTALL-ON-IPHONE.html',
 './icons/apple-touch-icon.png', './icons/icon-192.png',
 './icons/icon-512.png', './icons/icon-maskable-512.png'
];
const SHELL_URLS = SHELL_FILES.map(file => new URL(file, self.registration.scope).href);
const SHELL_PATHS = new Set(SHELL_URLS.map(url => new URL(url).pathname));
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const GUIDE_URL = new URL('./INSTALL-ON-IPHONE.html', self.registration.scope).href;
const PAGE_PATHS = new Set([new URL('./', self.registration.scope).pathname, new URL(INDEX_URL).pathname, new URL(GUIDE_URL).pathname]);
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE_NAME).then(cache =>
  cache.addAll(SHELL_URLS.map(url => new Request(url, { cache: 'reload' })))
 ));
 // Wait for existing app windows to close instead of mixing two release versions.
});
self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch', event => {
 const request = event.request;
 const url = new URL(request.url);
 // Market REST requests, WebSockets, credentials and other origins are not cached.
 if (request.method !== 'GET' || url.origin !== self.location.origin ||
     request.headers.has('Authorization') || url.search || !SHELL_PATHS.has(url.pathname)) return;
 if (request.mode === 'navigate' && PAGE_PATHS.has(url.pathname)) {
  event.respondWith((async () => {
   const pageKey = url.pathname === new URL(GUIDE_URL).pathname ? GUIDE_URL : INDEX_URL;
   // Serve this release's HTML with this release's cached scripts/styles.
   // A newly deployed release activates only after existing windows close.
   const cached = await caches.match(pageKey, { cacheName: CACHE_NAME });
   if (cached) return cached;
   try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
     try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(pageKey, response.clone());
     } catch (_) { /* A cache quota error must not hide an online page. */ }
     return response;
    }
   } catch (_) {}
   return new Response('Price Bell has not downloaded its offline files yet. Connect to the internet and reopen the app.', {
    status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
   });
  })());
 } else {
  event.respondWith((async () => {
   const cached = await caches.match(request, { cacheName: CACHE_NAME });
   if (cached) return cached;
   const response = await fetch(request);
   if (response.ok && response.type === 'basic') {
    try {
     const cache = await caches.open(CACHE_NAME);
     await cache.put(request, response.clone());
    } catch (_) { /* Online shell files remain usable without offline cache. */ }
   }
   return response;
  })());
 }
});

