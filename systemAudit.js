/**
 * core/systemAudit.js — Auditoria Automática de Inicialização
 * Agenda Pro Max — Detecta problemas estruturais ao iniciar o sistema.
 *
 * API pública (global):
 *   runSystemAudit()  → Promise<AuditReport>
 *
 * AuditReport: {
 *   passed:   string[],   // verificações que passaram
 *   warnings: string[],   // problemas não-críticos
 *   critical: string[],   // problemas críticos (sistema pode estar degradado)
 *   ok:       boolean     // true se nenhum crítico foi encontrado
 * }
 *
 * Contrato:
 *   • NUNCA interrompe a execução — todo erro é capturado internamente.
 *   • Usa AppLog para rastreabilidade (com fallback para console).
 *   • Executada após init() + _runMigrations() + checkStateIntegrity().
 *   • Problemas críticos são visíveis no console mesmo sem AppLog.
 */

async function runSystemAudit() {
  'use strict';

  var passed   = [];
  var warnings = [];
  var critical = [];

  // ── Logger com fallback seguro ───────────────────────────────────
  var _L = {
    log:   function (msg) {
      if (typeof AppLog !== 'undefined') AppLog.log('systemAudit.js', msg);
      else console.log('[systemAudit] ' + msg);
    },
    warn:  function (msg) {
      if (typeof AppLog !== 'undefined') AppLog.warn('systemAudit.js', msg);
      else console.warn('[systemAudit] ⚠️  ' + msg);
    },
    error: function (msg) {
      if (typeof AppLog !== 'undefined') AppLog.error('systemAudit.js', msg);
      // Problemas críticos sempre aparecem no console independente do AppLog
      console.error('[systemAudit] 🔴 CRÍTICO: ' + msg);
    }
  };

  // ── Executor de verificação individual ──────────────────────────
  // Isola cada check num try/catch para que uma falha não contamine as demais.
  async function _check(label, fn) {
    try {
      var result = await fn();
      // result: { ok: bool, level?: 'pass'|'warn'|'critical', msg?: string }
      if (!result || result.ok === true) {
        passed.push(label + (result && result.msg ? ': ' + result.msg : ''));
        _L.log('✅ ' + label + (result && result.msg ? ' — ' + result.msg : ''));
      } else if (result.level === 'warn') {
        warnings.push(label + ': ' + (result.msg || 'aviso sem detalhe'));
        _L.warn(label + ' — ' + (result.msg || 'aviso'));
      } else {
        critical.push(label + ': ' + (result.msg || 'erro sem detalhe'));
        _L.error(label + ' — ' + (result.msg || 'falha crítica'));
      }
    } catch (e) {
      critical.push(label + ': exceção inesperada — ' + (e.message || e));
      _L.error(label + ' — exceção: ' + (e.message || e));
    }
  }

  _L.log('──── Auditoria de inicialização iniciada ────');

  // ════════════════════════════════════════════════════════════════
  // 1. LOGGER ATIVO
  // ════════════════════════════════════════════════════════════════
  await _check('Logger (AppLog)', function () {
    if (typeof AppLog === 'undefined') {
      return { ok: false, level: 'critical', msg: 'AppLog não definido — rastreabilidade indisponível' };
    }
    if (typeof AppLog.log !== 'function' || typeof AppLog.warn !== 'function' || typeof AppLog.error !== 'function') {
      return { ok: false, level: 'critical', msg: 'AppLog existe mas API incompleta (faltam métodos)' };
    }
    return { ok: true, msg: 'API completa (log/warn/error disponíveis)' };
  });

  // ════════════════════════════════════════════════════════════════
  // 2. STORAGE FUNCIONA (leitura + escrita no localStorage)
  // ════════════════════════════════════════════════════════════════
  await _check('Storage (localStorage)', function () {
    var TEST_KEY = '__auditProbe__';
    var TEST_VAL = 'audit_' + Date.now();
    try {
      localStorage.setItem(TEST_KEY, TEST_VAL);
      var read = localStorage.getItem(TEST_KEY);
      localStorage.removeItem(TEST_KEY);
      if (read !== TEST_VAL) {
        return { ok: false, level: 'critical', msg: 'Escrita e leitura retornaram valores diferentes' };
      }
    } catch (e) {
      return { ok: false, level: 'critical', msg: 'localStorage inacessível: ' + e.message };
    }
    if (typeof AppStorage === 'undefined') {
      return { ok: false, level: 'critical', msg: 'localStorage ok mas AppStorage não definido' };
    }
    if (typeof AppStorage.saveState !== 'function' || typeof AppStorage.loadState !== 'function') {
      return { ok: false, level: 'critical', msg: 'AppStorage incompleto (faltam saveState/loadState)' };
    }
    return { ok: true, msg: 'localStorage acessível e AppStorage com API completa' };
  });

  // ════════════════════════════════════════════════════════════════
  // 3. STATE CARREGADO E VÁLIDO
  // ════════════════════════════════════════════════════════════════
  await _check('State carregado', function () {
    if (typeof state === 'undefined' || state === null) {
      return { ok: false, level: 'critical', msg: 'state global não definido após init()' };
    }
    if (typeof state !== 'object' || Array.isArray(state)) {
      return { ok: false, level: 'critical', msg: 'state existe mas não é objeto (tipo=' + typeof state + ')' };
    }
    var missing = [];
    if (!Array.isArray(state.consultas))                                          missing.push('consultas');
    if (!state.dateTasks || typeof state.dateTasks !== 'object')                 missing.push('dateTasks');
    if (!state.tasks     || typeof state.tasks     !== 'object')                 missing.push('tasks');
    if (!Array.isArray(state.folders))                                            missing.push('folders');
    if (!Array.isArray(state.remedios))                                           missing.push('remedios');
    if (missing.length > 0) {
      return { ok: false, level: 'critical', msg: 'Campos obrigatórios ausentes ou inválidos: ' + missing.join(', ') };
    }
    var summary = [
      state.consultas.length + ' consulta(s)',
      Object.keys(state.dateTasks).length + ' bucket(s) dateTasks',
      Object.keys(state.tasks).length + ' bucket(s) tasks',
      state.folders.length + ' pasta(s)',
      state.remedios.length + ' remédio(s)'
    ].join(' | ');
    return { ok: true, msg: summary };
  });

  // ════════════════════════════════════════════════════════════════
  // 4. SERVICE WORKER REGISTRADO
  // ════════════════════════════════════════════════════════════════
  await _check('Service Worker', async function () {
    if (!('serviceWorker' in navigator)) {
      return { ok: false, level: 'warn', msg: 'API serviceWorker não suportada neste browser — PWA offline indisponível' };
    }
    try {
      var registrations = await navigator.serviceWorker.getRegistrations();
      if (!registrations || registrations.length === 0) {
        return { ok: false, level: 'warn', msg: 'Nenhum SW registrado ainda (pode ser primeira carga ou modo dev)' };
      }
      var active  = registrations.filter(function (r) { return r.active; }).length;
      var waiting = registrations.filter(function (r) { return r.waiting; }).length;
      var detail  = active + ' ativo(s)' + (waiting ? ', ' + waiting + ' aguardando' : '');
      return { ok: true, msg: detail };
    } catch (e) {
      return { ok: false, level: 'warn', msg: 'Não foi possível consultar registros SW: ' + e.message };
    }
  });

  // ════════════════════════════════════════════════════════════════
  // 5. SYNC DISPONÍVEL (módulo carregado; config é opcional)
  // ════════════════════════════════════════════════════════════════
  await _check('Sync (sync.js)', function () {
    if (typeof initSync !== 'function') {
      return { ok: false, level: 'warn', msg: 'initSync não definido — módulo sync.js pode não ter carregado' };
    }
    if (typeof syncPush !== 'function' || typeof syncPull !== 'function') {
      return { ok: false, level: 'warn', msg: 'initSync existe mas syncPush/syncPull ausentes — módulo incompleto' };
    }
    // Configuração é opt-in — ausência não é erro
    var configured = false;
    try {
      configured = typeof _cfg === 'function' && !!_cfg();
    } catch (e) { /* _cfg pode lançar se chamado fora de escopo */ }
    var detail = configured ? 'configurado e ativo' : 'módulo carregado (Supabase não configurado — opt-in)';
    return { ok: true, msg: detail };
  });

  // ════════════════════════════════════════════════════════════════
  // 6. FILA DE SYNC DISPONÍVEL
  // ════════════════════════════════════════════════════════════════
  await _check('SyncQueue (syncQueue.js)', function () {
    if (typeof SyncQueue === 'undefined') {
      return { ok: false, level: 'warn', msg: 'SyncQueue não definido — operações offline não serão enfileiradas' };
    }
    if (typeof SyncQueue.enqueue !== 'function' || typeof SyncQueue.flush !== 'function') {
      return { ok: false, level: 'warn', msg: 'SyncQueue existe mas API incompleta (faltam enqueue/flush)' };
    }
    var pending = typeof SyncQueue.size === 'function' ? SyncQueue.size() : '?';
    var detail  = 'API completa';
    if (typeof pending === 'number' && pending > 0) {
      detail += ' — ' + pending + ' operação(ões) pendente(s) offline';
    }
    return { ok: true, msg: detail };
  });

  // ════════════════════════════════════════════════════════════════
  // 7. INTEGRIDADE DO STATE (módulo carregado)
  // ════════════════════════════════════════════════════════════════
  await _check('StateIntegrity (stateIntegrity.js)', function () {
    if (typeof checkStateIntegrity !== 'function') {
      return { ok: false, level: 'warn', msg: 'checkStateIntegrity não definido — módulo stateIntegrity.js não carregou' };
    }
    return { ok: true, msg: 'função disponível' };
  });

  // ════════════════════════════════════════════════════════════════
  // 8. ONLINE / OFFLINE
  // ════════════════════════════════════════════════════════════════
  await _check('Conectividade', function () {
    var online = navigator.onLine;
    if (online) {
      return { ok: true, msg: 'dispositivo online' };
    } else {
      // Offline não é erro — app é offline-first
      return { ok: false, level: 'warn', msg: 'dispositivo offline — sync pausado até reconexão' };
    }
  });

  // ════════════════════════════════════════════════════════════════
  // RESUMO FINAL
  // ════════════════════════════════════════════════════════════════
  var ok = critical.length === 0;

  _L.log('──── Auditoria concluída ────');
  _L.log(
    passed.length   + ' OK | ' +
    warnings.length + ' aviso(s) | ' +
    critical.length + ' crítico(s)'
  );

  if (critical.length > 0) {
    _L.error(
      'Sistema iniciou com ' + critical.length + ' problema(s) crítico(s): ' +
      critical.join(' | ')
    );
  }
  if (warnings.length > 0) {
    _L.warn(
      warnings.length + ' aviso(s) não-crítico(s): ' +
      warnings.join(' | ')
    );
  }

  return { ok: ok, passed: passed, warnings: warnings, critical: critical };
}
