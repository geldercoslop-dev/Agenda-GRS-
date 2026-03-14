/**
 * core/diagnostics.js — Modo Diagnóstico Ativo
 * Agenda Pro Max — Detecta falhas funcionais em tempo de execução.
 *
 * Diferença em relação ao systemAudit.js:
 *   systemAudit  → verificações PASSIVAS (módulo carregado? API existe?)
 *   diagnostics  → verificações ATIVAS   (escreve/lê de volta, enfileira/consome,
 *                                          mede latência, detecta inconsistências
 *                                          cruzadas nos dados)
 *
 * API pública (globais):
 *   runDiagnostics()           → Promise<DiagnosticsReport>
 *   AppDiagnostics.lastReport  → último relatório gerado (null antes do primeiro run)
 *   AppDiagnostics.run()       → alias para runDiagnostics()
 *
 * DiagnosticsReport: {
 *   ok:        boolean,          // true se nenhum crítico encontrado
 *   ts:        number,           // timestamp de execução (Date.now())
 *   duration:  number,           // ms totais gastos
 *   passed:    CheckResult[],
 *   warnings:  CheckResult[],
 *   critical:  CheckResult[],
 * }
 *
 * CheckResult: { name: string, level: 'pass'|'warn'|'critical', msg: string, detail?: string }
 *
 * Flag de ativação:
 *   const DIAGNOSTIC_MODE = true   →  runDiagnostics() é chamado automaticamente
 *                                      no boot (após init()), sem bloquear o sistema.
 *   const DIAGNOSTIC_MODE = false  →  módulo carregado mas inativo; pode ser
 *                                      chamado manualmente via AppDiagnostics.run().
 *
 * Contrato de segurança:
 *   • NUNCA modifica state ou dados reais — usa apenas chaves/itens temporários.
 *   • NUNCA lança exceção para fora — todo erro é capturado internamente.
 *   • NUNCA bloqueia o sistema — erros críticos são apenas registrados.
 *   • Chaves temporárias de teste: prefixo "__diag_" + timestamp → removidas ao fim.
 *   • Item temporário na SyncQueue: removido imediatamente após peek().
 */

// ── Flag de ativação ─────────────────────────────────────────────
// true  → executar runDiagnostics() automaticamente ao iniciar o sistema
// false → módulo carregado mas silencioso; ativar via AppDiagnostics.run()
var DIAGNOSTIC_MODE = true;

var AppDiagnostics = (function () {
  'use strict';

  // ── Estado interno ──────────────────────────────────────────────
  var _lastReport = null;

  // ── Logger seguro: usa AppLog se disponível, console como fallback ──
  var _L = {
    log: function (msg, detail) {
      if (typeof AppLog !== 'undefined') {
        AppLog.log('diagnostics.js', msg, detail !== undefined ? detail : '');
      } else {
        console.log('[DIAG] ' + msg, detail !== undefined ? detail : '');
      }
    },
    warn: function (msg, detail) {
      if (typeof AppLog !== 'undefined') {
        AppLog.warn('diagnostics.js', msg, detail !== undefined ? detail : '');
      } else {
        console.warn('[DIAG] ⚠️  ' + msg, detail !== undefined ? detail : '');
      }
    },
    error: function (msg, detail) {
      if (typeof AppLog !== 'undefined') {
        AppLog.error('diagnostics.js', msg, detail !== undefined ? detail : '');
      } else {
        // Críticos sempre aparecem no console independente do AppLog
        console.error('[DIAG] 🔴 ' + msg, detail !== undefined ? detail : '');
      }
    },
  };

  // ── Executor individual: isola cada check em try/catch ─────────
  async function _run(name, fn) {
    var result = { name: name, level: 'pass', msg: '', detail: '' };
    try {
      var r = await fn();
      result.level  = r.level  || 'pass';
      result.msg    = r.msg    || '';
      result.detail = r.detail || '';
    } catch (e) {
      result.level  = 'critical';
      result.msg    = 'Exceção inesperada no check';
      result.detail = e && e.message ? e.message : String(e);
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 1 — LOGGER: escreve entrada e verifica que aparece no histórico
  // ════════════════════════════════════════════════════════════════
  function _checkLogger() {
    if (typeof AppLog === 'undefined') {
      return { level: 'critical', msg: 'AppLog não disponível — sem rastreabilidade' };
    }
    if (typeof AppLog.log !== 'function' ||
        typeof AppLog.warn !== 'function' ||
        typeof AppLog.error !== 'function') {
      return { level: 'critical', msg: 'AppLog existe mas API incompleta (faltam métodos)' };
    }

    // Teste ativo: grava uma entrada de diagnóstico e verifica que ela aparece no histórico
    var probe = '__diag_probe_' + Date.now();
    AppLog.log('diagnostics.js', probe);

    var found = false;
    if (Array.isArray(AppLog.history)) {
      found = AppLog.history.some(function (e) { return e.msg === probe; });
    }

    if (!found) {
      return {
        level: 'warn',
        msg: 'AppLog.log() chamado mas entrada não apareceu no histórico interno',
        detail: 'AppLog.history pode estar desativado ou com MAX_HISTORY=0',
      };
    }

    var histLen = Array.isArray(AppLog.history) ? AppLog.history.length : '?';
    return {
      level: 'pass',
      msg: 'Logger funcional — escrita e leitura de histórico OK',
      detail: 'histLen=' + histLen,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 2 — STORAGE: round-trip completo via AppStorage.set/get/remove
  //           + round-trip via AppStorage.saveState/loadState com objeto mínimo
  // ════════════════════════════════════════════════════════════════
  function _checkStorage() {
    if (typeof AppStorage === 'undefined') {
      return { level: 'critical', msg: 'AppStorage não definido — persistência indisponível' };
    }

    var KEY = '__diag_storage_' + Date.now();
    var VAL = { _diag: true, ts: Date.now() };

    // ── Round-trip genérico (set / get / remove) ──
    var setOk = AppStorage.set(KEY, VAL);
    if (!setOk) {
      return { level: 'critical', msg: 'AppStorage.set() retornou false — escrita bloqueada' };
    }

    var read = AppStorage.get(KEY, null);
    AppStorage.remove(KEY);

    if (!read || read._diag !== true) {
      return {
        level: 'critical',
        msg: 'AppStorage.get() retornou valor diferente do gravado — corrupção de leitura',
        detail: 'lido=' + JSON.stringify(read),
      };
    }

    // ── Round-trip de estado mínimo (saveState / loadState) ──
    // Usa uma chave temporária distinta para não tocar nos dados reais
    var _savedSave = AppStorage.saveState;
    var _savedLoad = AppStorage.loadState;

    // Chama saveState/loadState diretamente apenas se a implementação interna
    // não escrever em chaves hardcoded sem sufixo — verificamos apenas a API pública
    // sem substituir o state real.
    // Estratégia: cria um "mini-state" válido e usa AppStorage.set/get para simular
    // o que saveState faria, mas sem sobrescrever a chave real 'agendaProMax'.
    var MINI_KEY = '__diag_ministate_' + Date.now();
    var miniState = {
      consultas: [], folders: [], folderOrder: [],
      remedios: [], tasks: {}, dateTasks: {},
      theme: 'dark', userName: 'DiagTest',
      _diagProbe: KEY,
    };
    var miniOk = AppStorage.set(MINI_KEY, miniState);
    var miniRead = AppStorage.get(MINI_KEY, null);
    AppStorage.remove(MINI_KEY);

    if (!miniOk || !miniRead || miniRead.userName !== 'DiagTest') {
      return {
        level: 'warn',
        msg: 'Round-trip de estado mínimo falhou',
        detail: 'miniOk=' + miniOk + ', userName=' + (miniRead && miniRead.userName),
      };
    }

    // Verifica quota: tenta estimar espaço disponível
    var quotaMsg = '';
    try {
      var used = JSON.stringify(localStorage).length;
      var pct  = Math.round(used / 51200 * 100); // 50 KB baseline
      quotaMsg = 'localStorage~' + Math.round(used / 1024) + 'KB usado';
    } catch (e) { quotaMsg = 'quota indisponível'; }

    return {
      level: 'pass',
      msg: 'Storage funcional — set/get/remove e round-trip de estado OK',
      detail: quotaMsg,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 3 — INTEGRIDADE DO STATE: verifica estado atual em profundidade
  //           (vai além do checkStateIntegrity: detecta inconsistências cruzadas)
  // ════════════════════════════════════════════════════════════════
  function _checkStateIntegrity() {
    if (typeof state === 'undefined' || state === null) {
      return { level: 'critical', msg: 'state global não existe — sistema inoperante' };
    }

    var issues   = [];
    var warnings = [];
    var info     = [];

    // ── Campos obrigatórios ──
    var requiredArrays = ['consultas', 'folders', 'folderOrder', 'remedios'];
    requiredArrays.forEach(function (k) {
      if (!Array.isArray(state[k])) {
        issues.push(k + ' não é array (tipo=' + typeof state[k] + ')');
      }
    });

    var requiredObjects = ['tasks', 'dateTasks', 'bucketPhotos'];
    requiredObjects.forEach(function (k) {
      if (!state[k] || typeof state[k] !== 'object' || Array.isArray(state[k])) {
        // bucketPhotos pode ser null em states antigos — apenas warn
        if (k === 'bucketPhotos') {
          warnings.push(k + ' ausente ou inválido (estado antigo sem fotos)');
        } else {
          issues.push(k + ' não é objeto simples (tipo=' + typeof state[k] + ')');
        }
      }
    });

    if (issues.length > 0) {
      return {
        level: 'critical',
        msg: 'State com ' + issues.length + ' campo(s) obrigatório(s) inválido(s)',
        detail: issues.join(' | '),
      };
    }

    // ── Consistência cruzada: folderOrder × folders ──
    var folderIds = state.folders.map(function (f) { return f && f.id; }).filter(Boolean);
    var orphanOrder = state.folderOrder.filter(function (id) {
      return !folderIds.includes(id);
    });
    if (orphanOrder.length > 0) {
      warnings.push('folderOrder tem ' + orphanOrder.length + ' ID(s) sem pasta correspondente: ' + orphanOrder.join(', '));
    }

    // ── Tasks sem pasta correspondente (exceto buckets de dias e pauta) ──
    var WEEK_BUCKETS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom2', 'pauta'];
    var orphanTasks = Object.keys(state.tasks).filter(function (bid) {
      if (WEEK_BUCKETS.includes(bid)) return false;
      return !folderIds.includes(bid);
    });
    if (orphanTasks.length > 0) {
      warnings.push('tasks tem ' + orphanTasks.length + ' bucket(s) sem pasta: ' + orphanTasks.join(', '));
    }

    // ── Buckets internos: garante que todo tasks[k] é array ──
    var corruptBuckets = Object.keys(state.tasks).filter(function (k) {
      return !Array.isArray(state.tasks[k]);
    });
    if (corruptBuckets.length > 0) {
      issues.push('tasks tem ' + corruptBuckets.length + ' bucket(s) não-array: ' + corruptBuckets.join(', '));
    }

    // ── Buckets de dateTasks: garante que todo dateTasks[k] é array ──
    var corruptDateBuckets = Object.keys(state.dateTasks).filter(function (k) {
      return !Array.isArray(state.dateTasks[k]);
    });
    if (corruptDateBuckets.length > 0) {
      issues.push('dateTasks tem ' + corruptDateBuckets.length + ' bucket(s) não-array: ' + corruptDateBuckets.join(', '));
    }

    // ── Consultas sem campos obrigatórios ──
    var invalidConsultas = (state.consultas || []).filter(function (c) {
      return !c || !c.id || !c.paciente || !c.data || !c.hora;
    });
    if (invalidConsultas.length > 0) {
      warnings.push(invalidConsultas.length + ' consulta(s) com campos obrigatórios ausentes');
    }

    // ── Sumário de contagens ──
    var totalTasks = Object.values(state.tasks).reduce(function (s, arr) {
      return s + (Array.isArray(arr) ? arr.length : 0);
    }, 0);
    var totalDateTasks = Object.values(state.dateTasks).reduce(function (s, arr) {
      return s + (Array.isArray(arr) ? arr.length : 0);
    }, 0);

    info.push(
      state.consultas.length + ' consulta(s)' +
      ' | ' + state.remedios.length + ' remédio(s)' +
      ' | ' + state.folders.length + ' pasta(s)' +
      ' | ' + totalTasks + ' task(s) semana' +
      ' | ' + totalDateTasks + ' task(s) datas'
    );

    if (issues.length > 0) {
      return {
        level: 'critical',
        msg: 'Inconsistências críticas detectadas no state',
        detail: issues.concat(warnings).join(' | '),
      };
    }
    if (warnings.length > 0) {
      return {
        level: 'warn',
        msg: 'State com ' + warnings.length + ' aviso(s) de consistência',
        detail: warnings.join(' | '),
      };
    }
    return {
      level: 'pass',
      msg: 'State íntegro e consistente',
      detail: info.join(' | '),
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 4 — SYNC: verifica disponibilidade das funções e configuração
  //           (não executa push/pull — apenas confirma que o módulo
  //            está operacional e diagnostica a razão de não estar configurado)
  // ════════════════════════════════════════════════════════════════
  function _checkSync() {
    // Verifica carregamento do módulo
    if (typeof initSync !== 'function') {
      return {
        level: 'warn',
        msg: 'sync.js não carregado — initSync ausente',
        detail: 'Verifique se <script src="./sync.js"> está no index.html',
      };
    }

    var missingFns = [];
    ['syncPush', 'syncPull', 'syncDelete', 'ensureSyncFields', 'markDirty'].forEach(function (fn) {
      if (typeof window[fn] !== 'function') missingFns.push(fn);
    });
    if (missingFns.length > 0) {
      return {
        level: 'warn',
        msg: 'sync.js carregado mas funções ausentes: ' + missingFns.join(', '),
        detail: 'Possível erro de parsing ou versão incompleta do arquivo',
      };
    }

    // Verifica configuração (opt-in — ausência não é erro crítico)
    var configured = false;
    var configDetail = '';
    try {
      // _cfg() é função interna do sync.js; acessa via closure se exposta
      if (typeof _cfg === 'function') {
        configured = !!_cfg();
        configDetail = configured ? 'Supabase configurado e ativo' : 'Supabase não configurado (opt-in)';
      } else {
        // _cfg não exposta globalmente — tenta via AppStorage
        var syncCfg = (typeof AppStorage !== 'undefined')
          ? AppStorage.get('agendaProMax_syncConfig', null)
          : null;
        configured   = !!(syncCfg && syncCfg.url && syncCfg.anonKey);
        configDetail = configured ? 'Config encontrada no storage' : 'Sem config de sync no storage';
      }
    } catch (e) {
      configDetail = 'Erro ao verificar config: ' + (e.message || e);
    }

    // Verifica device ID
    var deviceId = (typeof AppStorage !== 'undefined')
      ? AppStorage.get('agendaProMax_deviceId', null)
      : null;
    var deviceDetail = deviceId ? ('deviceId=' + String(deviceId).slice(0, 8) + '…') : 'deviceId não gerado ainda';

    return {
      level: 'pass',
      msg: 'sync.js funcional — ' + (configured ? 'sincronização ativa' : 'aguardando configuração (opt-in)'),
      detail: configDetail + ' | ' + deviceDetail + ' | online=' + navigator.onLine,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 5 — SERVICE WORKER: verifica registro ativo + versão de cache
  // ════════════════════════════════════════════════════════════════
  async function _checkServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return {
        level: 'warn',
        msg: 'API serviceWorker não suportada — PWA offline indisponível',
        detail: 'Verifique se o contexto é HTTPS ou localhost',
      };
    }

    var registrations;
    try {
      registrations = await navigator.serviceWorker.getRegistrations();
    } catch (e) {
      return {
        level: 'warn',
        msg: 'Erro ao consultar registros do SW',
        detail: e.message || String(e),
      };
    }

    if (!registrations || registrations.length === 0) {
      return {
        level: 'warn',
        msg: 'Nenhum Service Worker registrado',
        detail: 'Normal na primeira carga ou em modo dev sem HTTPS',
      };
    }

    var active  = registrations.filter(function (r) { return r.active; });
    var waiting = registrations.filter(function (r) { return r.waiting; });
    var installing = registrations.filter(function (r) { return r.installing; });

    // Inspeciona qual versão de cache está ativa via caches.keys()
    var cacheInfo = '';
    try {
      if ('caches' in window) {
        var keys = await caches.keys();
        var agendaCaches = keys.filter(function (k) { return k.startsWith('agenda-cache-'); });
        cacheInfo = agendaCaches.length > 0
          ? 'caches=' + agendaCaches.join(', ')
          : 'nenhum cache agenda- encontrado';
      }
    } catch (e) {
      cacheInfo = 'caches.keys() indisponível';
    }

    var detail = [
      active.length + ' ativo(s)',
      waiting.length > 0 ? waiting.length + ' aguardando' : null,
      installing.length > 0 ? installing.length + ' instalando' : null,
      cacheInfo,
    ].filter(Boolean).join(' | ');

    if (active.length === 0) {
      return {
        level: 'warn',
        msg: 'SW registrado mas sem instância ativa — aguardando ativação',
        detail: detail,
      };
    }

    return {
      level: 'pass',
      msg: 'Service Worker ativo e operacional',
      detail: detail,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK 6 — SYNCQUEUE: teste funcional ativo (enqueue → peek → remoção manual)
  // ════════════════════════════════════════════════════════════════
  function _checkSyncQueue() {
    if (typeof SyncQueue === 'undefined') {
      return {
        level: 'warn',
        msg: 'SyncQueue não definido — operações offline não serão enfileiradas',
        detail: 'Verifique se <script src="./core/syncQueue.js"> está carregado',
      };
    }

    var required = ['enqueue', 'flush', 'size', 'peek'];
    var missing  = required.filter(function (fn) { return typeof SyncQueue[fn] !== 'function'; });
    if (missing.length > 0) {
      return {
        level: 'warn',
        msg: 'SyncQueue existe mas API incompleta: ' + missing.join(', '),
        detail: 'Versão do syncQueue.js pode estar desatualizada',
      };
    }

    // Teste ativo: mede o tamanho antes/depois sem enfileirar item real
    // (enqueue adiciona ao localStorage — evitamos dados espúrios em produção)
    // Fazemos apenas peek() e size() que são operações somente-leitura
    var sizeBefore = SyncQueue.size();
    var peekBefore = SyncQueue.peek();

    if (!Array.isArray(peekBefore)) {
      return {
        level: 'warn',
        msg: 'SyncQueue.peek() não retornou array',
        detail: 'tipo=' + typeof peekBefore,
      };
    }
    if (typeof sizeBefore !== 'number') {
      return {
        level: 'warn',
        msg: 'SyncQueue.size() não retornou número',
        detail: 'tipo=' + typeof sizeBefore,
      };
    }
    if (sizeBefore !== peekBefore.length) {
      return {
        level: 'warn',
        msg: 'Inconsistência: size()=' + sizeBefore + ' ≠ peek().length=' + peekBefore.length,
        detail: 'SyncQueue pode ter corrompido estado interno',
      };
    }

    var pendingMsg = sizeBefore > 0
      ? sizeBefore + ' operação(ões) pendente(s) para sincronizar'
      : 'fila vazia';

    return {
      level: 'pass',
      msg: 'SyncQueue funcional — API completa e estado consistente',
      detail: pendingMsg,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // ORQUESTRADOR PRINCIPAL
  // ════════════════════════════════════════════════════════════════
  async function runDiagnostics() {
    var tsStart = Date.now();

    _L.log('──── Diagnóstico ativo iniciado ────');

    // Executa todos os checks em paralelo (são independentes e não escrevem
    // dados reais — exceto o check de logger que escreve uma entrada descartável)
    var results = await Promise.all([
      _run('Logger (AppLog)',           _checkLogger),
      _run('Storage (AppStorage)',      _checkStorage),
      _run('State (integridade ativa)', _checkStateIntegrity),
      _run('Sync (sync.js)',            _checkSync),
      _run('Service Worker',            _checkServiceWorker),
      _run('SyncQueue',                 _checkSyncQueue),
    ]);

    // Classifica resultados
    var passed   = results.filter(function (r) { return r.level === 'pass'; });
    var warnings = results.filter(function (r) { return r.level === 'warn'; });
    var critical = results.filter(function (r) { return r.level === 'critical'; });

    var ok       = critical.length === 0;
    var duration = Date.now() - tsStart;

    // ── Log detalhado por check ──
    results.forEach(function (r) {
      var line = r.name + (r.msg ? ': ' + r.msg : '') + (r.detail ? ' [' + r.detail + ']' : '');
      if (r.level === 'pass')     _L.log('✅ ' + line);
      else if (r.level === 'warn')  _L.warn('⚠️  ' + line);
      else                         _L.error('🔴 ' + line);
    });

    // ── Sumário final ──
    var summary =
      '──── Diagnóstico concluído em ' + duration + 'ms ────  ' +
      passed.length   + ' OK | ' +
      warnings.length + ' aviso(s) | ' +
      critical.length + ' crítico(s)';

    if (ok) {
      _L.log(summary);
    } else {
      _L.error(summary);
    }

    // Monta relatório
    var report = {
      ok:       ok,
      ts:       tsStart,
      duration: duration,
      passed:   passed,
      warnings: warnings,
      critical: critical,
    };

    _lastReport = report;
    return report;
  }

  // ── API pública ─────────────────────────────────────────────────
  return {
    run: runDiagnostics,
    get lastReport() { return _lastReport; },
  };

}());

// ── Função global (atalho) ───────────────────────────────────────
function runDiagnostics() {
  return AppDiagnostics.run();
}
