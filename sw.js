// Album du musée : fonctionne sans réseau une fois ouvert une première fois.
const VERSION = 'album-v4';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'share').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  // Album partagé depuis une autre appli (Android) : on le garde et on ouvre l'appli
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try { const fd = await req.formData(); const f = fd.get('album');
        if (f) await (await caches.open('share')).put('shared-album', new Response(f)); } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Page : réseau d'abord (pour recevoir les mises à jour), cache sinon.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(k => k.put('index.html', c)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // Fichiers de l'appli et polices Google : cache d'abord.
  if (url.origin === location.origin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(k => k.put(req, c)); }
      return r;
    })));
  }
});
