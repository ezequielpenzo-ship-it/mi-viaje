// Mi Viaje — service worker: guarda la app en el teléfono para usarla sin conexión.
const CACHE = 'mi-viaje-v11';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isPage = req => req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (isPage(req)) {
    // La app: primero internet (para tener siempre la última versión); si no hay o tarda, la guardada.
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req, { cache: 'no-store' }).then(res => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      });
      const timeout = new Promise(r => setTimeout(r, 3500));
      try {
        const res = await Promise.race([net, timeout]);
        if (res) return res;
      } catch (err) {}
      return (await cache.match('./index.html')) || net.catch(() => new Response('Sin conexión', { status: 503 }));
    })());
    return;
  }

  // Íconos y demás: lo guardado, y se actualiza en segundo plano.
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => undefined);
    return cached || (await network) || new Response('Sin conexión', { status: 503 });
  }));
});
