/**
 * core/stateManager.js — Controlador Central de State
 * Agenda Pro Max — Toda modificação em state.consultas passa por aqui.
 *
 * API pública (globais):
 *   StateManager.addConsulta(data)           → consulta adicionada + salva
 *   StateManager.removeConsulta(id)          → consulta removida + salva
 *   StateManager.updateConsulta(id, fields)  → consulta atualizada + salva
 *   StateManager.restoreConsulta(idx, obj)   → restaura após undo + salva
 *   StateManager.upsertConsulta(obj)         → upsert vindo do sync pull
 *   StateManager.bulkSetConsultas(arr)       → substitui array inteiro (sync delete)
 *   StateManager.updateState(partial)        → atualiza campos genéricos do state
 *
 * Contrato:
 *   • Toda operação atualiza state.lastModified com Date.now().
 *   • Toda operação chama save() após modificar o state.
 *   • Toda operação registra via AppLog.log com origem e detalhe.
 *   • Nenhuma operação altera o comportamento funcional existente.
 *   • Dependências: state (global), save (global), AppLog (global — opcional).
 *
 * NOTA SOBRE ESCOPO:
 *   Este módulo gerencia state.consultas como especificado.
 *   As demais coleções (tasks, dateTasks, folders, remedios) continuam sendo
 *   gerenciadas diretamente — são operadas por lógicas específicas de semana,
 *   arrastar/soltar e migração que tornariam um wrapper genérico frágil.
 *   A função updateState() cobre casos pontuais de campos escalares.
 */

var StateManager = (function () {
  'use strict';

  // ── Logger seguro ────────────────────────────────────────────────
  function _log(msg, extra) {
    if (typeof AppLog !== 'undefined') {
      if (extra !== undefined) AppLog.log('stateManager.js', msg, extra);
      else                     AppLog.log('stateManager.js', msg);
    }
  }
  function _currentSyncScopeSafe() {
    try {
      if (typeof _currentScope === 'function') return _currentScope() || '';
    } catch (_) {}
    try {
      if (typeof state !== 'undefined' && state && typeof state.syncScope === 'string') return state.syncScope || '';
    } catch (_) {}
    return '';
  }
  function _warn(msg, extra) {
    if (typeof AppLog !== 'undefined') {
      if (extra !== undefined) AppLog.warn('stateManager.js', msg, extra);
      else                     AppLog.warn('stateManager.js', msg);
    }
  }
  function _err(msg, extra) {
    if (typeof AppLog !== 'undefined') {
      if (extra !== undefined) AppLog.error('stateManager.js', msg, extra);
      else                     AppLog.error('stateManager.js', msg);
    }
  }

  // ── Guarda de estado ─────────────────────────────────────────────
  function _guardState() {
    if (typeof state === 'undefined' || state === null) {
      _err('state global não disponível — operação abortada');
      return false;
    }
    if (!Array.isArray(state.consultas)) {
      _warn('state.consultas não é array — inicializando');
      state.consultas = [];
    }
    return true;
  }

  // ── Persistência ─────────────────────────────────────────────────
  function _persist(label) {
    state.lastModified = Date.now();
    try {
      if (typeof save === 'function') save();
    } catch (e) {
      _err('Erro ao persistir após ' + label, e.message);
    }
  }

  // ── Ordenação padrão de consultas ────────────────────────────────
  function _sortConsultas() {
    state.consultas.sort(function (a, b) {
      return (a.data + a.hora).localeCompare(b.data + b.hora);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // addConsulta(data)
  // Adiciona nova consulta ao array, reordena e persiste.
  // @param {object} data — objeto consulta já com id (ensureSyncFields aplicado)
  // Retorna a consulta adicionada, ou null se duplicada ou inválida.
  // ════════════════════════════════════════════════════════════════
  function addConsulta(data) {
    if (!_guardState()) return null;
    if (!data || typeof data !== 'object') {
      _err('addConsulta: data inválido', typeof data);
      return null;
    }

    // ── Verificação de duplicata: mesmo paciente + data + hora ──
    // Comparação case-insensitive no paciente para cobrir variações de digitação.
    var pacNorm = typeof data.paciente === 'string' ? data.paciente.trim().toLowerCase() : '';
    var dataNorm = typeof data.data === 'string'    ? data.data.trim()                    : '';
    var horaNorm = typeof data.hora === 'string'    ? data.hora.trim()                    : '';

    var duplicata = state.consultas.find(function (c) {
      return (
        typeof c.paciente === 'string' && c.paciente.trim().toLowerCase() === pacNorm &&
        typeof c.data     === 'string' && c.data.trim()                   === dataNorm &&
        typeof c.hora     === 'string' && c.hora.trim()                   === horaNorm
      );
    });

    if (duplicata) {
      _warn(
        'consulta duplicada detectada — operação cancelada',
        'paciente=' + (data.paciente || '?') +
        ' | data=' + (data.data || '?') +
        ' | hora=' + (data.hora || '?') +
        ' | id existente=' + (duplicata.id || '?')
      );
      return null;
    }

    if (!data.syncScope) data.syncScope = _currentSyncScopeSafe();
    state.consultas.push(data);
    _sortConsultas();
    _persist('addConsulta');
    _log('addConsulta: id=' + (data.id || '?'));
    return data;
  }

  // ════════════════════════════════════════════════════════════════
  // removeConsulta(id)
  // Remove consulta por id. Retorna o objeto removido (para undo).
  // @param {string} id
  // @returns {object|null} — objeto removido ou null se não encontrado
  // ════════════════════════════════════════════════════════════════
  function removeConsulta(id) {
    if (!_guardState()) return null;
    if (!id) { _err('removeConsulta: id ausente'); return null; }

    var idx = state.consultas.findIndex(function (c) { return c.id === id; });
    if (idx < 0) {
      _warn('removeConsulta: id não encontrado — ' + id);
      return null;
    }
    var removed = state.consultas.splice(idx, 1)[0];
    _persist('removeConsulta');
    _log('removeConsulta: id=' + id);
    return { item: removed, idx: idx };
  }

  // ════════════════════════════════════════════════════════════════
  // updateConsulta(id, fields)
  // Mescla campos em uma consulta existente. Reordena e persiste.
  // @param {string} id
  // @param {object} fields — campos a mesclar (Object.assign)
  // @returns {object|null} — referência ao objeto atualizado ou null
  // ════════════════════════════════════════════════════════════════
  function updateConsulta(id, fields) {
    if (!_guardState()) return null;
    if (!id)     { _err('updateConsulta: id ausente'); return null; }
    if (!fields) { _err('updateConsulta: fields ausente'); return null; }

    var idx = state.consultas.findIndex(function (c) { return c.id === id; });
    if (idx < 0) {
      _warn('updateConsulta: consulta não encontrada — ' + id);
      return null;
    }
    Object.assign(state.consultas[idx], fields);
    if (!state.consultas[idx].syncScope) {
      state.consultas[idx].syncScope = _currentSyncScopeSafe();
    }
    _sortConsultas();
    _persist('updateConsulta');
    _log('updateConsulta: id=' + id + ', campos=' + Object.keys(fields).join(','));
    return state.consultas[idx];
  }

  // ════════════════════════════════════════════════════════════════
  // restoreConsulta(idx, obj)
  // Reinserge consulta removida na posição original (undo de delete).
  // @param {number} idx  — índice original no array
  // @param {object} obj  — objeto consulta a restaurar
  // ════════════════════════════════════════════════════════════════
  function restoreConsulta(idx, obj) {
    if (!_guardState()) return;
    if (!obj || typeof obj !== 'object') {
      _err('restoreConsulta: obj inválido');
      return;
    }
    if (!obj.syncScope) {
      obj.syncScope = _currentSyncScopeSafe();
    }
    // Clamp idx para evitar buraco no array
    var safeIdx = Math.min(idx, state.consultas.length);
    state.consultas.splice(safeIdx, 0, obj);
    _persist('restoreConsulta');
    _log('restoreConsulta: id=' + (obj.id || '?') + ', idx=' + safeIdx);
  }

  // ════════════════════════════════════════════════════════════════
  // upsertConsulta(obj)
  // Insere ou substitui consulta por id (usado pelo sync pull).
  // Não chama save() — o sync pull controla quando salvar.
  // ════════════════════════════════════════════════════════════════
  function upsertConsulta(obj) {
    if (!_guardState()) return;
    if (!obj || !obj.id) { _err('upsertConsulta: obj sem id'); return; }

    var idx = state.consultas.findIndex(function (c) { return c.id === obj.id; });
    if (!obj.syncScope) obj.syncScope = _currentSyncScopeSafe();
    if (idx >= 0) {
      state.consultas[idx] = obj;
      _log('upsertConsulta (update): id=' + obj.id);
    } else {
      state.consultas.push(obj);
      _log('upsertConsulta (insert): id=' + obj.id);
    }
    state.lastModified = Date.now();
    // Não chama save() — sync pull agrupa e salva uma única vez no final
  }

  // ════════════════════════════════════════════════════════════════
  // bulkSetConsultas(arr)
  // Substitui state.consultas inteiro (usado no sync pull para soft-delete).
  // Não chama save() — o sync pull controla quando salvar.
  // ════════════════════════════════════════════════════════════════
  function bulkSetConsultas(arr) {
    if (!_guardState()) return;
    if (!Array.isArray(arr)) { _err('bulkSetConsultas: arr não é array'); return; }
    state.consultas = arr;
    state.lastModified = Date.now();
    _log('bulkSetConsultas: ' + arr.length + ' item(s)');
  }

  // ════════════════════════════════════════════════════════════════
  // updateState(partial)
  // Atualiza campos escalares do state (theme, userName, etc.).
  // Não deve ser usado para arrays/objetos complexos já gerenciados acima.
  // @param {object} partial — { campo: valor, ... }
  // ════════════════════════════════════════════════════════════════
  function updateState(partial) {
    if (!partial || typeof partial !== 'object') {
      _err('updateState: partial inválido');
      return;
    }
    if (typeof state === 'undefined') {
      _err('updateState: state global não disponível');
      return;
    }
    Object.assign(state, partial);
    _persist('updateState');
    _log('updateState: campos=' + Object.keys(partial).join(','));
  }

  // ── API pública ──────────────────────────────────────────────────
  return {
    addConsulta:     addConsulta,
    removeConsulta:  removeConsulta,
    updateConsulta:  updateConsulta,
    restoreConsulta: restoreConsulta,
    upsertConsulta:  upsertConsulta,
    bulkSetConsultas: bulkSetConsultas,
    updateState:     updateState
  };

}());
