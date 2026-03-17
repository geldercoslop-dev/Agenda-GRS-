/**
 * core/bootController.js — Agenda GRS
 * Último script carregado. Único responsável pela inicialização da UI.
 *
 * Nomes reais do codebase (mapeados de index.html / agenda.js / ui.js):
 *   checkStateIntegrity() → valida integridade do state    (core/stateIntegrity.js)
 *   renderFolders()       → pastas         (folderGrid)    (index.html)
 *   renderWeekStrip()     → faixa semanal  (weekStrip)     (index.html)
 *   atualizarCalendario() → calendário     (dateTasks)     (agenda.js)
 *   atualizarLupa('home') → barra de busca (home)          (ui.js / index.html)
 *
 * NÃO existem no codebase: renderPastas, inicializarBusca, initState, loadStorage
 */
document.addEventListener("DOMContentLoaded", function () {

  try {

    if (typeof checkStateIntegrity === "function") checkStateIntegrity(state);

    if (typeof renderFolders       === "function") renderFolders();

    if (typeof renderWeekStrip     === "function") renderWeekStrip();

    if (typeof atualizarCalendario === "function") atualizarCalendario();

    if (typeof atualizarLupa       === "function") atualizarLupa("home");

    console.log("BOOT OK");

  } catch (err) {
    console.error("BOOT ERROR:", err);
  }

});
