/* PWA Service Worker v5 — com notificações de remédio */
const CACHE_NAME = "pwa-cache-v5";
const CORE_ASSETS = [
  "./",
  "./index.html?v=5",
  "./manifest.json?v=5"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

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
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  const isManifest = path.endsWith("/manifest.json") || path.endsWith("manifest.json");
  const isIcon = path.includes("/icons/") && (path.endsWith(".png") || path.endsWith(".webp") || path.endsWith(".jpg"));
  if (isManifest || isIcon) { event.respondWith(networkFirst(req)); return; }
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match("./");
        return cached || caches.match("./index.html?v=5") || Response.error();
      }
    })());
    return;
  }
  event.respondWith(cacheFirst(req));
});

// ══ NOTIFICAÇÕES DE REMÉDIO ══
// Recebe lista de alertas do app e agenda via setTimeout
const agendados = new Map(); // id → timeoutId

self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (type === "AGENDAR_NOTIFICACOES") {
    // Cancela todos os anteriores
    agendados.forEach((tid) => clearTimeout(tid));
    agendados.clear();

    const agora = Date.now();
    (payload || []).forEach((item) => {
      const diff = item.ts - agora;
      if (diff < 0 || diff > 7 * 24 * 3600 * 1000) return; // só próximos 7 dias
      const tid = setTimeout(async () => {
        const perm = await self.registration.showNotification(
          `💊 ${item.nome}`,
          {
            body: `${item.hora} — ${item.paciente}${item.dose ? " · " + item.dose : ""}`,
            icon: "./icons/icon-192.png",
            badge: "./icons/icon-192.png",
            tag: item.id,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: { remedioId: item.remedioId }
          }
        );
      }, diff);
      agendados.set(item.id, tid);
    });

    // Confirma quantos foram agendados
    event.source && event.source.postMessage({
      type: "NOTIFICACOES_AGENDADAS",
      count: agendados.size
    });
  }

  if (type === "CANCELAR_NOTIFICACOES") {
    agendados.forEach((tid) => clearTimeout(tid));
    agendados.clear();
  }
});

// Clique na notificação — abre o app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow("./");
      }
    })
  );
});
