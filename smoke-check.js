#!/usr/bin/env node
/**
 * Smoke check rápido para evitar regressões óbvias.
 * - Verifica presença de arquivos críticos
 * - Garante que funções-chave existem em index.html
 */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'sw.js',
  'storage.js',
  'stateManager.js',
  'sync.js',
  'wallpapers.js',
  'feriadosES.js'
];

const requiredSnippets = [
  'function init()',
  'function openVersionStatus()',
  'function openWallpaperCatalog()',
  'function checkBackupReminder()',
  'function _runMigrations(s)',
  'const APP_BUILD_VERSION',
  'const SW_BUILD_VERSION = APP_BUILD_VERSION'
];

let failed = false;

function fail(msg) {
  failed = true;
  console.error('❌ ' + msg);
}

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) fail(`Arquivo crítico ausente: ${rel}`);
}

const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) {
  fail('index.html ausente');
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const snippet of requiredSnippets) {
    if (!html.includes(snippet)) {
      fail(`Trecho obrigatório não encontrado em index.html: ${snippet}`);
    }
  }
}

if (failed) {
  console.error('\nSmoke check falhou.');
  process.exit(1);
}

console.log('✅ Smoke check passou.');
