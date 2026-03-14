/**
 * core/bootFix.js — Agenda GRS
 * Força a inicialização da UI mesmo se algum módulo falhar durante o boot.
 *
 * Nomes reais mapeados do codebase:
 *   renderFolders()      → pastas (folderGrid)
 *   renderWeekStrip()    → calendário semanal (weekStrip)
 *   atualizarCalendario() → sincroniza consultas no dateTasks (agenda.js)
 *   atualizarLupa('home') → controla barra de busca na home
 *
 * Deve ser o último script carregado (após agenda.js, ui.js — ambos defer).
 * Declarado como defer para garantir ordem correta.
 */
(function () {

  function safeCall(name, fn, args) {
    try {
      if (typeof fn === 'function') {
        fn.apply(window, args || []);
      }
    } catch (e) {
      console.error('[bootFix] Erro em ' + name + ':', e);
    }
  }

  function forceUIBoot() {
    // Garante state mínimo para que qualquer função de render não quebre
    if (typeof window.state === 'undefined' || window.state === null || typeof window.state !== 'object') {
      window.state = {
        consultas:   [],
        tasks:       [],
        dateTasks:   {},
        folders:     [],
        folderOrder: []
      };
      console.warn('[bootFix] state ausente — objeto mínimo injetado');
    }

    // Render das pastas (folderGrid)
    safeCall('renderFolders',       window.renderFolders);
    // Render da faixa semanal (weekStrip)
    safeCall('renderWeekStrip',     window.renderWeekStrip);
    // Sincroniza consultas no calendário (agenda.js)
    safeCall('atualizarCalendario', window.atualizarCalendario);
    // Restaura barra de busca na home
    safeCall('atualizarLupa',       window.atualizarLupa, ['home']);
  }

  document.addEventListener('DOMContentLoaded', function () {

    // Boot primário: 100 ms após DOM pronto
    setTimeout(forceUIBoot, 100);

    // Fallback de 1s: verifica se os elementos principais têm conteúdo
    setTimeout(function () {
      var strip   = document.getElementById('weekStrip');
      var folders = document.getElementById('folderGrid');
      var stripEmpty   = strip   && strip.children.length === 0;
      var foldersEmpty = folders && folders.children.length === 0;

      if (stripEmpty || foldersEmpty) {
        console.warn('[bootFix] UI vazia detectada após 1s — forçando recuperação');
        forceUIBoot();
      }
    }, 1000);

  });

})();
