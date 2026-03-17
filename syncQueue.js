/**
 * core/syncQueue.js — Fila de Sincronização Offline
 * Agenda Pro Max — Garante que operações feitas offline sejam
 * sincronizadas quando a conexão retornar.
 *
 * API pública (globais):
 *   SyncQueue.enqueue(type, entity, payload)  → adiciona operação na fila
 *   SyncQueue.flush()                         → processa fila (chamado ao ficar online)
 *   SyncQueue.size()                          → qtd de itens pendentes
 *   SyncQueue.peek()                          → retorna cópia da fila (somente leitura)
 *
 * Tipos de operação suportados: 'create' | 'update' | 'delete'
 * Entidades suportadas: 'consulta' | 'task' | 'remedio' | (extensível)
 *
 * A fila é persistida via AppStorage e sobrevive a refresh de página.
 * O processamento é serial (FIFO) e para ao primeiro erro de rede.
 */

var SyncQueue = (function () {
  'use strict';

  // ── Constantes ──────────────────────────────────────────────────
  var STORAGE_KEY  = 'agendaProMax_syncQueue';
  var MAX_QUEUE    = 500;          // limite de segurança contra crescimento infinito
  var MAX_ATTEMPTS = 10;          // máximo de tentativas antes de descartar item com erro
  var RETRY_DELAY  = 5000;        // ms entre tentativas automáticas quando online

  // ── Estado interno ───────────────────────────────────────────────
  var _queue        = [];          // array em memória (fonte de verdade em runtime)
  var _processing   = false;       // mutex: evita processamentos concorrentes
  var _retryTimer   = null;        // handle do setInterval de retry

  // ── Logger seguro (não depende de AppLog estar carregado) ────────
  function _log(level, msg, extra) {
    if (typeof AppLog !== 'undefined') {
      if (extra !== undefined) AppLog[level]('syncQueue.js', msg, extra);
      else                     AppLog[level]('syncQueue.js', msg);
    }
  }

  // ── Persistência ────────────────────────────────────────────────

  function _persist() {
    try {
      AppStorage.set(STORAGE_KEY, _queue);
    } catch (e) {
      _log('warn', 'Falha ao persistir fila no storage', e.message);
    }
  }

  function _load() {
    try {
      var parsed = AppStorage.get(STORAGE_KEY, null);
      if (!Array.isArray(parsed)) return [];
      // Filtra itens malformados que possam ter sobrado de versões anteriores
      return parsed.filter(function (item) {
        return item &&
               typeof item.id        === 'string' &&
               typeof item.type      === 'string' &&
               typeof item.entity    === 'string' &&
               typeof item.timestamp === 'number' &&
               item.payload          !== undefined;
      });
    } catch (e) {
      _log('warn', 'Fila corrompida no storage — reinicializada', e.message);
      return [];
    }
  }

  // ── Gerador de ID único por item da fila ─────────────────────────
  function _qid() {
    return 'sq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── Inicialização: carrega fila do storage ───────────────────────
  function _init() {
    _queue = _load();
    if (_queue.length > 0) {
      _log('log', 'Fila restaurada do storage: ' + _queue.length + ' item(s) pendente(s)');
    }
    _startRetryLoop();
  }

  // ── Enqueue ──────────────────────────────────────────────────────
  /**
   * Adiciona uma operação na fila.
   * @param {'create'|'update'|'delete'} type  - tipo da operação
   * @param {string}                    entity - entidade afetada (ex: 'consulta')
   * @param {object}                    payload - dados necessários para reexecutar a op
   */
  function enqueue(type, entity, payload) {
    if (!type || !entity || payload === undefined) {
      _log('warn', 'enqueue chamado com argumentos inválidos', { type: type, entity: entity });
      return;
    }

    // Limite de segurança
    if (_queue.length >= MAX_QUEUE) {
      _log('warn', 'Fila cheia (' + MAX_QUEUE + ' itens) — item descartado', { type: type, entity: entity });
      return;
    }

    var item = {
      id:        _qid(),
      type:      type,
      entity:    entity,
      payload:   payload,
      timestamp: Date.now(),
      attempts:  0
    };

    _queue.push(item);
    _persist();
    _log('log', 'Item enfileirado: ' + type + ' ' + entity + ' (fila: ' + _queue.length + ')');

    // Se já estiver online, tenta processar imediatamente
    if (navigator.onLine) {
      _scheduleFlush(0);
    }
  }

  // ── Flush ────────────────────────────────────────────────────────
  /**
   * Processa a fila na ordem de inserção (FIFO).
   * Para ao primeiro erro de rede para não perder dados.
   * Itens processados com sucesso são removidos da fila.
   */
  async function flush() {
    if (_processing)          return;   // mutex
    if (_queue.length === 0)  return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (typeof syncPush !== 'function' && typeof syncDelete !== 'function') {
      _log('warn', 'Sistema de sincronização não disponível — flush cancelado');
      return;
    }

    _processing = true;

    // Compacta a fila antes de processar: elimina operações redundantes
    // e reduz o número de chamadas ao servidor sem perder dados.
    var beforeCompact = _queue.length;
    _queue = _compactQueue(_queue);
    var afterCompact  = _queue.length;
    if (beforeCompact !== afterCompact) {
      _persist();
      _log('log', 'Fila compactada: ' + beforeCompact + ' → ' + afterCompact + ' item(s)');
    }

    _log('log', 'Iniciando processamento da fila: ' + _queue.length + ' item(s)');

    var processed = 0;
    var failed    = 0;

    // Itera sobre uma cópia do array para iterar com segurança
    var snapshot = _queue.slice();

    for (var i = 0; i < snapshot.length; i++) {
      var item = snapshot[i];

      // Confirma que o item ainda está na fila (pode ter sido removido por undo)
      var stillInQueue = _queue.findIndex(function (q) { return q.id === item.id; });
      if (stillInQueue < 0) continue;

      try {
        await _executeItem(item);

        // Sucesso: remove da fila
        _queue = _queue.filter(function (q) { return q.id !== item.id; });
        _persist();
        processed++;
        _log('log', 'Item processado com sucesso: ' + item.type + ' ' + item.entity + ' id=' + (item.payload.id || '?'));

      } catch (err) {
        item.attempts = (item.attempts || 0) + 1;
        _persist();

        if (item.attempts >= MAX_ATTEMPTS) {
          _log('warn', 'Item excedeu limite de tentativas — removido da fila', item.id);
          _queue = _queue.filter(function (q) { return q.id !== item.id; });
          _persist();
          continue;
        }

        var isNetworkError = _isNetworkError(err);
        if (isNetworkError) {
          // Erro de rede: para tudo, tentará novamente depois
          _log('warn', 'Erro de rede ao processar fila — processamento pausado', err.message || err);
          failed++;
          break;
        } else {
          // Erro não-rede (ex: item inválido): remove para não bloquear a fila
          _log('warn', 'Erro permanente no item ' + item.id + ' — removido da fila', err.message || err);
          _queue = _queue.filter(function (q) { return q.id !== item.id; });
          _persist();
        }
      }
    }

    _processing = false;

    if (processed > 0 || failed > 0) {
      _log('log', 'Flush concluído: ' + processed + ' processado(s), ' + failed + ' com falha, ' + _queue.length + ' restante(s)');
    }
  }

  // ── Executa um item da fila ──────────────────────────────────────
  async function _executeItem(item) {
    switch (item.entity) {
      case 'consulta':
        return await _execConsulta(item);
      case 'task':
        return await _execTask(item);
      case 'remedio':
        return await _execRemedio(item);
      default:
        throw new Error('Entidade desconhecida: ' + item.entity);
    }
  }

  // ── Handler: consulta ────────────────────────────────────────────
  async function _execConsulta(item) {
    // Delega ao sistema de sync Supabase existente (sync.js)
    // Usa syncPush internamente — o item já deve estar no state com synced=false
    // Esta função valida que o item ainda existe no state antes de tentar push.

    var payload = item.payload || {};

    if (item.type === 'delete') {
      // Para delete, o item já foi removido do state local.
      // Garante que o soft-delete chegue ao servidor.
      if (typeof syncDelete === 'function') {
        await syncDelete('consultas', payload.id || '');
      }
      return;
    }

    // Para create/update: verifica se item ainda existe no state
    if (typeof state === 'undefined' || !Array.isArray(state.consultas)) return;
    var consulta = state.consultas.find(function (c) { return c.id === payload.id; });
    if (!consulta) {
      // Item removido localmente após enqueue — descarta silenciosamente
      _log('log', 'Consulta ' + payload.id + ' não encontrada no state — item da fila descartado');
      return;
    }

    // Marca como pending e executa push
    consulta.synced = false;
    if (typeof syncPush === 'function' && typeof save === 'function') {
      await syncPush(state, save);
    }
  }

  // ── Handler: task ────────────────────────────────────────────────
  async function _execTask(item) {
    var payload = item.payload || {};
    if (item.type === 'delete') {
      if (typeof syncDelete === 'function') {
        await syncDelete('tasks', payload.id || '', payload.bucketId || '');
      }
      return;
    }
    if (typeof syncPush === 'function' && typeof save === 'function') {
      await syncPush(state, save);
    }
  }

  // ── Handler: remédio ─────────────────────────────────────────────
  async function _execRemedio(item) {
    var payload = item.payload || {};
    if (item.type === 'delete') {
      if (typeof syncDelete === 'function') {
        await syncDelete('remedios', payload.id || '');
      }
      return;
    }
    if (typeof syncPush === 'function' && typeof save === 'function') {
      await syncPush(state, save);
    }
  }

  // ── Detecta erro de rede (vs erro de lógica) ─────────────────────
  function _isNetworkError(err) {
    if (!err) return false;
    var msg = String(err.message || err).toLowerCase();
    // Erros de fetch/rede típicos
    if (msg.includes('failed to fetch'))  return true;
    if (msg.includes('network'))          return true;
    if (msg.includes('connection'))       return true;
    if (msg.includes('timeout'))          return true;
    if (msg.includes('offline'))          return true;
    // HTTP 5xx = erro de servidor (temporário)
    if (msg.match(/http 5\d\d/))          return true;
    return false;
  }

  // ── Compactação da fila ──────────────────────────────────────────
  /**
   * _compactQueue(queue)
   *
   * Elimina operações redundantes agrupando por payload.id + entity,
   * mantendo apenas a última operação relevante por item de dados.
   *
   * Regras de compactação (aplicadas por par consecutivo, resolvidas
   * para o estado final de cada id):
   *
   *   create + update → create  (payload do update, tipo create)
   *   create + delete → remover ambos (nunca existiu no servidor)
   *   update + update → manter apenas o último update
   *   update + delete → delete
   *   delete + create → mantém ambos (raro: recria após deleção)
   *
   * Itens sem payload.id válido são preservados sem alteração.
   * A ordem relativa entre entidades/ids diferentes é mantida.
   *
   * @param   {Array} queue  — cópia da fila a ser compactada
   * @returns {Array}        — fila compactada (novo array)
   */
  function _compactQueue(queue) {
    if (!Array.isArray(queue) || queue.length <= 1) return queue;

    // Chave de agrupamento: entity + payload.id (separa entidades distintas)
    function _key(item) {
      var pid = item.payload && item.payload.id ? item.payload.id : null;
      if (!pid) return null;  // item sem id: não participa da compactação
      return item.entity + '::' + pid;
    }

    // Tabela de resolução: dado o tipo existente e o tipo novo, qual tipo final?
    // null → remover ambos
    var _resolve = {
      'create:update': 'create',   // create + update → create (payload mais recente)
      'create:delete': null,       // create + delete → remover ambos (nunca chegou ao servidor)
      'update:update': 'update',   // update + update → último update
      'update:delete': 'delete',   // update + delete → delete
      'delete:create': 'create'    // delete + create → create (novo registro substitui o delete)
    };

    // Algoritmo: percorre a fila mantendo um ciclo por chave.
    // Cada ciclo tem exatamente um estado final (tipo + item ou removed=true).
    // Estrutura por chave: [{ type, item, removed }] — sempre 1 entrada.
    var cycles = {};

    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      var key  = _key(item);

      if (!key) continue;  // sem id: será preservado na segunda passagem

      if (!cycles[key]) {
        cycles[key] = [{ type: item.type, item: item, removed: false }];
      } else {
        var cycleArr = cycles[key];
        var cur      = cycleArr[cycleArr.length - 1];  // ciclo ativo (último)
        var pair     = cur.type + ':' + item.type;
        var resolved = _resolve[pair];

        if (resolved === null) {
          cur.removed = true;   // create + delete → descarta

        } else if (resolved !== undefined) {
          cur.type = resolved;
          cur.item = Object.assign({}, item, { type: resolved });

        } else {
          // Par não mapeado: mantém o item mais recente
          cur.type = item.type;
          cur.item = item;
        }
      }
    }

    // Segunda passagem: reconstrói a fila mantendo ordem de primeira aparição.
    // Cada chave tem exatamente 1 ciclo — emite na primeira ocorrência.
    var seen   = {};
    var result = [];

    for (var j = 0; j < queue.length; j++) {
      var cur2 = queue[j];
      var k    = _key(cur2);

      // Itens sem id: sempre preservados na posição original
      if (!k) {
        result.push(cur2);
        continue;
      }

      // Emite apenas na primeira ocorrência do key
      if (seen[k]) continue;
      seen[k] = true;

      var cyc = cycles[k];
      if (!cyc || cyc[0].removed) continue;
      result.push(cyc[0].item);
    }

    return result;
  }

  // ── Agendamento de flush ─────────────────────────────────────────
  function _scheduleFlush(delayMs) {
    setTimeout(function () {
      flush().catch(function (e) {
        _log('warn', 'Erro inesperado no flush agendado', e.message || e);
      });
    }, delayMs || 0);
  }

  // ── Loop de retry automático ─────────────────────────────────────
  function _startRetryLoop() {
    if (_retryTimer) return;
    _retryTimer = setInterval(function () {
      if (_queue.length > 0 && navigator.onLine) {
        _scheduleFlush(0);
      }
    }, RETRY_DELAY);
  }

  // ── Listener de reconexão ────────────────────────────────────────
  if (typeof window !== 'undefined') {
    window.addEventListener('online', function () {
      if (_queue.length > 0) {
        _log('log', 'Conexão restaurada — processando fila: ' + _queue.length + ' item(s)');
        _scheduleFlush(300);  // pequeno delay para a rede estabilizar
      }
    });
  }

  // ── API pública ──────────────────────────────────────────────────
  function size()  { return _queue.length; }
  function peek()  { return _queue.slice(); }  // cópia somente leitura

  // Inicializa ao carregar
  _init();

  return {
    enqueue: enqueue,
    flush:   flush,
    size:    size,
    peek:    peek
  };

}());
