/**
 * core/stateIntegrity.js — Verificação de Integridade do State
 * Agenda Pro Max — Garante que o sistema nunca inicie com estrutura inválida.
 *
 * API pública (global):
 *   checkStateIntegrity(stateObj)  → { ok: bool, repairs: string[], errors: string[] }
 *
 * Contrato:
 *   • Nunca apaga dados válidos — apenas repara campos ausentes ou com tipo errado.
 *   • Campos com tipo correto mas conteúdo questionável são preservados.
 *   • Toda corrupção detectada é registrada via AppLog.error antes do reparo.
 *   • Retorna relatório com o que foi verificado, reparado e o que não pôde ser salvo.
 *
 * Carregamento:
 *   Deve ser carregado APÓS logger.js e ANTES de qualquer uso do state.
 *   Chamado em index.html logo após init() + _runMigrations().
 */

/**
 * checkStateIntegrity(stateObj)
 *
 * @param  {object} stateObj  — o objeto `state` global já carregado
 * @returns {{ ok: boolean, repairs: string[], errors: string[] }}
 *
 *   ok      → true se nenhuma corrupção foi encontrada
 *   repairs → lista de campos reparados (com descrição do problema e da correção)
 *   errors  → lista de problemas que não puderam ser totalmente sanados
 *             (caso raro — estrutura tão corrompida que um campo não pôde ser inferido)
 */
function checkStateIntegrity(stateObj) {
  'use strict';

  var repairs = [];
  var errors  = [];

  // ── Logger seguro ────────────────────────────────────────────────
  function _err(msg)  {
    if (typeof AppLog !== 'undefined') AppLog.error('stateIntegrity.js', msg);
    else console.error('[stateIntegrity] ' + msg);
  }
  function _warn(msg) {
    if (typeof AppLog !== 'undefined') AppLog.warn('stateIntegrity.js', msg);
    else console.warn('[stateIntegrity] ' + msg);
  }
  function _log(msg)  {
    if (typeof AppLog !== 'undefined') AppLog.log('stateIntegrity.js', msg);
    else console.log('[stateIntegrity] ' + msg);
  }

  // ── 1. Guarda de estado raiz ─────────────────────────────────────
  if (!stateObj || typeof stateObj !== 'object' || Array.isArray(stateObj)) {
    _err('state raiz ausente ou com tipo inválido (' + typeof stateObj + ') — sistema bloqueado');
    errors.push('state raiz inválido: tipo=' + typeof stateObj);
    // Não há como reparar aqui sem substituir o objeto raiz inteiro;
    // retorna imediatamente para que o chamador tome providências.
    return { ok: false, repairs: repairs, errors: errors };
  }

  // ── 2. consultas — deve ser array ────────────────────────────────
  if (!Array.isArray(stateObj.consultas)) {
    _err('state.consultas não é array (tipo=' + typeof stateObj.consultas + ') — reparado para []');
    repairs.push('consultas: ' + typeof stateObj.consultas + ' → []');
    stateObj.consultas = [];
  } else {
    // Sanitiza itens internos: remove entradas nulas/não-objeto sem apagar dados válidos
    var consultasBefore = stateObj.consultas.length;
    stateObj.consultas = stateObj.consultas.filter(function (c) {
      return c !== null && c !== undefined && typeof c === 'object' && !Array.isArray(c);
    });
    var consultasRemoved = consultasBefore - stateObj.consultas.length;
    if (consultasRemoved > 0) {
      _err('state.consultas: ' + consultasRemoved + ' entrada(s) nula(s)/inválida(s) removida(s)');
      repairs.push('consultas: ' + consultasRemoved + ' item(s) nulo(s) removido(s)');
    }
  }

  // ── 3. dateTasks — deve ser objeto simples (não array, não null) ─
  if (
    stateObj.dateTasks === null ||
    stateObj.dateTasks === undefined ||
    typeof stateObj.dateTasks !== 'object' ||
    Array.isArray(stateObj.dateTasks)
  ) {
    _err('state.dateTasks inválido (tipo=' + typeof stateObj.dateTasks + ', isArray=' + Array.isArray(stateObj.dateTasks) + ') — reparado para {}');
    repairs.push('dateTasks: ' + (Array.isArray(stateObj.dateTasks) ? 'array' : typeof stateObj.dateTasks) + ' → {}');
    stateObj.dateTasks = {};
  } else {
    // Audita buckets internos: cada chave deve ser um array
    var dtKeys = Object.keys(stateObj.dateTasks);
    for (var i = 0; i < dtKeys.length; i++) {
      var dtKey = dtKeys[i];
      var bucket = stateObj.dateTasks[dtKey];
      if (!Array.isArray(bucket)) {
        _err('state.dateTasks["' + dtKey + '"] não é array (tipo=' + typeof bucket + ') — reparado para []');
        repairs.push('dateTasks["' + dtKey + '"]: ' + typeof bucket + ' → []');
        stateObj.dateTasks[dtKey] = [];
      } else {
        // Remove entradas nulas dentro dos buckets
        var bucketBefore = bucket.length;
        stateObj.dateTasks[dtKey] = bucket.filter(function (t) {
          return t !== null && t !== undefined && typeof t === 'object' && !Array.isArray(t);
        });
        var bucketRemoved = bucketBefore - stateObj.dateTasks[dtKey].length;
        if (bucketRemoved > 0) {
          _warn('state.dateTasks["' + dtKey + '"]: ' + bucketRemoved + ' item(s) nulo(s) removido(s)');
          repairs.push('dateTasks["' + dtKey + '"]: ' + bucketRemoved + ' item(s) nulo(s) removido(s)');
        }
      }
    }
  }

  // ── 4. tasks — deve ser objeto simples (não array, não null) ─────
  //    Nota: o spec do desafio diz "é array" mas a arquitetura real usa objeto
  //    de buckets (dom, seg, ter, …, + IDs de pastas). Tratamos como objeto.
  if (
    stateObj.tasks === null ||
    stateObj.tasks === undefined ||
    typeof stateObj.tasks !== 'object' ||
    Array.isArray(stateObj.tasks)
  ) {
    _err('state.tasks inválido (tipo=' + typeof stateObj.tasks + ', isArray=' + Array.isArray(stateObj.tasks) + ') — reparado para {}');
    repairs.push('tasks: ' + (Array.isArray(stateObj.tasks) ? 'array' : typeof stateObj.tasks) + ' → {}');
    stateObj.tasks = {};
  } else {
    // Audita buckets: cada chave deve ser array
    var taskKeys = Object.keys(stateObj.tasks);
    for (var j = 0; j < taskKeys.length; j++) {
      var tKey = taskKeys[j];
      var tBucket = stateObj.tasks[tKey];
      if (!Array.isArray(tBucket)) {
        _err('state.tasks["' + tKey + '"] não é array (tipo=' + typeof tBucket + ') — reparado para []');
        repairs.push('tasks["' + tKey + '"]: ' + typeof tBucket + ' → []');
        stateObj.tasks[tKey] = [];
      } else {
        // Remove entradas nulas dentro dos buckets de tasks
        var tBefore = tBucket.length;
        stateObj.tasks[tKey] = tBucket.filter(function (t) {
          return t !== null && t !== undefined && typeof t === 'object' && !Array.isArray(t);
        });
        var tRemoved = tBefore - stateObj.tasks[tKey].length;
        if (tRemoved > 0) {
          _warn('state.tasks["' + tKey + '"]: ' + tRemoved + ' item(s) nulo(s) removido(s)');
          repairs.push('tasks["' + tKey + '"]: ' + tRemoved + ' item(s) nulo(s) removido(s)');
        }
      }
    }
  }

  // ── 5. folders — deve ser array ──────────────────────────────────
  if (!Array.isArray(stateObj.folders)) {
    _err('state.folders não é array (tipo=' + typeof stateObj.folders + ') — reparado para []');
    repairs.push('folders: ' + typeof stateObj.folders + ' → []');
    stateObj.folders = [];
  }

  // ── 6. folderOrder — deve ser array ──────────────────────────────
  if (!Array.isArray(stateObj.folderOrder)) {
    _err('state.folderOrder não é array (tipo=' + typeof stateObj.folderOrder + ') — reparado para []');
    repairs.push('folderOrder: ' + typeof stateObj.folderOrder + ' → []');
    stateObj.folderOrder = [];
  }

  // ── 7. remedios — deve ser array ─────────────────────────────────
  if (!Array.isArray(stateObj.remedios)) {
    _err('state.remedios não é array (tipo=' + typeof stateObj.remedios + ') — reparado para []');
    repairs.push('remedios: ' + typeof stateObj.remedios + ' → []');
    stateObj.remedios = [];
  }

  // ── 8. bucketPhotos — deve ser objeto simples ────────────────────
  if (
    stateObj.bucketPhotos === null ||
    stateObj.bucketPhotos === undefined ||
    typeof stateObj.bucketPhotos !== 'object' ||
    Array.isArray(stateObj.bucketPhotos)
  ) {
    _warn('state.bucketPhotos inválido — reparado para {}');
    repairs.push('bucketPhotos: ' + typeof stateObj.bucketPhotos + ' → {}');
    stateObj.bucketPhotos = {};
  }

  // ── 9. Campos escalares críticos ─────────────────────────────────
  if (typeof stateObj.theme !== 'string' || !stateObj.theme) {
    _warn('state.theme inválido — reparado para "dark"');
    repairs.push('theme: ' + typeof stateObj.theme + ' → "dark"');
    stateObj.theme = 'dark';
  }
  if (typeof stateObj.userName !== 'string' || !stateObj.userName) {
    _warn('state.userName inválido — reparado para "Usuário"');
    repairs.push('userName: ' + typeof stateObj.userName + ' → "Usuário"');
    stateObj.userName = 'Usuário';
  }

  // ── Relatório final ──────────────────────────────────────────────
  var ok = repairs.length === 0 && errors.length === 0;

  if (ok) {
    _log('Verificação concluída — state íntegro, nenhum reparo necessário');
  } else if (errors.length > 0) {
    _err('Verificação concluída com ERROS não reparáveis: ' + errors.length + ' erro(s), ' + repairs.length + ' reparo(s) aplicado(s)');
  } else {
    _warn('Verificação concluída: ' + repairs.length + ' campo(s) reparado(s) — dados válidos preservados');
  }

  return { ok: ok, repairs: repairs, errors: errors };
}
