// utils.js
export const state = {
  uid: null, storeName: '', products: [], sales: [], currentView: '', unsubs: [], isOnline: navigator.onLine
};

export const fmt = n => '$' + Math.round(n||0).toLocaleString('es-CL');
export const toDate = v => v?.seconds ? new Date(v.seconds*1000) : new Date(v||0);

export function showToast(msg, type='ok', dur=2800) {
  const t=document.getElementById('toast'), i=document.getElementById('toast-icon'), m=document.getElementById('toast-msg');
  if(!t)return;
  i.textContent = type==='ok'?'✓':type==='err'?'✕':'⚠';
  m.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._t);
  t._t = setTimeout(()=>t.classList.remove('show'), dur);
}

export function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── THEME ──
export function initTheme() {
  const saved = localStorage.getItem('sb_theme') || 'dark';
  applyTheme(saved);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sb_theme', theme);
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.content = theme === 'dark' ? '#0e0f14' : '#f0f2f7';
  const track = document.getElementById('toggle-track');
  const label = document.getElementById('theme-label');
  const btn   = document.getElementById('theme-btn');
  if (track) track.classList.toggle('on', theme === 'light');
  if (label) label.textContent = theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
  if (btn)   btn.textContent   = theme === 'dark' ? '☀️' : '🌙';
}

// ── NETWORK ──
export function initNetwork(onOnline, onOffline) {
  window.addEventListener('online',  () => { state.isOnline=true;  onOnline?.();  updateNetDot(true); });
  window.addEventListener('offline', () => { state.isOnline=false; onOffline?.(); updateNetDot(false); });
  updateNetDot(navigator.onLine);
}

function updateNetDot(online) {
  const dot=document.getElementById('net-dot'), lbl=document.getElementById('net-lbl');
  if(dot) dot.className = 'net-dot' + (online?'':' offline');
  if(lbl) lbl.textContent = online ? 'en línea' : 'offline';
}

// ── OFFLINE QUEUE ──
export function queueSale(sale) {
  const q = JSON.parse(localStorage.getItem('sb_q')||'[]');
  q.push(sale); localStorage.setItem('sb_q', JSON.stringify(q));
}
export function getQueue()   { return JSON.parse(localStorage.getItem('sb_q')||'[]'); }
export function clearQueue() { localStorage.removeItem('sb_q'); }
