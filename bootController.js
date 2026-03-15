/**
 * core/bootController.js — Agenda GRS
 * Último script carregado. Único responsável pela inicialização da UI.
 */
document.addEventListener("DOMContentLoaded", function () {

  try {

    if (typeof initState === "function") initState();

    if (typeof loadStorage === "function") loadStorage();

    if (typeof renderFolders === "function") renderFolders();

    if (typeof renderWeekStrip === "function") renderWeekStrip();

    if (typeof atualizarCalendario === "function") atualizarCalendario();

    if (typeof atualizarLupa === "function") atualizarLupa("home");

    if (typeof startSync === "function") startSync();

    console.log("BOOT OK");

  } catch (err) {
    console.error("BOOT ERROR:", err);
  }

});
