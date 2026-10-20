/* OttiVista · service worker: app sempre aggiornata, file pesanti in cache */
const CACHE = "ottivista-v14";
const SHELL = ["./", "index.html", "profile3d.js", "studio.html", "studio-analyze.js", "manifest.webmanifest", "icons/icon-192.png", "models/round.glb", "models/sport.glb"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  // pagine e file dell'app: prima la rete (aggiornamenti immediati), poi la cache se offline
  if (same && (req.mode === "navigate" || /\.(html|js|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/"))){
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // librerie, modello del viso e modelli 3D: prima la cache (avvio veloce)
  const cacheable = same || /cdn\.jsdelivr\.net|storage\.googleapis\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque"){ const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
    return r;
  })));
});
