/**
 * agenda.js — Lógica do Calendário
 * Agenda GRS — Módulo separado para manutenção facilitada
 * Requer: state, save, renderCalModal (globais em index.html)
 */

// Atualizar todos os eventos do calendário ao editar consulta
function atualizarCalendario() {
  // Remove e reinserge todas as consultas no dateTasks
  if (!state.consultas || !state.dateTasks) return;
  // Limpa marcadores antigos de consultas (consultaRef)
  for (const key in state.dateTasks) {
    state.dateTasks[key] = (state.dateTasks[key] || []).filter(t => !t.consultaRef);
  }
  // Reinserge consultas futuras
  const hoje = new Date().toISOString().split('T')[0];
  state.consultas.forEach(c => {
    if (!c.data || !c.hora) return;
    if (!state.dateTasks[c.data]) state.dateTasks[c.data] = [];
    state.dateTasks[c.data].push({
      id: 'cal_' + c.id,
      text: '🏥 ' + c.especialidade + (c.medico ? ' · ' + c.medico : '') + (c.paciente ? ' — ' + c.paciente : '') + ' às ' + c.hora,
      done: false,
      createdAt: Date.now(),
      consultaRef: c.id
    });
  });
  // Re-renderiza modal de calendário se aberto
  try { if (document.getElementById('calModalOverlay')?.classList.contains('show')) renderCalModal(); } catch(e) {}
}
