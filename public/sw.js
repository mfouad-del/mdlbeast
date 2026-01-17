// MDLBEAST Service Worker for PWA
const CACHE_NAME = 'mdlbeast-v2-2026-01-17';
const urlsToCache = [
  '/mdlbeast/',
  '/mdlbeast/index.html',
  '/mdlbeast/logo.png',
  '/mdlbeast/favicon.jpg',
  '/mdlbeast/icon.jpg',
  '/mdlbeast/manifest.json'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('[SW] Failed to cache:', err);
      })
  );
  // Force waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW] Cleaning old caches:', cacheNames);
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated with cache:', CACHE_NAME);
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests - always fetch from network
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone();
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // Return offline page if available
          return caches.match('/mdlbeast/');
        });
      })
  );
});

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'إشعار جديد من MDLBEAST',
    icon: '/mdlbeast/logo.png',
    badge: '/mdlbeast/icon.jpg',
    dir: 'rtl',
    lang: 'ar'
  };
  
  event.waitUntil(
    self.registration.showNotification('MDLBEAST Communications', options)
  );
});
