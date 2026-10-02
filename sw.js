/* Trabajador de servicio: hace que la aplicación arranque rápido a partir de la
   segunda vez. No guarda ningún dato del centro, solo los ficheros de la propia
   aplicación (JavaScript, estilos, tipografías e iconos).

   Reglas:
   - «assets/…»: los nombres llevan una huella única por compilación, así que se
     pueden guardar sin miedo (si cambia el fichero, cambia el nombre).
   - index.html, version.json y configuracion.js: siempre de la red, para que una
     versión nueva se vea enseguida; si no hay internet, se usa la copia.
   - Al instalar una compilación nueva se borran las cajas de las anteriores.
*/
const CAJA = 'robotica-' + ("30");
const SIEMPRE_DE_LA_RED = ['index.html', 'version.json', 'configuracion.js', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CAJA));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('robotica-') && n !== CAJA).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'limpiar') caches.keys().then((ns) => ns.forEach((n) => caches.delete(n)));
});

const esDeLaApp = (url) => url.origin === self.location.origin;
const deLaRedSiempre = (url) => SIEMPRE_DE_LA_RED.some((f) => url.pathname.endsWith(f)) || url.pathname.endsWith('/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!esDeLaApp(url)) return;              // Firebase y Google, nunca se tocan

  if (deLaRedSiempre(url)) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok) (await caches.open(CAJA)).put(req, r.clone());
        return r;
      } catch {
        const c = await caches.match(req);
        if (c) return c;
        throw new Error('sin conexión');
      }
    })());
    return;
  }

  // Ficheros con huella: primero la copia guardada
  e.respondWith((async () => {
    const c = await caches.match(req);
    if (c) return c;
    const r = await fetch(req);
    if (r && r.ok && (url.pathname.includes('/assets/') || /\.(png|svg|woff2?)$/.test(url.pathname))) {
      (await caches.open(CAJA)).put(req, r.clone());
    }
    return r;
  })());
});
