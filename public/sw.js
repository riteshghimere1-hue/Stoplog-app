const CACHE_NAME = 'stoplog-cache-v6';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

// Install Service Worker and Cache Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate and clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Strategy: Cache First for UI, Network Only for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache API calls or Excel downloads
    if (url.pathname.startsWith('/api/')) {
        return; // Let the browser handle this normally over the network
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // Return from cache
            }
            return fetch(event.request); // Fetch from network if not in cache
        })
    );
});