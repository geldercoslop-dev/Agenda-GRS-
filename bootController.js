/**
 * core/bootController.js — Agenda GRS
 * Único responsável pela inicialização da UI.
 *
 * Fluxo:
 *   1. waitStorage()         → aguarda AppStorage.idbReady (nunca bloqueia)
 *   2. checkStateIntegrity() → valida integridade do state
 *   3. renderUI()            → dispara todos os renders principais
 *
 * Nomes reais do codebase:
 *   renderFolders()       → pastas (folderGrid)
 *   renderWeekStrip()     → faixa semanal (weekStrip)
 *   atualizarCalendario() → consultas no dateTasks (agenda.js)
 *   atualizarLupa('home') → barra de busca na home (ui.js)
 */
(async function () {

  async function waitStorage() {
    try {
      if (window.AppStorage && AppStorage.idbReady) {
        await AppStorage.idbReady;
      }
    } catch (e) {
      console.warn('[bootController] storage fallback:', e);
    }
  }

  function renderUI() {
    if (typeof window.state === 'undefined' || window.state === null || typeof window.state !== 'object') {
      window.state = { consultas: [], tasks: {}, dateTasks: {}, folders: [], folderOrder: [], remedios: [] };
      console.warn('[bootController] state ausente — objeto mínimo injetado');
    }

    if (typeof atualizarCalendario === 'function') atualizarCalendario();
    if (typeof renderFolders       === 'function') renderFolders();
    if (typeof renderWeekStrip     === 'function') renderWeekStrip();
    if (typeof atualizarLupa       === 'function') atualizarLupa('home');
  }

  window.startApplication = async function () {
    await waitStorage();

    if (typeof checkStateIntegrity === 'function') {
      try { checkStateIntegrity(); } catch (e) {
        console.warn('[bootController] checkStateIntegrity erro:', e);
      }
    }

    try {
      renderUI();
      console.log('[bootController] startApplication OK');
    } catch (e) {
      console.error('[bootController] renderUI erro:', e);
    }
  };

  // Inicia automaticamente após DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    window.startApplication();
  });

}());
