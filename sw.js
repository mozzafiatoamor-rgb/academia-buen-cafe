// Service worker: la app abre al instante y funciona con señal débil.
// Sube el número de VERSION cada vez que publiques cambios.
const VERSION = "academia-v1.0.0";
const NUCLEO = [
  "./", "index.html", "style.css", "config.js", "manifest.webmanifest",
  "js/app.js", "js/admin.js", "js/datos.js", "js/demo.js", "js/ui.js",
  "img/logo.png", "img/icon-192.png", "img/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Nunca cachear datos ni videos: Supabase y Bunny siempre en vivo.
  if (/supabase\.co$|mediadelivery\.net$|bunnycdn\.com$|b-cdn\.net$/.test(url.hostname)) return;

  // Archivos propios: red primero (para recibir cambios), caché si no hay señal.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
        return r;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  // Librerías y fuentes (CDN): caché primero.
  if (/jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return resp;
    })));
  }
});
