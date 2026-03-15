/**
 * core/storage.js — Camada Centralizada de Armazenamento
 * Agenda Pro Max — Toda leitura/gravação passa por aqui.
 *
 * ARQUITETURA DUAL-WRITE:
 *
 *   Leitura  → sempre do cache em memória (_memCache), alimentado no boot.
 *   Escrita  → síncrona no localStorage (garante persistência imediata) +
 *              assíncrona no IndexedDB em background (maior capacidade, melhor performance).
 *   Boot     → tenta carregar do IndexedDB primeiro; se vazio, carrega do localStorage
 *              (migração automática); falha silenciosa → só localStorage.
 *
 * Por que dual-write e não IndexedDB puro:
 *   A API pública (set, get, saveState, loadState) é chamada de forma síncrona em
 *   ~50 pontos do app (click handlers, drag, edição inline, boot). Tornar esses
 *   callers assíncronos exigiria refatorar toda a arquitetura. O dual-write mantém
 *   a API síncrona intacta enquanto progressivamente move os dados para IndexedDB.
 *
 * API pública (globais — idêntica à versão anterior):
 *   AppStorage.saveState(stateObj)         → salva state principal + fotos
 *   AppStorage.loadState()                 → carrega state principal + fotos
 *   AppStorage.clearState()                → remove state principal e fotos
 *   AppStorage.set(key, value)             → gravação genérica
 *   AppStorage.get(key, fallback)          → leitura genérica
 *   AppStorage.remove(key)                 → remoção por chave
 *   AppStorage.keys(prefix?)              → lista chaves
 *   AppStorage.isStorageAvailable()        → boolean — localStorage operacional
 *   AppStorage.usingMemoryFallback         → boolean — modo memória ativo
 *   AppStorage.idbReady                    → Promise — resolvida quando IDB está pronto
 */

var AppStorage = (function () {
  'use strict';

  // ── Chaves principais ────────────────────────────────────────────
  var KEY_STATE  = 'agendaProMax';
  var KEY_PHOTOS = 'agendaProMax_photos';

  // ── Configuração IndexedDB ───────────────────────────────────────
  var IDB_NAME    = 'agendaProMaxDB';
  var IDB_VERSION = 1;
  var IDB_STORE   = 'appStorage';

  // ════════════════════════════════════════════════════════════════
  // DETECÇÃO DE DISPONIBILIDADE (localStorage — fallback síncrono)
  // ════════════════════════════════════════════════════════════════

  function isStorageAvailable() {
    try {
      var probe = '__appStorage_probe_' + Date.now();
      localStorage.setItem(probe, '1');
      var ok = localStorage.getItem(probe) === '1';
      localStorage.removeItem(probe);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ── Armazenamento em memória (fallback quando localStorage indisponível) ──
  var _mem       = {};
  var _usingMemory = false;

  (function _init() {
    if (!isStorageAvailable()) {
      _usingMemory = true;
      function _emitWarn() {
        if (typeof AppLog !== 'undefined') {
          AppLog.warn(
            'storage.js',
            'localStorage indisponível, usando memória',
            'Dados não serão persistidos entre sessões.'
          );
        } else {
          console.warn('[storage.js] localStorage indisponível, usando memória.');
        }
      }
      if (typeof AppLog !== 'undefined') _emitWarn();
      else setTimeout(_emitWarn, 0);
    }
  }());

  // ════════════════════════════════════════════════════════════════
  // BACKEND SÍNCRONO (localStorage ou _mem)
  // Garante persistência imediata em todas as escritas.
  // ════════════════════════════════════════════════════════════════

  function _syncSet(key, serialized) {
    if (_usingMemory) { _mem[key] = serialized; return true; }
    try { localStorage.setItem(key, serialized); return true; }
    catch (e) { _log('error', '_syncSet', 'Erro ao gravar no localStorage — chave: ' + key, e.message); return false; }
  }

  function _syncGet(key) {
    if (_usingMemory) return Object.prototype.hasOwnProperty.call(_mem, key) ? _mem[key] : null;
    try { return localStorage.getItem(key); }
    catch (e) { _log('error', '_syncGet', 'Erro ao ler do localStorage — chave: ' + key, e.message); return null; }
  }

  function _syncRemove(key) {
    if (_usingMemory) { delete _mem[key]; return; }
    try { localStorage.removeItem(key); }
    catch (e) { _log('error', '_syncRemove', 'Erro ao remover do localStorage — chave: ' + key, e.message); }
  }

  function _syncKeys() {
    if (_usingMemory) return Object.keys(_mem);
    try { return Object.keys(localStorage); }
    catch (e) { _log('error', '_syncKeys', 'Erro ao listar chaves', e.message); return []; }
  }

  // ════════════════════════════════════════════════════════════════
  // BACKEND IndexedDB (async, background)
  // ════════════════════════════════════════════════════════════════

  var _idb         = null;   // instância IDBDatabase
  var _idbAvailable = false;

  // Promessa pública: resolvida quando IDB está pronto (ou falhou)
  var _idbReadyResolve;
  var idbReady = new Promise(function (resolve) {
    _idbReadyResolve = resolve;
  });

  /**
   * Abre o banco IndexedDB. Chamado uma vez no boot.
   * Resolve idbReady independentemente de sucesso ou falha.
   */
  function _idbOpen() {
    if (!('indexedDB' in window) || !window.indexedDB) {
      _log('log', '_idbOpen', 'IndexedDB não disponível neste ambiente');
      _idbReadyResolve(false);
      return;
    }

    try {
      var req = window.indexedDB.open(IDB_NAME, IDB_VERSION);

      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };

      req.onsuccess = function (e) {
        _idb = e.target.result;
        _idbAvailable = true;
        _log('log', '_idbOpen', 'IndexedDB aberto com sucesso: ' + IDB_NAME + ' v' + IDB_VERSION);

        // Migra dados do localStorage para o IDB (só na primeira abertura — verifica se IDB está vazio)
        _idbMigrateFromLocalStorage();

        // Inicia verificação periódica de consistência cache ↔ IDB
        _startConsistencyLoop();

        _idbReadyResolve(true);
      };

      req.onerror = function (e) {
        _log('warn', '_idbOpen', 'Falha ao abrir IndexedDB — usando localStorage', e.target.error);
        _idbReadyResolve(false);
      };

      req.onblocked = function () {
        _log('warn', '_idbOpen', 'IndexedDB bloqueado por outra aba — aguardando');
      };
    } catch (e) {
      _log('warn', '_idbOpen', 'Exceção ao abrir IndexedDB', e.message);
      _idbReadyResolve(false);
    }
  }

  /**
   * Migra dados do localStorage para o IndexedDB na primeira abertura.
   * Copia todas as chaves com prefixo 'agendaProMax' que ainda não existam no IDB.
   * Operação silenciosa — falha não afeta o sistema.
   */
  function _idbMigrateFromLocalStorage() {
    if (!_idbAvailable || _usingMemory) return;
    try {
      var keys = [];
      try { keys = Object.keys(localStorage).filter(function (k) { return k.startsWith('agendaProMax'); }); }
      catch (e) { return; }

      if (keys.length === 0) return;

      var tx = _idb.transaction(IDB_STORE, 'readwrite');
      var store = tx.objectStore(IDB_STORE);
      var migrated = 0;

      keys.forEach(function (key) {
        // Verifica se já existe no IDB antes de migrar
        var checkReq = store.get(key);
        checkReq.onsuccess = function () {
          if (checkReq.result === undefined) {
            // Não existe: migra
            var raw = null;
            try { raw = localStorage.getItem(key); } catch (e) {}
            if (raw !== null) {
              store.put({ key: key, value: raw });
              migrated++;
            }
          }
        };
      });

      tx.oncomplete = function () {
        if (migrated > 0) {
          _log('log', '_idbMigrate', 'Migrados ' + migrated + ' item(s) do localStorage para IndexedDB');
        }
      };
      tx.onerror = function (e) {
        _log('warn', '_idbMigrate', 'Erro na migração', e.target.error);
      };
    } catch (e) {
      _log('warn', '_idbMigrate', 'Exceção na migração', e.message);
    }
  }

  /**
   * Grava no IndexedDB em background (fire-and-forget).
   * Falha silenciosa — localStorage já garantiu a persistência.
   */
  function _idbSet(key, serialized) {
    if (!_idbAvailable || !_idb) return;
    try {
      var tx    = _idb.transaction(IDB_STORE, 'readwrite');
      var store = tx.objectStore(IDB_STORE);
      store.put({ key: key, value: serialized });
      tx.onerror = function (e) {
        _log('warn', '_idbSet', 'Erro ao gravar no IDB — chave: ' + key, e.target.error);
      };
    } catch (e) {
      _log('warn', '_idbSet', 'Exceção ao gravar no IDB', e.message);
    }
  }

  /**
   * Remove do IndexedDB em background.
   */
  function _idbRemove(key) {
    if (!_idbAvailable || !_idb) return;
    try {
      var tx    = _idb.transaction(IDB_STORE, 'readwrite');
      var store = tx.objectStore(IDB_STORE);
      store.delete(key);
      tx.onerror = function (e) {
        _log('warn', '_idbRemove', 'Erro ao remover do IDB — chave: ' + key, e.target.error);
      };
    } catch (e) {
      _log('warn', '_idbRemove', 'Exceção ao remover do IDB', e.message);
    }
  }

  /**
   * Lê uma chave do IndexedDB.
   * Retorna Promise<string|null>.
   * Usado apenas no boot para verificar se IDB tem dados mais recentes.
   */
  function _idbGet(key) {
    return new Promise(function (resolve) {
      if (!_idbAvailable || !_idb) { resolve(null); return; }
      try {
        var tx    = _idb.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var req   = store.get(key);
        req.onsuccess = function () {
          resolve(req.result ? req.result.value : null);
        };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  /**
   * Lista todas as chaves do IndexedDB.
   * Retorna Promise<string[]>.
   */
  function _idbKeys() {
    return new Promise(function (resolve) {
      if (!_idbAvailable || !_idb) { resolve([]); return; }
      try {
        var tx    = _idb.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var req   = store.getAllKeys();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror   = function () { resolve([]); };
      } catch (e) { resolve([]); }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // VERIFICAÇÃO PERIÓDICA DE CONSISTÊNCIA (cache ↔ IndexedDB)
  // ════════════════════════════════════════════════════════════════

  var CONSISTENCY_INTERVAL = 5 * 60 * 1000;  // 5 minutos em ms
  var _consistencyTimer    = null;

  /**
   * Hash DJB2 simples sobre uma string.
   * Não requer crypto.subtle — funciona de forma síncrona em qualquer contexto.
   * Usado apenas para comparação de igualdade, não para segurança.
   *
   * @param   {string} str
   * @returns {number} hash de 32 bits sem sinal
   */
  function _hashStr(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
      hash = hash >>> 0;  // mantém sem sinal
    }
    return hash;
  }

  /**
   * Lê todos os valores das chaves agendaProMax* do IDB de uma vez.
   * Retorna Promise<Object> — mapa { key: serializedString }.
   */
  function _idbSnapshot() {
    return new Promise(function (resolve) {
      if (!_idbAvailable || !_idb) { resolve({}); return; }
      try {
        var tx    = _idb.transaction(IDB_STORE, 'readonly');
        var store = tx.objectStore(IDB_STORE);
        var req   = store.getAll();
        req.onsuccess = function () {
          var snap = {};
          (req.result || []).forEach(function (entry) {
            if (entry.key && entry.key.startsWith('agendaProMax')) {
              snap[entry.key] = entry.value;
            }
          });
          resolve(snap);
        };
        req.onerror = function () { resolve({}); };
      } catch (e) { resolve({}); }
    });
  }

  /**
   * Coleta snapshot do cache síncrono (localStorage / _mem)
   * para as chaves com prefixo agendaProMax.
   *
   * @returns {Object} mapa { key: serializedString }
   */
  function _syncSnapshot() {
    var snap = {};
    try {
      var allKeys = _syncKeys().filter(function (k) { return k.startsWith('agendaProMax'); });
      allKeys.forEach(function (k) {
        var v = _syncGet(k);
        if (v !== null) snap[k] = v;
      });
    } catch (e) {
      _log('warn', '_syncSnapshot', 'Erro ao coletar snapshot do cache', e.message);
    }
    return snap;
  }

  /**
   * Compara hash do cache com hash do IDB para cada chave.
   * Chaves divergentes ou ausentes no IDB são regravadas (resync).
   *
   * Fonte de verdade: cache síncrono (localStorage / _mem).
   * O IDB é o espelho — quem diverge é sempre o IDB.
   */
  async function _consistencyCheck() {
    if (!_idbAvailable) return;

    var cacheSnap = _syncSnapshot();
    var idbSnap   = await _idbSnapshot();

    var cacheKeys = Object.keys(cacheSnap).sort();
    var idbKeys2  = Object.keys(idbSnap).sort();

    // Hash do snapshot inteiro de cada lado (chaves + valores em ordem)
    var cachePayload = cacheKeys.map(function (k) { return k + '=' + cacheSnap[k]; }).join('|');
    var idbPayload   = idbKeys2.map(function (k) { return k + '=' + idbSnap[k]; }).join('|');

    var cacheHash = _hashStr(cachePayload);
    var idbHash   = _hashStr(idbPayload);

    if (cacheHash === idbHash) {
      _log('log', '_consistencyCheck', 'Cache ↔ IDB consistentes (hash=' + cacheHash + ')');
      return;
    }

    // ── Divergência detectada: identifica chaves específicas ────────
    var divergent = [];

    // Chaves presentes no cache mas ausentes ou diferentes no IDB
    cacheKeys.forEach(function (k) {
      if (cacheSnap[k] !== idbSnap[k]) divergent.push(k);
    });

    // Chaves presentes no IDB mas ausentes no cache (órfãs — não deveriam existir)
    idbKeys2.forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(cacheSnap, k)) {
        divergent.push(k);
      }
    });

    // Remove duplicatas
    divergent = divergent.filter(function (k, i, a) { return a.indexOf(k) === i; });

    _log('warn', '_consistencyCheck',
      'Divergência detectada entre cache e IDB — ' + divergent.length + ' chave(s) divergente(s)',
      divergent.join(', ')
    );

    // ── Resync: regrava no IDB as chaves divergentes ────────────────
    // Fonte de verdade = cache síncrono (localStorage)
    var resynced = 0;
    divergent.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(cacheSnap, k)) {
        // Chave existe no cache → regrava no IDB
        _idbSet(k, cacheSnap[k]);
        resynced++;
      } else {
        // Chave órfã no IDB (não existe no cache) → remove do IDB
        _idbRemove(k);
        resynced++;
      }
    });

    _log('warn', '_consistencyCheck',
      'Resync concluído: ' + resynced + ' chave(s) corrigida(s) no IDB'
    );
  }

  /**
   * Inicia o loop de verificação periódica.
   * Chamado após _idbOpen resolver com sucesso.
   * Não inicia se IDB não estiver disponível.
   */
  function _startConsistencyLoop() {
    if (_consistencyTimer) return;  // já iniciado
    if (!_idbAvailable) return;

    _consistencyTimer = setInterval(function () {
      _consistencyCheck().catch(function (e) {
        _log('warn', '_consistencyCheck', 'Erro inesperado na verificação de consistência', e.message || e);
      });
    }, CONSISTENCY_INTERVAL);

    _log('log', '_startConsistencyLoop',
      'Verificação periódica de consistência iniciada (intervalo: ' + (CONSISTENCY_INTERVAL / 60000) + ' min)'
    );
  }

  // ── Inicia abertura do IDB assim que o módulo é carregado ────────
  // Não bloqueia — o sistema continua funcionando com localStorage enquanto espera.
  (function () {
    if (typeof window !== 'undefined') {
      // Pequeno delay para não competir com o boot crítico
      setTimeout(_idbOpen, 0);
    }
  }());

  // ════════════════════════════════════════════════════════════════
  // HELPERS INTERNOS
  // ════════════════════════════════════════════════════════════════

  function _log(level, fn, msg, extra) {
    if (typeof AppLog !== 'undefined') {
      AppLog[level]('storage.js/' + fn, msg, extra !== undefined ? extra : '');
    }
  }

  function _serialize(value) {
    try { return JSON.stringify(value); }
    catch (e) { _log('error', '_serialize', 'Falha ao serializar valor', e.message); return null; }
  }

  function _deserialize(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    try { return JSON.parse(raw); }
    catch (e) { _log('error', '_deserialize', 'JSON corrompido — usando fallback', e.message); return fallback; }
  }

  function _validateState(s) {
    var errors = [];
    if (!s || typeof s !== 'object') { errors.push('state não é objeto'); return errors; }
    if (!Array.isArray(s.consultas)) errors.push('consultas não é array');
    if (!Array.isArray(s.folders))   errors.push('folders não é array');
    if (!Array.isArray(s.remedios))  errors.push('remedios não é array');
    if (!s.tasks || typeof s.tasks !== 'object' || Array.isArray(s.tasks)) errors.push('tasks não é objeto');
    if (s.dateTasks !== undefined && s.dateTasks !== null &&
        (typeof s.dateTasks !== 'object' || Array.isArray(s.dateTasks))) errors.push('dateTasks não é objeto');
    return errors;
  }

  // ════════════════════════════════════════════════════════════════
  // API PRINCIPAL — síncrona, dual-write em background para IDB
  // ════════════════════════════════════════════════════════════════

  function saveState(stateObj) {
    var errors = _validateState(stateObj);
    if (errors.length > 0) {
      _log('error', 'saveState', 'State inválido — gravação bloqueada: ' + errors.join(', '));
      return false;
    }

    var photos = stateObj.bucketPhotos || {};
    var stateWithoutPhotos = Object.assign({}, stateObj, { bucketPhotos: null });

    var serialized = _serialize(stateWithoutPhotos);
    if (serialized === null) return false;

    // Escrita síncrona (garantia imediata)
    var ok = _syncSet(KEY_STATE, serialized);
    if (!ok) { _log('error', 'saveState', 'Backend síncrono recusou gravação do state'); return false; }

    // Escrita async no IDB (background)
    _idbSet(KEY_STATE, serialized);

    // Fotos
    var photosSerialized = _serialize(photos);
    if (photosSerialized !== null) {
      var photoOk = _syncSet(KEY_PHOTOS, photosSerialized);
      if (!photoOk && !_usingMemory) {
        try {
          var trimmed = {};
          for (var k in photos) { trimmed[k] = (photos[k] || []).slice(-20); }
          var trimSerialized = _serialize(trimmed) || '{}';
          _syncSet(KEY_PHOTOS, trimSerialized);
          _idbSet(KEY_PHOTOS, trimSerialized);
          _log('warn', 'saveState', 'Quota de fotos excedida — trimmed para últimas 20 por bucket');
        } catch (e) {
          _log('warn', 'saveState', 'Não foi possível salvar fotos', e.message);
        }
      } else {
        _idbSet(KEY_PHOTOS, photosSerialized);
      }
    }

    return true;
  }

  function loadState() {
    var raw = _syncGet(KEY_STATE);

    // ── Tarefa 2: fallback para chave legada do localStorage ─────────
    // Quando o IndexedDB está vazio (migração recente ou primeira abertura),
    // _syncGet pode retornar null. Tenta restaurar do localStorage com a chave antiga.
    if (!raw) {
      _log('warn', 'loadState', 'IndexedDB vazio — tentando restaurar do localStorage');
      try {
        var legacy = localStorage.getItem('agendaProMax_state');
        if (legacy) {
          raw = legacy;
          _log('log', 'loadState', 'State restaurado do localStorage (chave legada)');
        }
      } catch (e) {
        _log('warn', 'loadState', 'Falha ao restaurar state legado', e.message || e);
      }
    }

    // ── Tarefa 3: state mínimo garantido se tudo falhar ──────────────
    if (!raw) {
      var _minState = {
        consultas:   [],
        tasks:       {},
        dateTasks:   {},
        folders:     [],
        folderOrder: [],
        remedios:    []
      };
      _log('warn', 'loadState', 'Nenhum state encontrado — criando state inicial minimo');
      // Tarefa 4: persiste o state mínimo para evitar loop na próxima abertura
      var _minSerialized = _serialize(_minState);
      if (_minSerialized) {
        _syncSet(KEY_STATE, _minSerialized);
        _idbSet(KEY_STATE, _minSerialized);
      }
      return _minState;
    }

    var parsed = _deserialize(raw, null);
    if (parsed === null) { _log('error', 'loadState', 'State corrompido — retornando null'); return null; }

    if (!Array.isArray(parsed.consultas))   parsed.consultas   = [];
    if (!Array.isArray(parsed.remedios))    parsed.remedios    = [];
    if (!Array.isArray(parsed.folders))     parsed.folders     = [];
    if (!Array.isArray(parsed.folderOrder)) parsed.folderOrder = [];
    if (!parsed.tasks || typeof parsed.tasks !== 'object' || Array.isArray(parsed.tasks)) {
      _log('warn', 'loadState', 'tasks corrompido — reinicializado como {}');
      parsed.tasks = {};
    }
    if (!parsed.dateTasks || typeof parsed.dateTasks !== 'object' || Array.isArray(parsed.dateTasks)) {
      _log('warn', 'loadState', 'dateTasks corrompido — reinicializado como {}', typeof parsed.dateTasks);
      parsed.dateTasks = {};
    } else {
      var dtKeys = Object.keys(parsed.dateTasks);
      for (var i = 0; i < dtKeys.length; i++) {
        var dtKey = dtKeys[i];
        if (!Array.isArray(parsed.dateTasks[dtKey])) {
          _log('warn', 'loadState', 'dateTasks[' + dtKey + '] não é array — reinicializado', typeof parsed.dateTasks[dtKey]);
          parsed.dateTasks[dtKey] = [];
        }
      }
    }

    var rawPhotos = _syncGet(KEY_PHOTOS);
    parsed.bucketPhotos = _deserialize(rawPhotos, {});
    if (typeof parsed.bucketPhotos !== 'object' || Array.isArray(parsed.bucketPhotos)) {
      parsed.bucketPhotos = {};
    }

    return parsed;
  }

  function clearState() {
    _syncRemove(KEY_STATE);
    _syncRemove(KEY_PHOTOS);
    _idbRemove(KEY_STATE);
    _idbRemove(KEY_PHOTOS);
    _log('warn', 'clearState',
      'State e fotos removidos do ' + (_usingMemory ? 'armazenamento em memória' : 'localStorage + IndexedDB')
    );
  }

  // ── API GENÉRICA ─────────────────────────────────────────────────

  function set(key, value) {
    var serialized = _serialize(value);
    if (serialized === null) return false;
    var ok = _syncSet(key, serialized);
    if (ok) _idbSet(key, serialized);  // background
    return ok;
  }

  function get(key, fallback) {
    var fb  = (fallback !== undefined) ? fallback : null;
    var raw = _syncGet(key);
    return _deserialize(raw, fb);
  }

  function remove(key) {
    _syncRemove(key);
    _idbRemove(key);  // background
    return true;
  }

  function keys(prefix) {
    var all = _syncKeys();
    return prefix ? all.filter(function (k) { return k.startsWith(prefix); }) : all;
  }

  // ── API pública ──────────────────────────────────────────────────
  return {
    isStorageAvailable:    isStorageAvailable,
    saveState:             saveState,
    loadState:             loadState,
    clearState:            clearState,
    set:                   set,
    get:                   get,
    remove:                remove,
    keys:                  keys,
    // Funções IDB expostas para diagnóstico e testes
    idbSet:                _idbSet,
    idbGet:                _idbGet,
    idbRemove:             _idbRemove,
    idbKeys:               _idbKeys,
    get idbReady()          { return idbReady; },
    get idbAvailable()      { return _idbAvailable; },
    get usingMemoryFallback() { return _usingMemory; },
  };

}());
