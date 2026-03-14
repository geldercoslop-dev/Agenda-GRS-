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

// Atualizar todos os eventos do calendário ao editar consulta
function atualizarCalendario() {
  // Remove e reinserge todas as consultas no dateTasks
  if (!Array.isArray(state.consultas)) return;
  if (!state.dateTasks || typeof state.dateTasks !== 'object') state.dateTasks = {};

  // Limpa marcadores antigos de consultas (consultaRef)
  for (const key in state.dateTasks) {
    if (!Array.isArray(state.dateTasks[key])) {
      // Bucket corrompido (não é array): reinicializa em vez de filtrar
      if (typeof AppLog !== 'undefined') AppLog.warn('agenda.js/atualizarCalendario', 'dateTasks[' + key + '] corrompido (não-array) — reinicializado', typeof state.dateTasks[key]);
      state.dateTasks[key] = [];
    } else {
      state.dateTasks[key] = state.dateTasks[key].filter(function(t) {
        return t && !t.consultaRef;
      });
    }
  }

  // Reinserge consultas futuras
  state.consultas.forEach(function(c) {
    if (!c || !c.data || !c.hora) return;
    var bucket = _ensureDateTasksArray(c.data);
    if (!Array.isArray(bucket)) return;
    bucket.push({
      id: 'cal_' + c.id,
      text: '🏥 ' + (c.especialidade || '') + (c.medico ? ' · ' + c.medico : '') + (c.paciente ? ' — ' + c.paciente : '') + ' às ' + c.hora,
      done: false,
      createdAt: Date.now(),
      consultaRef: c.id
    });
  });

  // Re-renderiza modal de calendário se aberto
  try { if (document.getElementById('calModalOverlay')?.classList.contains('show')) renderCalModal(); } catch(e) {}
}
