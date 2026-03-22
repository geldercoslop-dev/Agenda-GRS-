/**
 * core/state.js — Estado Global Centralizado
 * Agenda Pro Max — Fonte única de verdade para o estado da aplicação
 *
 * Este arquivo deve ser carregado ANTES de todos os outros scripts.
 * O estado é exposto como variável global `state` para compatibilidade
 * com a arquitetura existente (sem bundler / sem ES modules).
 */

// ── Estado global principal ──
// Inicializado vazio; preenchido por load() na inicialização do app.
var state = {
  consultas: [],
  dateTasks: {},
  tasks: {},
  remedios: [],
  folders: [],
  folderOrder: [],
  homeFolders: null,
  theme: 'dark',
  userName: 'Usuário',
  weekStartISO: '',
  profilePhoto: null,
  watermarkPhoto: null,
  wallpaperPhoto: null,
  bucketPhotos: {},
  lastManualVarrerWeek: null,
  lastAutoVarrerWeek: null,
  lastDailyReviewDate: null
};
