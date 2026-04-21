const CACHE_NAME = 'dictionary-cache-v1';
const urlsToCache = [
  'index.html',
  'style.css',
  'script.js',
  'dictionary.json',
  'manifest.json',
  'dictionary-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return cached version if available
      if (cachedResponse) return cachedResponse;

      // Otherwise fetch from network and cache it for next time
      return fetch(event.request).then(networkResponse => {
        // Only cache valid responses (ignore opaque responses if you want)
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (!cacheWhitelist.includes(key)) {
          return caches.delete(key);
        }
      }))
    )
  );
});
