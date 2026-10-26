// Service worker: la app abre al instante y funciona con señal débil.
// Sube el número de VERSION cada vez que publiques cambios.
const VERSION = "academia-v1.16.1";
const NUCLEO = [
  "./", "index.html", "style.css", "config.js", "manifest.webmanifest",
  "js/app.js", "js/admin.js", "js/datos.js", "js/demo.js", "js/ui.js", "js/subir.js", "js/contenido.js", "js/certificado.js", "js/visor.js", "js/puntos.js", "js/fiesta.js", "js/configuracion.js", "js/audio.js", "js/admin-audio.js", "js/portadas.js", "js/avatar.js", "js/avatar-editor.js", "js/premios.js", "js/subtitulos.js", "js/libreta.js", "js/admin-ideas.js", "js/zip.js",
  "img/logo.png", "img/isotipo.webp", "img/icon-192.png", "img/icon-512.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" → baja los archivos frescos del servidor, no los que el navegador guardó.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(NUCLEO.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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
      // "no-cache": siempre pregunta al servidor si hay versión nueva (GitHub guarda copias 10 min).
      fetch(e.request, { cache: "no-cache" }).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
        return r;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  // Librerías y fuentes (CDN): caché primero.
  if (/jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return resp;
    })));
  }
});
