/* ═══════════════════════════════════════════════════════════════════
   Agenda Pro Max — sync.js  v2.0
   Sincronização Supabase com tabelas separadas por domínio.

   Princípios:
     • Offline-first  — o app funciona 100% sem este módulo.
     • Não-bloqueante — toda operação é async + try/catch silencioso.
     • Opt-in         — sem config = no-op total.
     • Last-write-wins — conflitos resolvidos por updated_at.
   ═══════════════════════════════════════════════════════════════════

   SCHEMA SUPABASE — rodar no SQL Editor do projeto:
   ─────────────────────────────────────────────────
   -- 1. Tarefas (tasks, dateTasks, folders)
   CREATE TABLE IF NOT EXISTS tasks (
     id          text    NOT NULL,
     data        text    NOT NULL,
     updated_at  bigint  NOT NULL,
     device_id   text    NOT NULL,
     payload     jsonb   NOT NULL,
     deleted     boolean NOT NULL DEFAULT false,
     PRIMARY KEY (id, data)
   );
   CREATE INDEX IF NOT EXISTS tasks_sync_idx ON tasks (device_id, updated_at);

   -- 2. Consultas médicas
   CREATE TABLE IF NOT EXISTS consultas (
     id          text    PRIMARY KEY,
     data        text    NOT NULL,
     updated_at  bigint  NOT NULL,
     device_id   text    NOT NULL,
     payload     jsonb   NOT NULL,
     deleted     boolean NOT NULL DEFAULT false
   );
   CREATE INDEX IF NOT EXISTS consultas_sync_idx ON consultas (device_id, updated_at);

   -- 3. Remédios
   CREATE TABLE IF NOT EXISTS remedios (
     id          text    PRIMARY KEY,
     data        text    NOT NULL,
     updated_at  bigint  NOT NULL,
     device_id   text    NOT NULL,
     payload     jsonb   NOT NULL,
     deleted     boolean NOT NULL DEFAULT false
   );
   CREATE INDEX IF NOT EXISTS remedios_sync_idx ON remedios (device_id, updated_at);
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────────────────────────
// 1. CONFIGURAÇÃO
// ──────────────────────────────────────────────────────────────────
const SYNC_CONFIG_KEY = 'agendaProMax_syncConfig';
const SYNC_CURSOR_KEY = 'agendaProMax_syncCursor';
const SYNC_DEVICE_KEY = 'agendaProMax_deviceId';

function _cfg() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return (c.url && c.anonKey) ? c : null;
  } catch { return null; }
}

function setSyncConfig(cfg) {
  try {
    if (!cfg) localStorage.removeItem(SYNC_CONFIG_KEY);
    else      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) { console.warn('[Sync] setSyncConfig:', e); }
}

function _deviceId() {
  let id = localStorage.getItem(SYNC_DEVICE_KEY);
  if (!id) {
    id = _uuid();
    try { localStorage.setItem(SYNC_DEVICE_KEY, id); } catch {}
  }
  return id;
}

// ──────────────────────────────────────────────────────────────────
// 2. UTILITÁRIOS
// ──────────────────────────────────────────────────────────────────

function _uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Adiciona campos de sync a um item NOVO antes de salvar no state.
 * Substitui o uso de uid() na criação de tasks, consultas, remédios, folders.
 */
function ensureSyncFields(item) {
  if (!item) return item;
  if (!item.id)        item.id        = _uuid();
  if (!item.updatedAt) item.updatedAt = Date.now();
  if (item.synced === undefined) item.synced = false;
  return item;
}

/**
 * Marca um item como modificado localmente (pending sync).
 * Chame em TODA edição: toggle done, editar texto, editar campos.
 */
function markDirty(item) {
  if (!item) return item;
  item.updatedAt = Date.now();
  item.synced    = false;
  return item;
}

// ──────────────────────────────────────────────────────────────────
// 3. CAMADA HTTP
// ──────────────────────────────────────────────────────────────────

async function _req(method, table, body, params) {
  const c = _cfg();
  if (!c) throw new Error('Sync não configurado');

  const url = new URL(`${c.url}/rest/v1/${table}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = {
    'apikey':        c.anonKey,
    'Authorization': 'Bearer ' + c.anonKey,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation,resolution=merge-duplicates',
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${method} ${table}: ${txt}`);
  }

  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

// ──────────────────────────────────────────────────────────────────
// 4. CURSORES (lastSyncTimestamp por tabela)
// ──────────────────────────────────────────────────────────────────

function _getCursors() {
  try {
    const raw = localStorage.getItem(SYNC_CURSOR_KEY);
    return raw ? JSON.parse(raw) : { tasks: 0, consultas: 0, remedios: 0 };
  } catch { return { tasks: 0, consultas: 0, remedios: 0 }; }
}

function _setCursor(table, ts) {
  try {
    const c = _getCursors();
    c[table] = ts;
    localStorage.setItem(SYNC_CURSOR_KEY, JSON.stringify(c));
  } catch {}
}

// ──────────────────────────────────────────────────────────────────
// 5. syncPush() — envia itens locais com synced=false
// ──────────────────────────────────────────────────────────────────

async function syncPush(state, save) {
  if (!_cfg() || !navigator.onLine) return { pushed: 0 };

  const devId = _deviceId();
  let pushed = 0;

  // ── tasks (buckets semanais + dateTasks + folders) ────────────
  const dirtyTasks = [];

  const _collectArr = (arr, bucketId) => {
    (arr || []).forEach(item => {
      if (item && item.id && item.synced === false)
        dirtyTasks.push({ item, bucketId });
    });
  };

  if (state.tasks) {
    Object.entries(state.tasks).forEach(([bid, arr]) => _collectArr(arr, bid));
  }
  if (state.dateTasks) {
    Object.entries(state.dateTasks).forEach(([date, arr]) => _collectArr(arr, date));
  }
  (state.folders || []).forEach(f => {
    if (f && f.id && f.synced === false)
      dirtyTasks.push({ item: f, bucketId: '__folders__' });
  });

  if (dirtyTasks.length > 0) {
    const rows = dirtyTasks.map(({ item, bucketId }) => ({
      id:         item.id,
      data:       bucketId,
      updated_at: item.updatedAt || Date.now(),
      device_id:  devId,
      payload:    item,
      deleted:    false,
    }));
    await _req('POST', 'tasks', rows);
    dirtyTasks.forEach(({ item }) => { item.synced = true; });
    pushed += dirtyTasks.length;
  }

  // ── consultas ─────────────────────────────────────────────────
  const dirtyConsultas = (state.consultas || []).filter(c => c && c.id && c.synced === false);
  if (dirtyConsultas.length > 0) {
    const rows = dirtyConsultas.map(c => ({
      id:         c.id,
      data:       c.data || '',
      updated_at: c.updatedAt || Date.now(),
      device_id:  devId,
      payload:    c,
      deleted:    false,
    }));
    await _req('POST', 'consultas', rows);
    dirtyConsultas.forEach(c => { c.synced = true; });
    pushed += dirtyConsultas.length;
  }

  // ── remedios ──────────────────────────────────────────────────
  const dirtyRemedios = (state.remedios || []).filter(r => r && r.id && r.synced === false);
  if (dirtyRemedios.length > 0) {
    const rows = dirtyRemedios.map(r => ({
      id:         r.id,
      data:       r.data || '',
      updated_at: r.updatedAt || Date.now(),
      device_id:  devId,
      payload:    r,
      deleted:    false,
    }));
    await _req('POST', 'remedios', rows);
    dirtyRemedios.forEach(r => { r.synced = true; });
    pushed += dirtyRemedios.length;
  }

  if (pushed > 0) {
    try { save(); } catch {}
    console.info(`[Sync] Push: ${pushed} item(s)`);
  }
  return { pushed };
}

// ──────────────────────────────────────────────────────────────────
// 6. syncPull() — busca itens modificados após lastSyncTimestamp
// ──────────────────────────────────────────────────────────────────

async function syncPull(state, save, render) {
  if (!_cfg() || !navigator.onLine) return { pulled: 0, merged: 0 };

  const cursors = _getCursors();
  let pulled = 0, merged = 0;

  // ── tasks ─────────────────────────────────────────────────────
  {
    const rows = await _req('GET', 'tasks', null, {
      'updated_at': `gt.${cursors.tasks}`,
      'order':      'updated_at.asc',
      'limit':      '1000',
    });

    let maxTs = cursors.tasks;
    rows.forEach(row => {
      if (!row.id) return;
      pulled++;
      if (row.updated_at > maxTs) maxTs = row.updated_at;

      const remote   = row.payload || {};
      const bucketId = row.data;
      const remoteTs = row.updated_at || 0;

      // Soft-delete
      if (row.deleted) {
        _removeTask(state, bucketId, row.id);
        merged++;
        return;
      }

      // Folder
      if (bucketId === '__folders__') {
        const local = (state.folders || []).find(f => f.id === row.id);
        if (!local || remoteTs > (local.updatedAt || 0)) {
          remote.synced = true;
          _upsertFolder(state, remote);
          merged++;
        }
        return;
      }

      // Task normal
      const arr   = _getTaskArr(state, bucketId);
      const local = arr.find(t => t.id === row.id);
      if (!local || remoteTs > (local.updatedAt || 0)) {
        remote.synced = true;
        _upsertTask(state, bucketId, remote);
        merged++;
      }
    });

    _setCursor('tasks', maxTs);
  }

  // ── consultas ─────────────────────────────────────────────────
  {
    const rows = await _req('GET', 'consultas', null, {
      'updated_at': `gt.${cursors.consultas}`,
      'order':      'updated_at.asc',
      'limit':      '500',
    });

    let maxTs = cursors.consultas;
    rows.forEach(row => {
      if (!row.id) return;
      pulled++;
      if (row.updated_at > maxTs) maxTs = row.updated_at;
      const remote   = row.payload || {};
      const remoteTs = row.updated_at || 0;

      if (row.deleted) {
        state.consultas = (state.consultas || []).filter(c => c.id !== row.id);
        merged++;
        return;
      }

      const local = (state.consultas || []).find(c => c.id === row.id);
      if (!local || remoteTs > (local.updatedAt || 0)) {
        remote.synced = true;
        if (!state.consultas) state.consultas = [];
        const idx = state.consultas.findIndex(c => c.id === row.id);
        if (idx >= 0) state.consultas[idx] = remote;
        else          state.consultas.push(remote);
        merged++;
      }
    });

    _setCursor('consultas', maxTs);
  }

  // ── remedios ──────────────────────────────────────────────────
  {
    const rows = await _req('GET', 'remedios', null, {
      'updated_at': `gt.${cursors.remedios}`,
      'order':      'updated_at.asc',
      'limit':      '500',
    });

    let maxTs = cursors.remedios;
    rows.forEach(row => {
      if (!row.id) return;
      pulled++;
      if (row.updated_at > maxTs) maxTs = row.updated_at;
      const remote   = row.payload || {};
      const remoteTs = row.updated_at || 0;

      if (row.deleted) {
        state.remedios = (state.remedios || []).filter(r => r.id !== row.id);
        merged++;
        return;
      }

      const local = (state.remedios || []).find(r => r.id === row.id);
      if (!local || remoteTs > (local.updatedAt || 0)) {
        remote.synced = true;
        if (!state.remedios) state.remedios = [];
        const idx = state.remedios.findIndex(r => r.id === row.id);
        if (idx >= 0) state.remedios[idx] = remote;
        else          state.remedios.push(remote);
        merged++;
      }
    });

    _setCursor('remedios', maxTs);
  }

  if (merged > 0) {
    try { save(); } catch {}
    try { if (typeof render === 'function') render(); } catch {}
    console.info(`[Sync] Pull: ${pulled} recebidos, ${merged} mergeados`);
  }

  return { pulled, merged };
}

// ──────────────────────────────────────────────────────────────────
// 7. HELPERS INTERNOS
// ──────────────────────────────────────────────────────────────────

function _getTaskArr(state, bucketId) {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(bucketId);
  if (isDate) {
    if (!state.dateTasks)           state.dateTasks = {};
    if (!state.dateTasks[bucketId]) state.dateTasks[bucketId] = [];
    return state.dateTasks[bucketId];
  }
  if (!state.tasks)           state.tasks = {};
  if (!state.tasks[bucketId]) state.tasks[bucketId] = [];
  return state.tasks[bucketId];
}

function _upsertTask(state, bucketId, item) {
  const arr = _getTaskArr(state, bucketId);
  const idx = arr.findIndex(t => t.id === item.id);
  if (idx >= 0) arr[idx] = item;
  else          arr.push(item);
}

function _removeTask(state, bucketId, id) {
  const arr = _getTaskArr(state, bucketId);
  const idx = arr.findIndex(t => t.id === id);
  if (idx >= 0) arr.splice(idx, 1);
}

function _upsertFolder(state, item) {
  if (!state.folders) state.folders = [];
  const idx = state.folders.findIndex(f => f.id === item.id);
  if (idx >= 0) state.folders[idx] = item;
  else          state.folders.push(item);
}

// ──────────────────────────────────────────────────────────────────
// 8. initSync() — orquestrador
// ──────────────────────────────────────────────────────────────────

let _syncBusy = false;

/**
 * Executa pull → push de forma segura (mutex simples).
 *
 * Quando chamar:
 *   1. Após _runMigrations(state) no boot
 *   2. No evento window 'online'
 *   3. setInterval a cada 5 min
 */
async function initSync(state, save, render) {
  if (!_cfg())            return;
  if (!navigator.onLine)  return;
  if (_syncBusy)           return;

  _syncBusy = true;
  try {
    await syncPull(state, save, render);
    await syncPush(state, save);
  } catch (err) {
    console.warn('[Sync] initSync error:', err.message || err);
  } finally {
    _syncBusy = false;
  }
}

// ──────────────────────────────────────────────────────────────────
// 9. syncDelete() — soft-delete no servidor
// ──────────────────────────────────────────────────────────────────

/**
 * Marca um item como deletado no servidor.
 * Chame APÓS remover do state local e chamar save().
 *
 * @param {'tasks'|'consultas'|'remedios'} table
 * @param {string} id
 * @param {string} [bucketId] — necessário para table='tasks'
 */
async function syncDelete(table, id, bucketId = '') {
  if (!_cfg() || !navigator.onLine) return;
  try {
    await _req('POST', table, [{
      id,
      data:       bucketId,
      updated_at: Date.now(),
      device_id:  _deviceId(),
      payload:    { id },
      deleted:    true,
    }]);
  } catch (err) {
    console.warn('[Sync] syncDelete:', err.message);
  }
}

// ──────────────────────────────────────────────────────────────────
// 10. PAINEL DE CONFIGURAÇÃO
// ──────────────────────────────────────────────────────────────────

function abrirPainelSync() {
  const existing = document.getElementById('_syncModal');
  if (existing) { existing.remove(); return; }

  const cfg   = _cfg();
  const devId = _deviceId();

  const ov = document.createElement('div');
  ov.id = '_syncModal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:Plus Jakarta Sans,sans-serif;padding:16px;';

  const connected  = !!cfg;
  const dotColor   = connected ? '#34d399' : '#78716c';
  const statusText = connected ? '● Conectado' : '○ Desconectado';

  ov.innerHTML = `
    <div style="background:#1c1917;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:26px 22px;width:min(400px,100%);box-shadow:0 24px 60px rgba(0,0,0,.6);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
        <h2 style="margin:0;font-size:17px;color:#f5f5f4;font-weight:800;">☁️ Sincronização</h2>
        <span style="font-size:11px;font-weight:700;color:${dotColor}">${statusText}</span>
      </div>
      <p style="margin:0 0 18px;font-size:12px;color:#78716c;line-height:1.5;">
        Sync entre dispositivos via Supabase. O app funciona offline normalmente.
      </p>

      <label style="display:block;margin-bottom:10px;">
        <span style="font-size:10px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:.5px;">URL do Projeto</span>
        <input id="_sUrl" type="url" placeholder="https://xxxx.supabase.co" value="${cfg?.url || ''}"
          style="width:100%;box-sizing:border-box;margin-top:5px;padding:9px 11px;background:#292524;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f5f5f4;font-size:13px;outline:none;"/>
      </label>

      <label style="display:block;margin-bottom:18px;">
        <span style="font-size:10px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:.5px;">Anon Key</span>
        <input id="_sKey" type="password" placeholder="eyJhbGciOiJIUzI1NiIs…" value="${cfg?.anonKey || ''}"
          style="width:100%;box-sizing:border-box;margin-top:5px;padding:9px 11px;background:#292524;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f5f5f4;font-size:13px;outline:none;"/>
      </label>

      <p style="margin:0 0 16px;font-size:11px;color:#44403c;">
        Device ID: <span style="font-size:10px;color:#78716c;font-family:monospace;">${devId.slice(0,20)}…</span>
      </p>

      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        ${connected ? `<button id="_sDisco" style="padding:9px 13px;border-radius:8px;border:1px solid rgba(239,68,68,.4);background:transparent;color:#f87171;font-size:12px;font-weight:700;cursor:pointer;">Desconectar</button>` : ''}
        <button id="_sCancel" style="padding:9px 13px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#a8a29e;font-size:12px;cursor:pointer;">Cancelar</button>
        <button id="_sSave" style="padding:9px 15px;border-radius:8px;border:none;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">Salvar e Sincronizar</button>
      </div>

      <p id="_sStatus" style="margin:11px 0 0;font-size:11px;color:#78716c;text-align:center;min-height:15px;"></p>
    </div>`;

  const setStatus = (msg, color = '#78716c') => {
    const el = ov.querySelector('#_sStatus');
    if (el) { el.textContent = msg; el.style.color = color; }
  };

  ov.querySelector('#_sCancel').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

  if (connected) {
    ov.querySelector('#_sDisco').addEventListener('click', () => {
      setSyncConfig(null);
      localStorage.removeItem(SYNC_CURSOR_KEY);
      ov.remove();
      if (typeof showToast === 'function') showToast('🔌 Sync desconectado');
    });
  }

  ov.querySelector('#_sSave').addEventListener('click', async () => {
    const url     = ov.querySelector('#_sUrl').value.trim().replace(/\/$/, '');
    const anonKey = ov.querySelector('#_sKey').value.trim();
    if (!url || !anonKey) { setStatus('Preencha URL e Anon Key.', '#f87171'); return; }

    setSyncConfig({ url, anonKey });
    setStatus('Verificando conexão…', '#60a5fa');

    try {
      await _req('GET', 'tasks', null, { limit: '1' });
      setStatus('✅ Conectado! Sincronizando…', '#34d399');
      if (typeof state !== 'undefined' && typeof save === 'function') {
        await initSync(state, save, typeof render === 'function' ? render : undefined);
      }
      setTimeout(() => {
        ov.remove();
        if (typeof showToast === 'function') showToast('☁️ Sync ativado!');
      }, 900);
    } catch (err) {
      setStatus('❌ ' + (err.message || 'Erro de conexão'), '#f87171');
    }
  });

  document.body.appendChild(ov);
  setTimeout(() => ov.querySelector('#_sUrl').focus(), 60);
}
