/**
 * core/validators.js — Validação Centralizada
 * Agenda Pro Max — Proteção contra dados inválidos antes de inserção/atualização
 *
 * Funções exportadas como globais (compatível com arquitetura sem bundler):
 *   validateConsulta(consulta)  → { valid: bool, errors: string[] }
 *   validateTask(task)          → { valid: bool, errors: string[] }
 *   validateDate(dateStr)       → { valid: bool, errors: string[] }
 */

// ── validateDate ──────────────────────────────────────────────────
// Valida string de data no formato YYYY-MM-DD
function validateDate(dateStr) {
  var errors = [];
  if (!dateStr || typeof dateStr !== 'string') {
    errors.push('Data ausente ou inválida.');
    return { valid: false, errors: errors };
  }
  var parts = dateStr.split('-');
  if (parts.length !== 3) {
    errors.push('Formato de data inválido (esperado YYYY-MM-DD): ' + dateStr);
    return { valid: false, errors: errors };
  }
  var y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) {
    errors.push('Data fora dos limites válidos: ' + dateStr);
    return { valid: false, errors: errors };
  }
  return { valid: true, errors: [] };
}

// ── validateConsulta ──────────────────────────────────────────────
// Campos obrigatórios: paciente, data, hora
function validateConsulta(consulta) {
  var errors = [];
  if (!consulta || typeof consulta !== 'object') {
    errors.push('Consulta inválida: objeto ausente.');
    return { valid: false, errors: errors };
  }
  if (!consulta.paciente || !String(consulta.paciente).trim()) {
    errors.push('Campo obrigatório ausente: paciente.');
  }
  if (!consulta.data || !String(consulta.data).trim()) {
    errors.push('Campo obrigatório ausente: data.');
  } else {
    var dateResult = validateDate(consulta.data);
    if (!dateResult.valid) errors = errors.concat(dateResult.errors);
  }
  if (!consulta.hora || !String(consulta.hora).trim()) {
    errors.push('Campo obrigatório ausente: hora.');
  }
  if (errors.length > 0) {
    console.error('[validateConsulta] Dados inválidos:', errors, consulta);
    return { valid: false, errors: errors };
  }
  return { valid: true, errors: [] };
}

// ── validateTask ──────────────────────────────────────────────────
// Campo obrigatório: text (não vazio)
function validateTask(task) {
  var errors = [];
  if (!task || typeof task !== 'object') {
    errors.push('Tarefa inválida: objeto ausente.');
    return { valid: false, errors: errors };
  }
  if (!task.text || !String(task.text).trim()) {
    errors.push('Campo obrigatório ausente: text.');
  }
  if (errors.length > 0) {
    console.error('[validateTask] Dados inválidos:', errors, task);
    return { valid: false, errors: errors };
  }
  return { valid: true, errors: [] };
}
