/**
 * notificacoes.js — Alertas automáticos
 * Agenda GRS — Verifica consultas e remédios próximos
 * Requer: state, showToast (globais em index.html)
 */

// Checar consultas próximas (dentro de 24h) e emitir alerta
function verificarAlertasConsultasProximas() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const agora = Date.now();
  const umDia = 24 * 60 * 60 * 1000;
  (state.consultas || []).forEach(c => {
    if (!c.data || !c.hora || c._alertado) return;
    const ts = new Date(c.data + 'T' + c.hora + ':00').getTime();
    const diff = ts - agora;
    if (diff > 0 && diff <= umDia) {
      const horas = Math.round(diff / 3600000);
      const msg = `🏥 ${c.especialidade} — ${c.paciente} em ${horas}h`;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('Agenda GRS — Consulta Próxima', {
            body: msg, icon: './leo-192.png', tag: 'consulta-' + c.id,
            vibrate: [200, 100, 200]
          });
        }).catch(() => new Notification('⏰ ' + msg));
      }
      c._alertado = true;
    }
  });
}

// Iniciar verificação periódica de alertas (a cada 30min)
function iniciarVerificacaoPeriodica() {
  verificarAlertasConsultasProximas();
  setInterval(verificarAlertasConsultasProximas, 30 * 60 * 1000);
}
