/**
 * pwaRescue.js — Recuperação automática para PWA desatualizado/quebrado.
 * Objetivo: quando o app abrir com scripts inconsistentes (botões/handlers mortos),
 * forçar uma recuperação segura sem exigir ação manual do usuário.
 */
(function () {
  'use strict';

  var CACHE_PREFIX = 'agenda-cache-';
  var SESSION_FLAG = '__agenda_pwa_recover_done__';
  var RECOVER_PARAM = '_pwa_recover';

  function _log() {
    try { console.warn.apply(console, ['[PWA-RESCUE]'].concat([].slice.call(arguments))); } catch (_) {}
  }

  function _setSessionRecovered() {
    try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch (_) {}
  }

  function _alreadyRecoveredThisSession() {
    try { return sessionStorage.getItem(SESSION_FLAG) === '1'; } catch (_) { return false; }
  }

  function _markBootHealthy() {
    try { localStorage.setItem('agenda_last_boot_ok', String(Date.now())); } catch (_) {}
  }

  function _reloadWithBypass(reason) {
    _setSessionRecovered();
    _log('Reload forçado. Motivo:', reason);
    try {
      var url = new URL(window.location.href);
      url.searchParams.set(RECOVER_PARAM, String(Date.now()));
      window.location.replace(url.toString());
    } catch (_) {
      window.location.reload();
    }
  }

  function _clearAppCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      var toDelete = keys.filter(function (k) { return String(k).indexOf(CACHE_PREFIX) === 0; });
      return Promise.all(toDelete.map(function (k) { return caches.delete(k); }));
    }).catch(function () {});
  }

  function _unregisterServiceWorkers() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    }).catch(function () {});
  }

  var AUTO_RECOVERY_ENABLED = false; // modo tradicional: apenas recuperação manual

  function hardRecover(reason) {
    if (_alreadyRecoveredThisSession()) {
      _log('Recuperação já executada nesta sessão. Ignorando:', reason);
      return;
    }
    _log('Iniciando recuperação automática:', reason);
    Promise.resolve()
      .then(_unregisterServiceWorkers)
      .then(_clearAppCaches)
      .finally(function () { _reloadWithBypass(reason); });
  }

  function _missingCriticalGlobals() {
    var missing = [];
    var mustHaveFns = [
      'init',
      'renderFolders',
      'renderWeekStrip',
      'openSettings',
      'openSidebar',
      'save'
    ];
    for (var i = 0; i < mustHaveFns.length; i++) {
      var fn = mustHaveFns[i];
      if (typeof window[fn] !== 'function') missing.push(fn);
    }
    if (!window.state || typeof window.state !== 'object') missing.push('state');
    return missing;
  }

  function _watchBootHealth() {
    // Janela de estabilização do boot: evita falso positivo em dispositivos lentos.
    setTimeout(function () {
      if (window.__APP_PRIMARY_BOOT_DONE === true) {
        _markBootHealthy();
        return;
      }
      var missing = _missingCriticalGlobals();
      if (missing.length > 0) {
        hardRecover('boot_incompleto:' + missing.join(','));
      }
    }, 6500);
  }

  // Recurso de script local falhou (ex.: arquivo não carregou).
  // Em modo tradicional, não recupera automaticamente para evitar efeitos colaterais.
  window.addEventListener('error', function (evt) {
    if (!AUTO_RECOVERY_ENABLED) return;
    try {
      var t = evt && evt.target;
      if (!t || t.tagName !== 'SCRIPT' || !t.src) return;
      var sameOrigin = t.src.indexOf(window.location.origin) === 0;
      if (sameOrigin) hardRecover('script_load_fail');
    } catch (_) {}
  }, true);

  // Exposição opcional para chamadas de emergência em outros módulos.
  window.__pwaHardRecover = hardRecover;

  // Se já veio de uma URL com _pwa_recover, evita loop.
  try {
    var currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(RECOVER_PARAM)) _setSessionRecovered();
  } catch (_) {}

  if (AUTO_RECOVERY_ENABLED) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _watchBootHealth, { once: true });
    } else {
      _watchBootHealth();
    }
  }
})();
