// Offline-Fähigkeit: Seite aus dem Cache, Preise immer zuerst aus dem Netz.
const CACHE = 'gold-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'icon.svg', 'manifest.webmanifest', 'vendor/chart.umd.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Netz zuerst, bei Funkloch der letzte Stand aus dem Cache.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.origin === location.origin)) {
          const copy = res.clone();
          const key = url.origin === location.origin ? url.pathname : e.request;
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(url.origin === location.origin ? url.pathname : e.request)),
  );
});
