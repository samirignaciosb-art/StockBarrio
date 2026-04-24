// utils.js
export const state = {
  uid: null, storeName: '', products: [], sales: [], adjustments: [],
  currentView: '', unsubs: [], isOnline: navigator.onLine
};

export const fmt    = n => '$' + Math.round(n||0).toLocaleString('es-CL');
export const toDate = v => v?.seconds ? new Date(v.seconds*1000) : new Date(v||0);

// ── TOAST ──
export function showToast(msg, type='ok', dur=2800) {
  const t=document.getElementById('toast');
  const i=document.getElementById('toast-icon');
  const m=document.getElementById('toast-msg');
  if(!t) return;
  i.textContent = type==='ok'?'✓' : type==='err'?'✕' : '⚠';
  m.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}

// ── MODAL ──
export function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── THEME ──
export function initTheme() { applyTheme(localStorage.getItem('sb_theme')||'dark'); }

export function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sb_theme', theme);
  const meta=document.getElementById('theme-meta');
  if(meta) meta.content = theme==='dark' ? '#0e0f14' : '#f0f2f7';
  const track=document.getElementById('toggle-track');
  const label=document.getElementById('theme-label');
  const btn=document.getElementById('theme-btn');
  if(track) track.classList.toggle('on', theme==='light');
  if(label) label.textContent = theme==='dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
  if(btn)   btn.textContent   = theme==='dark' ? '☀️' : '🌙';
}

// ── NETWORK ──
export function initNetwork() {
  const update = online => {
    state.isOnline = online;
    const dot=document.getElementById('net-dot');
    const lbl=document.getElementById('net-lbl');
    if(dot) dot.className = 'net-dot'+(online?'':' offline');
    if(lbl) lbl.textContent = online ? 'en línea' : 'offline';
    if(online)  showToast('✓ Conexión restaurada');
    if(!online) showToast('Sin conexión — modo offline','warn');
  };
  window.addEventListener('online',  () => update(true));
  window.addEventListener('offline', () => update(false));
  update(navigator.onLine);
}

// ── OFFLINE QUEUE ──
export function queueSale(sale) {
  const q=JSON.parse(localStorage.getItem('sb_q')||'[]');
  q.push(sale); localStorage.setItem('sb_q', JSON.stringify(q));
}
export function getQueue()   { return JSON.parse(localStorage.getItem('sb_q')||'[]'); }
export function clearQueue() { localStorage.removeItem('sb_q'); }

// ── EAN → EMOJI (categoría) ──
export function eanEmoji(tags=[]) {
  const t = tags.join(' ').toLowerCase();
  if(t.includes('beverage')||t.includes('drink')||t.includes('bebida')||t.includes('juice')||t.includes('jugo')) return '🥤';
  if(t.includes('dairy')||t.includes('milk')||t.includes('leche')||t.includes('yogur')) return '🥛';
  if(t.includes('bread')||t.includes('pan')||t.includes('cereal')||t.includes('pasta')||t.includes('flour')) return '🍞';
  if(t.includes('meat')||t.includes('carne')||t.includes('pollo')||t.includes('chicken')) return '🥩';
  if(t.includes('fruit')||t.includes('fruta')) return '🍎';
  if(t.includes('vegetable')||t.includes('verdura')) return '🥦';
  if(t.includes('snack')||t.includes('chip')||t.includes('cracker')) return '🍿';
  if(t.includes('chocolate')||t.includes('candy')||t.includes('dulce')||t.includes('sweet')) return '🍫';
  if(t.includes('sauce')||t.includes('salsa')||t.includes('condiment')||t.includes('oil')||t.includes('aceite')) return '🫙';
  if(t.includes('clean')||t.includes('limpieza')||t.includes('detergente')) return '🧹';
  if(t.includes('hygiene')||t.includes('higiene')||t.includes('soap')||t.includes('jabon')) return '🧼';
  if(t.includes('coffee')||t.includes('cafe')||t.includes('tea')||t.includes('te')) return '☕';
  if(t.includes('frozen')||t.includes('congelado')) return '🧊';
  if(t.includes('egg')||t.includes('huevo')) return '🥚';
  return '📦';
}
