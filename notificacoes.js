/**
 * notificacoes.js — Alertas automáticos
 * Agenda GRS — Verifica consultas e remédios próximos
 * Requer: state, showToast (globais em index.html)
 */

function _parseConsultaTimestamp(data, hora) {
  if (!data || !hora) return NaN;
  var stamp = String(data) + 'T' + String(hora) + ':00';
  var dt = new Date(stamp);
  var ts = dt.getTime();
  return Number.isFinite(ts) ? ts : NaN;
}

// Checar consultas próximas (dentro de 24h) e emitir alerta
function verificarAlertasConsultasProximas() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const agora = Date.now();
  const umDia = 24 * 60 * 60 * 1000;
  (state.consultas || []).forEach(c => {
    if (!c || !c.data || !c.hora) return;

    const stamp = String(c.data) + 'T' + String(c.hora);
    // Compatibilidade: se editou data/hora, reseta marcadores antigos.
    if (c._alertadoRef && c._alertadoRef !== stamp) {
      c._alertado = false;
      c._alertadoStamp = null;
    }
    if (c._alertadoStamp && c._alertadoStamp !== stamp) {
      c._alertado = false;
    }
    if (c._alertado) return;

    const ts = _parseConsultaTimestamp(c.data, c.hora);
    if (!Number.isFinite(ts)) return;
    const diff = ts - agora;
    if (diff > 0 && diff <= umDia) {
      const horas = Math.round(diff / 3600000);
      const msg = `🏥 Consulta em ${horas}h`;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('Agenda GRS — Consulta Próxima', {
            body: msg, icon: './leo-192.png', tag: 'consulta-' + c.id,
            vibrate: [200, 100, 200]
          });
        }).catch(() => new Notification('⏰ ' + msg));
      } else {
        try { new Notification('⏰ ' + msg); } catch (_) {}
      }
      c._alertado = true;
      c._alertadoStamp = stamp;
      c._alertadoRef = stamp;
    }
  });
}

// Iniciar verificação periódica de alertas (a cada 30min)
function iniciarVerificacaoPeriodica() {
  verificarAlertasConsultasProximas();
  setInterval(verificarAlertasConsultasProximas, 30 * 60 * 1000);
}
