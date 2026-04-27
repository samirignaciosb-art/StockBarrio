// app.js — Orquestador principal
import { initAuth } from './auth.js';
import { initTheme, initNetwork, toggleTheme } from './utils.js';
import { initGun } from './scanner.js';
import { lookupEAN } from './ean.js';

const TITLES = {
  dashboard:  '📊 Dashboard',
  alertas:    '🚨 Alertas de stock',
  comprar:    '🛒 Qué comprar',
  entrada:    '📥 Entrada de mercadería',
  salida:     '📤 Salida / Ventas',
  inventario: '📦 Inventario',
  historial:  '📋 Historial de ventas',
  ajustes:    '🔧 Ajustes de stock',
  toma:       '📋 Toma de inventario',
};

export function launchApp(storeName) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('visible');
  document.getElementById('sb-store-name').textContent = storeName;
  document.getElementById('tb-store').textContent = storeName;
  initNetwork();
  window.addEventListener('products-updated', updateBadge);
  navigate('dashboard');
}

// ── ROUTER ──
window.navigate = async function(view) {
  const c = document.getElementById('main-content');
  // Cleanup anterior
  if(c._cleanup){ c._cleanup(); c._cleanup=null; }

  // Nav highlight
  document.querySelectorAll('.nav-item,.mnv').forEach(n=>n.classList.remove('active'));
  document.getElementById('snav-'+view)?.classList.add('active');
  document.getElementById('mnav-'+view)?.classList.add('active');
  document.getElementById('page-title').textContent = TITLES[view]||view;

  // Lazy load vistas
  if(view==='dashboard') {
    const {renderDashboard} = await import('./views/dashboard.js');
    renderDashboard(c);
  } else if(view==='inventario') {
    const {renderInventario} = await import('./views/inventory.js');
    renderInventario(c);
  } else if(['alertas','comprar'].includes(view)) {
    const {renderAlertas} = await import('./views/operations.js');
    renderAlertas(c);
  } else if(view==='entrada') {
    const {renderEntrada} = await import('./views/operations.js');
    renderEntrada(c);
  } else if(view==='salida') {
    const {renderSalida} = await import('./views/operations.js');
    renderSalida(c);
  } else if(view==='historial') {
    const {renderHistorial} = await import('./views/operations.js');
    renderHistorial(c);
  } else if(view==='ajustes') {
    const {renderAjustes} = await import('./views/operations.js');
    renderAjustes(c);
  } else if(view==='toma') {
    const {renderToma} = await import('./views/operations.js');
    renderToma(c);
  }
};

// ── ALERT BADGE ──
function updateBadge() {
  const {state} = window._sbState||{};
  import('./utils.js').then(({state})=>{
    const cnt = state.products.filter(p=>p.stock<=p.minStock).length;
    ['snav-badge','mnav-badge'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.textContent=cnt; el.style.display=cnt>0?'inline':'none';
    });
  });
}

// ── GLOBALS ──
window.toggleTheme = toggleTheme;
window.lookupEAN   = lookupEAN;

// Close modal on overlay click
document.addEventListener('click', e=>{
  if(!e.target.classList.contains('modal-overlay'))return;
  if(e.target.id==='modal-scanner'){ import('./scanner.js').then(m=>m.closeScanner()); }
  else e.target.classList.remove('open');
});

// Escape closes modals
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape')return;
  import('./scanner.js').then(m=>m.closeScanner());
  document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
});

// scan-manual enter
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('scan-manual')?.addEventListener('keydown',e=>{
    if(e.key==='Enter') window.processManualScan?.();
  });
});

// ── BOOT ──
document.addEventListener('DOMContentLoaded',()=>{
  initTheme();
  initAuth();
  initGun();
});

window.launchApp = launchApp;
