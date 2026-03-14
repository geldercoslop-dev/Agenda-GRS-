/**
 * core/sanitizer.js — Sanitização Centralizada
 * Agenda Pro Max — Proteção contra XSS e dados maliciosos
 *
 * Exposto como globais (compatível com arquitetura sem bundler):
 *   sanitizeStr(str, maxLen?)   → string limpa, sem tags HTML
 *   sanitizeFolder(obj)         → sanitiza campos de pasta
 *   sanitizeConsulta(obj)       → sanitiza campos de consulta
 *   sanitizeTask(obj)           → sanitiza campo text de tarefa
 *   sanitizeImportData(obj)     → sanitiza state inteiro vindo de import
 */

// ── Comprimentos máximos por campo (prevenção de DoS por string enorme) ──
var _LIMITS = {
  folderName:   80,
  folderEmoji:  10,
  taskText:     500,
  paciente:     120,
  especialidade:120,
  medico:       120,
  local:        200,
  obs:          1000,
  hora:         10,   // "HH:MM"
  data:         10,   // "YYYY-MM-DD"
  userName:     80
};

/**
 * Remove tags HTML e limita comprimento.
 * Não altera caracteres normais (acentos, emojis, pontuação).
 */
function sanitizeStr(str, maxLen) {
  if (str === null || str === undefined) return '';
  var s = String(str);
  // Remove tags HTML completas (<script>...</script>, <img ...>, etc.)
  s = s.replace(/<[^>]*>/g, '');
  // Remove sequências de entidades HTML perigosas (&#x, &#0 etc.)
  s = s.replace(/&#x[0-9a-fA-F]+;?/gi, '');
  s = s.replace(/&#\d+;?/g, '');
  // Remove javascript: e data: URIs em qualquer capitalização
  s = s.replace(/javascript\s*:/gi, '');
  s = s.replace(/data\s*:\s*text\s*\/\s*html/gi, '');
  // Limita comprimento
  var limit = (typeof maxLen === 'number' && maxLen > 0) ? maxLen : 1000;
  if (s.length > limit) s = s.slice(0, limit);
  return s;
}

/**
 * Sanitiza um objeto pasta antes de salvar no state.
 */
function sanitizeFolder(folder) {
  if (!folder || typeof folder !== 'object') return folder;
  if (typeof folder.name === 'string')  folder.name  = sanitizeStr(folder.name,  _LIMITS.folderName);
  if (typeof folder.emoji === 'string') folder.emoji = sanitizeStr(folder.emoji, _LIMITS.folderEmoji);
  return folder;
}

/**
 * Sanitiza um objeto consulta antes de salvar no state.
 */
function sanitizeConsulta(c) {
  if (!c || typeof c !== 'object') return c;
  if (typeof c.paciente      === 'string') c.paciente      = sanitizeStr(c.paciente,      _LIMITS.paciente);
  if (typeof c.especialidade === 'string') c.especialidade = sanitizeStr(c.especialidade, _LIMITS.especialidade);
  if (typeof c.medico        === 'string') c.medico        = sanitizeStr(c.medico,        _LIMITS.medico);
  if (typeof c.local         === 'string') c.local         = sanitizeStr(c.local,         _LIMITS.local);
  if (typeof c.obs           === 'string') c.obs           = sanitizeStr(c.obs,           _LIMITS.obs);
  if (typeof c.hora          === 'string') c.hora          = sanitizeStr(c.hora,          _LIMITS.hora);
  if (typeof c.data          === 'string') c.data          = sanitizeStr(c.data,          _LIMITS.data);
  return c;
}

/**
 * Sanitiza um objeto tarefa antes de salvar no state.
 */
function sanitizeTask(task) {
  if (!task || typeof task !== 'object') return task;
  if (typeof task.text === 'string') task.text = sanitizeStr(task.text, _LIMITS.taskText);
  return task;
}

/**
 * Sanitiza state inteiro vindo de um import JSON.
 * Percorre tasks, consultas, remedios e folders aplicando sanitização por item.
 * Não altera estrutura — apenas strings dentro dos objetos.
 */
function sanitizeImportData(data) {
  if (!data || typeof data !== 'object') return data;

  // Sanitiza tasks (buckets semanais + pastas)
  if (data.tasks && typeof data.tasks === 'object') {
    for (var bid in data.tasks) {
      var bucket = data.tasks[bid];
      if (Array.isArray(bucket)) {
        data.tasks[bid] = bucket.map(function(t) { return sanitizeTask(t); });
      }
    }
  }

  // Sanitiza dateTasks
  if (data.dateTasks && typeof data.dateTasks === 'object') {
    for (var dk in data.dateTasks) {
      var dBucket = data.dateTasks[dk];
      if (Array.isArray(dBucket)) {
        data.dateTasks[dk] = dBucket.map(function(t) { return sanitizeTask(t); });
      }
    }
  }

  // Sanitiza consultas
  if (Array.isArray(data.consultas)) {
    data.consultas = data.consultas.map(function(c) { return sanitizeConsulta(c); });
  }

  // Sanitiza remedios (text field)
  if (Array.isArray(data.remedios)) {
    data.remedios = data.remedios.map(function(r) { return sanitizeTask(r); });
  }

  // Sanitiza folders
  if (Array.isArray(data.folders)) {
    data.folders = data.folders.map(function(f) { return sanitizeFolder(f); });
  }

  // Sanitiza userName
  if (typeof data.userName === 'string') {
    data.userName = sanitizeStr(data.userName, _LIMITS.userName);
  }

  return data;
}
