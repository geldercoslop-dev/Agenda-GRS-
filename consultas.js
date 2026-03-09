/**
 * consultas.js — CRUD de Consultas
 * Agenda GRS — Lógica de persistência e sincronização de consultas
 * As funções aqui documentam responsabilidades separadas do index.html
 */

/**
 * Funções disponíveis no escopo global (index.html):
 * - openConsultaModal(editId?)   → formulário de criação/edição
 * - openListaConsultas()         → tela de relatório/lista
 * - atualizarConsulta(id, campos) → salvar edição + sincronizar calendário/alertas
 * - _abrirMiniRelatorio(id)      → modal de detalhes editável inline
 * - editConsulta(id)             → atalho para openConsultaModal em modo edição
 * - deleteConsulta(id)           → exclusão com undo
 * - compartilharConsultaWhatsApp(id) → share via WhatsApp
 */
