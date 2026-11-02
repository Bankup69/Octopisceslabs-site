// Offline support: serve the app shell from cache, refreshing it in the background.
const CACHE = 'equityfoundry-v16';
const SHELL = [
  './', 'index.html', 'privacy.html', 'terms.html', 'styles.css', 'config.js', 'calc.js', 'listing.js', 'account.js', 'settings.js',
  'account-page.js', 'pro.js',
  'launch.js', 'report.js',
  'app.js', 'help.js', 'manifest.webmanifest', 'vendor/fonts/inter-latin-wght-normal.woff2', 'vendor/fonts/playfair-display-latin-wght-normal.woff2', 'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js',
  'icons/icon.svg', 'icons/icon-square.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(ev.request, { ignoreSearch: true });
      const fresh = fetch(ev.request)
        .then((res) => { if (res.ok) cache.put(ev.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
