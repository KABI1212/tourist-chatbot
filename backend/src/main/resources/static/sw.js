/**
 * TouristAI — Progressive Web App Service Worker (Phase 24)
 * Enables offline itinerary access, static asset caching, and transit resiliency.
 */

const CACHE_NAME = 'tourist-ai-v1.2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/destinations.html',
    '/planner.html',
    '/chatbot.html',
    '/dashboard.html',
    '/login.html',
    '/register.html',
    '/reset-password.html',
    '/manifest.json',
    '/css/style.css',
    '/css/responsive.css',
    '/css/chatbot.css',
    '/js/config.js',
    '/js/api.js',
    '/js/app.js',
    '/js/auth.js',
    '/js/theme.js',
    '/js/i18n.js',
    '/js/voice.js',
    '/assets/brand/logo-dark.png',
    '/assets/brand/logo-light.png',
    '/assets/brand/icon-192x192.png',
    '/assets/brand/icon-512x512.png',
    '/assets/brand/favicon-dark-16x16.png',
    '/assets/brand/favicon-light-32x32.png',
    '/assets/dash.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Cache addAll partial failure:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension schemes
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    // Network-first for dynamic API calls
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        if (cached) return cached;
                        return new Response(JSON.stringify({
                            success: false,
                            message: 'You are currently offline. Displaying cached travel data.',
                            offline: true
                        }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // Cache-first with network fallback for static assets, scripts & styles
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached version and update in background (stale-while-revalidate)
                fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
                return response;
            }).catch(() => {
                // If HTML page request fails offline, fallback to index
                if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

