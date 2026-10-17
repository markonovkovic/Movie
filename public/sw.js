'use strict';

// MoviePicker service worker: makes the app installable, fast to open, and usable offline.
// Pages and code are fetched from the network first (so updates show up straight away),
// falling back to the cached copy when offline. Movie data is never cached; only the small
// emotion/genre lists the home screen needs are kept.

const VERSION = 'v4';
const CACHE = `moviepicker-${VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/music.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-64.png',
  // The small lists the home screen needs, so it works offline from the very first visit.
  '/api/emotions',
  '/api/genres',
  '/api/config',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('moviepicker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const offlineApiResponse = () => new Response(
  JSON.stringify({ error: "You're offline. Connect to the internet to find movies." }),
  { status: 503, headers: { 'Content-Type': 'application/json' } },
);

// Small lists the home screen needs (emotions, genres, settings): kept so it still works offline.
const KEEP_FOR_OFFLINE = new Set(['/api/emotions', '/api/genres', '/api/config']);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith('/api/')) {
    if (request.method === 'GET' && KEEP_FOR_OFFLINE.has(url.pathname)) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match(request).then((cached) => cached || offlineApiResponse())),
      );
    } else {
      // Movie data (including searches) is always live; a friendly message when offline.
      event.respondWith(fetch(request).catch(offlineApiResponse));
    }
    return;
  }
  if (request.method !== 'GET') return;

  // The app itself: network first, cached copy when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then((cached) => cached || (request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))),
    );
    return;
  }

  // Fonts: cached after first use so the app looks right offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })),
    );
  }
  // Everything else (posters, trailers) goes straight to the network.
});
