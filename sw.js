/* ═══════════════════════════════════════════════════════
Agenda Pro Max — Service Worker v40
   Versão fixa — incrementar manualmente a cada deploy.
   ═══════════════════════════════════════════════════════ */

// Versão fixa. Incrementar ao fazer deploy para forçar atualização do cache.
// Histórico: v33 (2026-03) — corrigido Date.now() por versão estável
//            v34 (2026-03) — força limpeza de cache com caminhos /Agenda-GRS-/ antigos
//            v35 (2026-03) — botão Fechar modal pastas + marcador cal 22px
//            v36 (2026-03) — atualização PWA forçada + JS/CSS em network-first
//            v37 (2026-03) — adiciona catálogo interno de wallpapers
//            v38 (2026-03) — adiciona base de feriados municipais ES e seletor por cidade
//            v39 (2026-03) — alinhamento auto-update total (GitHub + Vercel + PWA)
//            v40 (2026-03) — pwaRescue para recuperar PWA antigo quebrado
const CACHE_VERSION = "v40";
const CACHE_NAME    = "agenda-cache-" + CACHE_VERSION;
// Prefixo usado para identificar caches deste app e limpar apenas os deles
const CACHE_PREFIX  = "agenda-cache-";

// Arquivos essenciais para funcionar offline
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./recover-pwa.html",
  "./manifest.json",
  "./variables.css",
  "./app.css",
  "./state.js",
  "./storage.js",
  "./logger.js",
  "./validators.js",
  "./sanitizer.js",
  "./stateIntegrity.js",
  "./stateManager.js",
  "./syncQueue.js",
  "./systemAudit.js",
  "./agenda.js",
  "./ui.js",
  "./notificacoes.js",
  "./sync.js",
  "./wallpapers.js",
  "./feriadosES.js",
  "./pwaRescue.js",
  "./leo-192.png",
  "./leo-512.png"
];

// ══════════════════════════════════════════════════════
// INSTALL — pré-cacheia assets essenciais
// skipWaiting() garante ativação imediata sem esperar
// abas antigas fecharem
// ══════════════════════════════════════════════════════
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => console.warn("[SW] Falha ao pré-cachear:", err))
  );
});

// ══════════════════════════════════════════════════════
// ACTIVATE — limpa caches antigos deste app automaticamente
// clientsClaim() assume controle de todas as abas abertas
// sem precisar recarregar manualmente
// ══════════════════════════════════════════════════════
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        // Remove apenas caches deste app que não sejam o atual
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => {
          console.log("[SW] Removendo cache antigo:", key);
          return caches.delete(key);
        })
    );

    // Assume controle imediato de todas as abas abertas
    await self.clients.claim();

    // Avisa todas as abas que há nova versão ativa
    // O index.html escuta esta mensagem e exibe banner de atualização
    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    allClients.forEach((client) =>
      client.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION })
    );
  })());
});

// ══════════════════════════════════════════════════════
// FETCH — estratégias por tipo de recurso
// ══════════════════════════════════════════════════════
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ignora não-GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignora rotas internas do Vercel (/_next, /_vercel, etc.)
  if (url.pathname.startsWith("/_")) return;

  // Ignora origens externas (fontes Google, CDN, APIs)
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // ── HTML / navegação → Network First ─────────────────
  // Sempre busca versão nova na rede. Se offline, usa cache.
  if (req.mode === "navigate" || path.endsWith(".html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── manifest.json → Network First ────────────────────
  if (path.endsWith("manifest.json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── Imagens → Cache First ─────────────────────────────
  // Raramente mudam; serve do cache, atualiza em background
  if (/\.(png|jpg|jpeg|webp|svg|ico)$/.test(path)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // ── JS / CSS → Network First ──────────────────────────
  // Evita ficar preso em versão antiga no PWA após hotfix.
  if (/\.(js|css)$/.test(path)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // ── Demais → Network First ────────────────────────────
  event.respondWith(networkFirst(req));
});

// ══════════════════════════════════════════════════════
// ESTRATÉGIAS DE CACHE
// ══════════════════════════════════════════════════════

// Network First: tenta rede, fallback para cache se offline
async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match("./index.html") || await caches.match("./");
      if (fallback) return fallback;
    }
    return new Response("Offline — sem conexão e sem cache.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

// Cache First: cache imediato + atualiza em background
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then((response) => {
      if (response.ok)
        caches.open(CACHE_NAME).then((c) => c.put(request, response));
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

// Stale-While-Revalidate: responde do cache + atualiza fundo
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok)
      caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
    return response;
  }).catch(() => null);
  if (cached) return cached;
  return (await networkPromise) || new Response("", { status: 504, statusText: "Gateway Timeout" });
}

// ══════════════════════════════════════════════════════
// NOTIFICAÇÕES DE REMÉDIO E CONSULTA
// Preservado integralmente — não afeta dados da agenda
// ══════════════════════════════════════════════════════
const agendados = new Map(); // id → timeoutId

self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "AGENDAR_NOTIFICACOES") {
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
            body: `${item.hora} • Abra o app para detalhes`,
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
        const open = clients.find((c) => c.url.includes(self.location.origin));
        if (open) return open.focus();
        return self.clients.openWindow("./");
      })
  );
});
