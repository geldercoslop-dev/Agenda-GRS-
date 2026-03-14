/**
 * core/logger.js — Sistema Centralizado de LOG
 * Agenda Pro Max — Rastreabilidade de erros e diagnóstico
 *
 * Funções globais disponíveis após carregamento:
 *   AppLog.log(origem, mensagem, ...dados)
 *   AppLog.warn(origem, mensagem, ...dados)
 *   AppLog.error(origem, mensagem, ...dados)
 *
 * Formato de saída:
 *   [LOG]   2026-03-14 14:32:01  agenda.js        mensagem
 *   [WARN]  2026-03-14 14:32:01  consultas.js     consulta sem hora
 *   [ERROR] 2026-03-14 14:32:01  sync.js          falha ao sincronizar
 *
 * Histórico em memória disponível via AppLog.history (últimas 200 entradas).
 * Exportável para diagnóstico via AppLog.export().
 */

var AppLog = (function () {
  'use strict';

  var MAX_HISTORY = 200;
  var _history = [];

  // ── Formata timestamp legível ─────────────────────────────────
  function _ts() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return (
      d.getFullYear() + '-' +
      pad(d.getMonth() + 1) + '-' +
      pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes()) + ':' +
      pad(d.getSeconds())
    );
  }

  // ── Formata coluna de origem com padding fixo ─────────────────
  function _padOrigin(s) {
    var str = String(s || 'app');
    return str.length < 20 ? str + ' '.repeat(20 - str.length) : str.slice(0, 20);
  }

  // ── Registra entrada no histórico em memória ──────────────────
  function _record(level, origem, msg, extra) {
    var entry = { ts: _ts(), level: level, origem: String(origem), msg: String(msg), extra: extra };
    _history.push(entry);
    if (_history.length > MAX_HISTORY) _history.shift();
    return entry;
  }

  // ── Formata linha para console ────────────────────────────────
  function _line(level, origem, msg) {
    return '[' + level + '] ' + _ts() + '  ' + _padOrigin(origem) + '  ' + msg;
  }

  // ── API pública ───────────────────────────────────────────────

  function log(origem, msg) {
    var extra = Array.prototype.slice.call(arguments, 2);
    _record('LOG', origem, msg, extra);
    if (extra.length) console.log(_line('LOG  ', origem, msg), extra);
    else              console.log(_line('LOG  ', origem, msg));
  }

  function warn(origem, msg) {
    var extra = Array.prototype.slice.call(arguments, 2);
    _record('WARN', origem, msg, extra);
    if (extra.length) console.warn(_line('WARN ', origem, msg), extra);
    else              console.warn(_line('WARN ', origem, msg));
  }

  function error(origem, msg) {
    var extra = Array.prototype.slice.call(arguments, 2);
    _record('ERROR', origem, msg, extra);
    if (extra.length) console.error(_line('ERROR', origem, msg), extra);
    else              console.error(_line('ERROR', origem, msg));
  }

  // ── Exporta histórico como texto para diagnóstico ─────────────
  function exportLog() {
    return _history.map(function (e) {
      var line = '[' + e.level + '] ' + e.ts + '  ' + _padOrigin(e.origem) + '  ' + e.msg;
      if (e.extra && e.extra.length) {
        try { line += '  ' + JSON.stringify(e.extra); } catch (_) {}
      }
      return line;
    }).join('\n');
  }

  // ── Atalho: baixa histórico como arquivo .txt ─────────────────
  function download() {
    var text = exportLog();
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'agenda-log-' + new Date().toISOString().slice(0, 10) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    log:     log,
    warn:    warn,
    error:   error,
    export:  exportLog,
    download: download,
    get history() { return _history.slice(); }
  };
}());
