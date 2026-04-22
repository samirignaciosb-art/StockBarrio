// ════════════════════════════════════════
// utils.js — Estado global y utilidades
// ════════════════════════════════════════

// ── ESTADO GLOBAL ──
export const state = {
  storeData:  null,   // { uid, storeName, role }
  products:   [],
  sales:      [],
  cart:       [],
  currentView: '',
  unsubs:     [],     // listeners Firestore para limpiar al logout
  isOnline:   navigator.onLine,
  pendingSales: [],   // ventas offline pendientes de sync
};

// ── FORMATO MONEDA CLP ──
export function fmt(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
}

// ── FECHA DESDE FIRESTORE O STRING ──
export function toDate(val) {
  if (!val) return new Date(0);
  if (val?.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
}

// ── TOAST ──
export function showToast(msg, type = 'ok', dur = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

// ── MODAL ──
export function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── ONLINE/OFFLINE LISTENER ──
export function initNetworkWatcher(onOnline, onOffline) {
  window.addEventListener('online',  () => { state.isOnline = true;  onOnline?.();  });
  window.addEventListener('offline', () => { state.isOnline = false; onOffline?.(); });
}

// ── OFFLINE QUEUE: guardar venta pendiente ──
export function queueOfflineSale(sale) {
  const q = JSON.parse(localStorage.getItem('sb_offline_queue') || '[]');
  q.push({ ...sale, _queued: Date.now() });
  localStorage.setItem('sb_offline_queue', JSON.stringify(q));
  state.pendingSales = q;
}

export function getOfflineQueue() {
  return JSON.parse(localStorage.getItem('sb_offline_queue') || '[]');
}

export function clearOfflineQueue() {
  localStorage.removeItem('sb_offline_queue');
  state.pendingSales = [];
}
