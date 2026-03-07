/* ═══════════════════════════════════════════════════════
   Agenda Pro Max — Service Worker v6
   Estratégia: atualização automática garantida
   ═══════════════════════════════════════════════════════ */

// ── VERSÃO: mude aqui a cada deploy para forçar novo SW ──
const SW_VERSION = "v6";
const CACHE_NAME  = "agenda-cache-" + SW_VERSION;

// Arquivos essenciais para funcionar offline
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./leo-192.png",
  "./leo-512.png"
];

// ══════════════════════════════════════════════════════
// INSTALL — pré-cacheia assets principais
// skipWaiting() garante que o novo SW ativa IMEDIATAMENTE
// sem esperar as abas antigas fecharem
// ══════════════════════════════════════════════════════
self.addEventListener("install", (event) => {
  self.skipWaiting(); // ← força ativação imediata

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_ASSETS)
    ).catch((err) => {
      console.warn("[SW] Falha ao pré-cachear:", err);
    })
  );
});

// ══════════════════════════════════════════════════════
// ACTIVATE — limpa todos os caches antigos
// clientsClaim() assume controle de TODAS as abas abertas
// sem precisar recarregar
// ══════════════════════════════════════════════════════
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // 1. Remover todos os caches que não sejam o atual
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => {
          console.log("[SW] Removendo cache antigo:", key);
          return caches.delete(key);
        })
    );

    // 2. Assumir controle imediato de todas as abas
    await self.clients.claim(); // ← sem precisar recarregar

    // 3. Avisar todas as abas que há nova versão disponível
    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    allClients.forEach((client) =>
      client.postMessage({ type: "SW_UPDATED", version: SW_VERSION })
    );
  })());
});

// ══════════════════════════════════════════════════════
// FETCH — estratégias por tipo de recurso
// ══════════════════════════════════════════════════════
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ignora não-GET e origens externas
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // ── HTML (navigate) → Network First ──────────────────
  // Sempre tenta buscar versão nova. Se offline, usa cache.
  if (req.mode === "navigate" || path.endsWith(".html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── manifest.json → Network First ────────────────────
  if (path.endsWith("manifest.json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── Imagens (png/jpg/webp/svg) → Cache First ─────────
  // Raramente mudam; serve do cache, atualiza em background
  if (/\.(png|jpg|jpeg|webp|svg|ico)$/.test(path)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // ── JS / CSS → Stale-While-Revalidate ────────────────
  // Serve cache imediatamente, atualiza em background
  if (/\.(js|css)$/.test(path)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // ── Demais recursos → Network First ──────────────────
  event.respondWith(networkFirst(req));
});

// ══════════════════════════════════════════════════════
// ESTRATÉGIAS DE CACHE
// ══════════════════════════════════════════════════════

// Network First: tenta rede, fallback para cache
async function networkFirst(request) {
  try {
    const response = await fetch(request, {
      cache: "no-store",  // ← nunca usa cache HTTP do browser
    });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback para raiz se for navegação
    if (request.mode === "navigate") {
      const fallback = await caches.match("./");
      if (fallback) return fallback;
    }
    return new Response("Offline — sem conexão e sem cache.", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

// Cache First: serve do cache, atualiza em background
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Atualiza cache em background sem bloquear resposta
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((c) => c.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 404 });
  }
}

// Stale-While-Revalidate: cache imediato + atualiza fundo
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || networkPromise;
}

// ══════════════════════════════════════════════════════
// NOTIFICAÇÕES DE REMÉDIO E CONSULTA
// ══════════════════════════════════════════════════════
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

      const isConsulta = item.tipo === "consulta";
      const tid = setTimeout(async () => {
        await self.registration.showNotification(
          isConsulta ? `🏥 ${item.nome}` : `💊 ${item.nome}`,
          {
            body: `${item.hora}${item.paciente ? " — " + item.paciente : ""}${item.dose ? " · " + item.dose : ""}`,
            icon: "./leo-192.png",
            badge: "./leo-192.png",
            tag: item.id,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: { id: item.id, tipo: item.tipo || "remedio" }
          }
        );
      }, diff);
      agendados.set(item.id, tid);
    });

    event.source?.postMessage({
      type: "NOTIFICACOES_AGENDADAS",
      count: agendados.size
    });
  }

  if (type === "CANCELAR_NOTIFICACOES") {
    agendados.forEach((tid) => clearTimeout(tid));
    agendados.clear();
  }
});

// Clique na notificação → abre/foca o app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const openClient = clients.find((c) => c.url.includes(self.location.origin));
        if (openClient) return openClient.focus();
        return self.clients.openWindow("./");
      })
  );
});
