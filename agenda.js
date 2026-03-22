/**
 * agenda.js — Lógica do Calendário
 * Agenda GRS — Módulo separado para manutenção facilitada
 * Requer: state, save, renderCalModal (globais em index.html)
 */

// Garante que state.dateTasks[key] é sempre um array válido antes de qualquer acesso
function _ensureDateTasksArray(key) {
  if (!state.dateTasks || typeof state.dateTasks !== 'object') {
    state.dateTasks = {};
  }
  if (!Array.isArray(state.dateTasks[key])) {
    state.dateTasks[key] = [];
  }
  return state.dateTasks[key];
}

var _lastCalendarioDigest = '';

function _consultaDigest(c) {
  return String(c && c.id || '') + '|' +
    String(c && c.data || '') + '|' +
    String(c && c.hora || '') + '|' +
    String(c && c.especialidade || '') + '|' +
    String(c && c.medico || '') + '|' +
    String(c && c.paciente || '');
}

function _buildCalendarioDigest() {
  if (!Array.isArray(state.consultas) || state.consultas.length === 0) return 'v1:empty';
  var parts = new Array(state.consultas.length);
  for (var i = 0; i < state.consultas.length; i++) parts[i] = _consultaDigest(state.consultas[i]);
  parts.sort();
  return 'v1:' + parts.join('||');
}

// Atualizar todos os eventos do calendário ao editar consulta
function atualizarCalendario() {
  if (!Array.isArray(state.consultas)) return;
  if (!state.dateTasks || typeof state.dateTasks !== 'object') state.dateTasks = {};

  var nextDigest = _buildCalendarioDigest();
  if (nextDigest === _lastCalendarioDigest) {
    try { if (document.getElementById('calModalOverlay')?.classList.contains('show')) renderCalModal(); } catch(e) {}
    return;
  }

  var consultaBuckets = {};
  for (const key in state.dateTasks) {
    if (!Array.isArray(state.dateTasks[key])) {
      if (typeof AppLog !== 'undefined') AppLog.warn('agenda.js/atualizarCalendario', 'dateTasks[' + key + '] corrompido (não-array) — reinicializado', typeof state.dateTasks[key]);
      state.dateTasks[key] = [];
      continue;
    }
    var arr = state.dateTasks[key];
    var kept = [];
    for (var j = 0; j < arr.length; j++) {
      var t = arr[j];
      if (t && t.consultaRef) {
        if (!consultaBuckets[key]) consultaBuckets[key] = [];
        consultaBuckets[key].push(t);
      } else if (t) {
        kept.push(t);
      }
    }
    state.dateTasks[key] = kept;
  }

  var nowTs = Date.now();
  for (var i2 = 0; i2 < state.consultas.length; i2++) {
    var c = state.consultas[i2];
    if (!c || !c.data || !c.hora) continue;
    var bucket = _ensureDateTasksArray(c.data);
    if (!Array.isArray(bucket)) continue;
    var text = '🏥 ' + (c.especialidade || '') + (c.medico ? ' · ' + c.medico : '') + (c.paciente ? ' — ' + c.paciente : '') + ' às ' + c.hora;
    var existing = (consultaBuckets[c.data] || []).find(function(t) { return t && t.consultaRef === c.id; });
    if (existing) {
      existing.text = text;
      existing.done = false;
      bucket.push(existing);
    } else {
      bucket.push({
        id: 'cal_' + c.id,
        text: text,
        done: false,
        createdAt: nowTs,
        consultaRef: c.id
      });
    }
  }

  _lastCalendarioDigest = nextDigest;

  // Re-renderiza modal de calendário se aberto
  try { if (document.getElementById('calModalOverlay')?.classList.contains('show')) renderCalModal(); } catch(e) {}
}
