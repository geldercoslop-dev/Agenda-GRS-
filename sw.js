/* PWA Service Worker v4
   Objetivo: matar caches antigos, evitar manifest/icone "preso", e manter cache normal do app.
*/
const CACHE_NAME = "pwa-cache-v4";
const CORE_ASSETS = [
  "./",
  "./index.html?v=4",
  "./manifest.json?v=4"
];

// Instalacao: pega o novo SW imediatamente
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => undefined)
  );
});

// Ativacao: limpa caches antigos e assume controle
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Helper: network-first (para manifest e icones, que o Android/Chrome costuma cachear agressivo)
async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    throw e;
  }
}

// Helper: cache-first (para o resto)
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const fresh = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Só intercepta requests do mesmo origin
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  const isManifest = path.endsWith("/manifest.json") || path.endsWith("manifest.json");
  const isIcon = path.includes("/icons/") && (path.endsWith(".png") || path.endsWith(".webp") || path.endsWith(".jpg"));

  if (isManifest || isIcon) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Navegacao: tenta rede primeiro para evitar app "travado" em versoes antigas
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match("./");
        return cached || caches.match("./index.html?v=4") || Response.error();
      }
    })());
    return;
  }

  event.respondWith(cacheFirst(req));
});
