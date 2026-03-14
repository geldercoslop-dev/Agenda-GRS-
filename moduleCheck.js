/**
 * core/moduleCheck.js — Verificação de Carregamento de Módulos
 * Agenda Pro Max — Detecta falhas de carregamento em tempo de inicialização.
 *
 * API pública (global):
 *   checkModules(phase?)  → ModuleCheckReport
 *
 * ModuleCheckReport: {
 *   ok:      boolean,           // true se todos os módulos da fase estão presentes
 *   phase:   string,            // 'boot' | 'deferred'
 *   present: ModuleEntry[],     // módulos encontrados
 *   missing: ModuleEntry[],     // módulos ausentes
 * }
 *
 * ModuleEntry: { name: string, identifier: string, required: boolean }
 *
 * Fases de verificação:
 *   'boot'     — módulos síncronos (carregados antes de init()).
 *                Executada imediatamente após init() + migrações.
 *   'deferred' — módulos com atributo defer (agenda.js, notificacoes.js, ui.js).
 *                Executada dentro de DOMContentLoaded, quando os scripts defer
 *                já foram avaliados pelo browser.
 *
 *   checkModules() sem argumento executa a fase 'boot'.
 *   checkModules('deferred') executa a fase 'deferred'.
 *
 * Registro via AppLog:
 *   Módulo presente  → AppLog.log   (nível informativo)
 *   Módulo ausente obrigatório  → AppLog.error
 *   Módulo ausente opcional     → AppLog.warn
 *
 * Contrato:
 *   • NUNCA lança exceção para fora — todo erro é capturado internamente.
 *   • NUNCA bloqueia o sistema — ausências são apenas registradas.
 *   • Não depende de AppLog estar carregado (usa console como fallback).
 *   • Idempotente — pode ser chamada múltiplas vezes sem efeito colateral.
 */

// ── Definição dos módulos monitorados ────────────────────────────
//
// identifier: expressão JavaScript cujo typeof deve ser !== 'undefined'
//             para considerar o módulo presente.
// required:   true  → ausência é registrada como AppLog.error
//             false → ausência é registrada como AppLog.warn
// phase:      'boot'     → verificado na fase síncrona (antes de init)
//             'deferred' → verificado após DOMContentLoaded (scripts defer)
//
var _MODULE_REGISTRY = [

  // ── Fase boot — módulos síncronos (carregados em ordem no <head>) ──

  {
    name:       'state',
    identifier: 'state',
    desc:       'Estado global da aplicação (core/state.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'storage',
    identifier: 'AppStorage',
    desc:       'Camada de armazenamento (core/storage.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'logger',
    identifier: 'AppLog',
    desc:       'Sistema de log centralizado (core/logger.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'validators',
    identifier: 'validateConsulta',
    desc:       'Validação de dados (core/validators.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'sanitizer',
    identifier: 'sanitizeStr',
    desc:       'Sanitização de entradas (core/sanitizer.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'stateIntegrity',
    identifier: 'checkStateIntegrity',
    desc:       'Verificação de integridade do state (core/stateIntegrity.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'stateManager',
    identifier: 'StateManager',
    desc:       'Controlador de mutações do state (core/stateManager.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'syncQueue',
    identifier: 'SyncQueue',
    desc:       'Fila de sincronização offline (core/syncQueue.js)',
    required:   true,
    phase:      'boot',
  },
  {
    name:       'systemAudit',
    identifier: 'runSystemAudit',
    desc:       'Auditoria de inicialização (core/systemAudit.js)',
    required:   false,
    phase:      'boot',
  },
  {
    name:       'diagnostics',
    identifier: 'AppDiagnostics',
    desc:       'Modo diagnóstico ativo (core/diagnostics.js)',
    required:   false,
    phase:      'boot',
  },
  {
    name:       'sync',
    identifier: 'initSync',
    desc:       'Sincronização Supabase (sync.js)',
    required:   false,  // opt-in — sistema funciona sem ele
    phase:      'boot',
  },

  // ── Fase deferred — scripts com atributo defer ──

  {
    name:       'agenda',
    identifier: 'atualizarCalendario',
    desc:       'Lógica do calendário (agenda.js)',
    required:   true,
    phase:      'deferred',
  },
  {
    name:       'notificacoes',
    identifier: 'iniciarVerificacaoPeriodica',
    desc:       'Alertas automáticos (notificacoes.js)',
    required:   false,
    phase:      'deferred',
  },
  {
    name:       'ui',
    identifier: 'atualizarLupa',
    desc:       'Utilitários de interface (ui.js)',
    required:   false,
    phase:      'deferred',
  },
];

// ── Logger seguro: AppLog se disponível, console como fallback ────
var _L = {
  log: function (msg) {
    if (typeof AppLog !== 'undefined') AppLog.log('moduleCheck.js', msg);
    else console.log('[moduleCheck] ' + msg);
  },
  warn: function (msg) {
    if (typeof AppLog !== 'undefined') AppLog.warn('moduleCheck.js', msg);
    else console.warn('[moduleCheck] ⚠️  ' + msg);
  },
  error: function (msg) {
    if (typeof AppLog !== 'undefined') AppLog.error('moduleCheck.js', msg);
    // Erros críticos sempre aparecem no console independente do AppLog
    console.error('[moduleCheck] 🔴 ' + msg);
  },
};

/**
 * checkModules(phase?)
 *
 * Verifica os módulos da fase especificada ('boot' ou 'deferred').
 * Padrão: 'boot'.
 *
 * @param   {string} [phase='boot']
 * @returns {ModuleCheckReport}
 */
function checkModules(phase) {
  var activePhase = (phase === 'deferred') ? 'deferred' : 'boot';

  var present = [];
  var missing = [];

  // Filtra apenas os módulos da fase ativa
  var candidates = _MODULE_REGISTRY.filter(function (m) {
    return m.phase === activePhase;
  });

  candidates.forEach(function (mod) {
    var exists = false;
    try {
      // Avalia a disponibilidade verificando o tipo do identificador global.
      // Para expressões simples (nomes de variáveis), typeof é seguro mesmo
      // quando o identificador não existe — nunca lança ReferenceError.
      exists = (typeof window[mod.identifier] !== 'undefined');

      // Fallback para identificadores que podem não estar em window
      // (ex: declarados com var no escopo global mas sem window explícito)
      if (!exists) {
        try {
          // eslint-disable-next-line no-new-func
          exists = (new Function('return typeof ' + mod.identifier + ' !== "undefined"'))();
        } catch (e) {
          exists = false;
        }
      }
    } catch (e) {
      exists = false;
    }

    if (exists) {
      present.push(mod);
      _L.log('✅ ' + mod.name + ' — ' + mod.desc);
    } else {
      missing.push(mod);
      var logMsg = 'módulo ausente: ' + mod.name + ' (esperado: ' + mod.identifier + ') — ' + mod.desc;
      if (mod.required) {
        _L.error(logMsg);
      } else {
        _L.warn(logMsg);
      }
    }
  });

  // Sumário
  var criticalMissing = missing.filter(function (m) { return m.required; });
  var ok = criticalMissing.length === 0;

  var summary =
    '[' + activePhase + '] ' +
    present.length + '/' + candidates.length + ' módulos presentes' +
    (missing.length > 0
      ? ' — ausentes: ' + missing.map(function (m) { return m.name; }).join(', ')
      : '');

  if (ok && missing.length === 0) {
    _L.log('✅ ' + summary);
  } else if (ok) {
    _L.warn('⚠️  ' + summary + ' (opcionais — sistema operacional)');
  } else {
    _L.error('🔴 ' + summary + ' (críticos ausentes — sistema pode estar degradado)');
  }

  return {
    ok:      ok,
    phase:   activePhase,
    present: present,
    missing: missing,
  };
}
