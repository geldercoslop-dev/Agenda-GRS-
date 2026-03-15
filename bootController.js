/**
 * core/bootController.js — Agenda GRS
 * Único responsável pela inicialização da UI.
 *
 * Nomes reais do codebase:
 *   renderFolders()       → pastas (folderGrid)
 *   renderWeekStrip()     → faixa semanal (weekStrip)
 *   atualizarCalendario() → consultas no dateTasks (agenda.js)
 *   atualizarLupa('home') → barra de busca na home (ui.js)
 */

document.addEventListener('DOMContentLoaded', function () {
  try {

    if (typeof checkStateIntegrity === 'function') {
      checkStateIntegrity();
    }

    if (typeof window.renderFolders === 'function') {
      window.renderFolders();
    }

    if (typeof window.renderWeekStrip === 'function') {
      window.renderWeekStrip();
    }

    if (typeof window.atualizarCalendario === 'function') {
      window.atualizarCalendario();
    }

    if (typeof window.atualizarLupa === 'function') {
      window.atualizarLupa('home');
    }

  } catch (e) {
    console.error('Erro no boot:', e);
  }
});
