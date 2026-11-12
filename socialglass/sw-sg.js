// SocialGlass: service worker per l'app installata e le notifiche (non salva dati in cache)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});   // nessuna cache: il sito si carica sempre aggiornato
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch(_){ d = {testo: e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(d.titolo || "SocialGlass", {body: d.testo || "", icon: "assets/icon-192.png", badge: "assets/icon-192.png", data: {url: d.url || "./"}, lang: "it"}));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(l => {
    for (const c of l) if (c.url.split("?")[0] === new URL(url, self.location).href.split("?")[0] && "focus" in c){ c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
