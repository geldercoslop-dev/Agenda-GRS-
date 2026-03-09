/**
 * ui.js — Utilitários de Interface
 * Agenda GRS — Funções auxiliares de UI reutilizáveis
 */

// Controla visibilidade da lupa de busca por tela
function atualizarLupa(tela) {
  const lupa = document.getElementById('searchBtn');
  if (!lupa) return;
  if (tela === 'home') {
    lupa.style.display = 'flex';
    lupa.style.opacity = '1';
    lupa.style.pointerEvents = 'auto';
  } else {
    lupa.style.display = 'none';
  }
}

// Formata consulta no padrão: Paciente • Especialidade • Data Hora
function fmtConsultaLabel(c) {
  const dataFmt = c.data ? c.data.split('-').reverse().join('/') : '';
  return `${c.paciente || '-'} • ${c.especialidade || '-'} • ${dataFmt} ${c.hora || ''}`;
}
