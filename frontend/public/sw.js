// Minimal service worker for installability. No aggressive caching to avoid stale forms.
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Network-first for navigation to avoid stale pages
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(() => caches.match('/')));
    }
});
