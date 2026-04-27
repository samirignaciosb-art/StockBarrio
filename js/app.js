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
  admin:      '⚙️ Panel de Administrador',
  reportes:   '📥 Reportes y Descargas',
};

export function launchApp(storeName) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('visible');
  document.getElementById('sb-store-name').textContent = storeName;
  document.getElementById('tb-store').textContent = storeName;
  initNetwork();
  window.addEventListener('products-updated', updateBadge);
  // Mostrar panel admin si es el administrador
  const adminEmail = sessionStorage.getItem('sb_email')||'';
  if(adminEmail === 'samirhelado@gmail.com') {
    const adminBtn = document.getElementById('snav-admin');
    if(adminBtn) adminBtn.style.display='flex';
  }
  navigate('alertas');
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

  // Lazy load vistas — rutas explícitas sin ambigüedad
  const ops = await import('./views/operations.js?v=1777326438');
  
  if(view === 'inventario') {
    const inv = await import('./views/inventory.js?v=1777326438');
    inv.renderInventario(c);
  } else if(view === 'alertas') {
    ops.renderAlertas(c);
  } else if(view === 'comprar') {
    ops.renderComprar(c);
  } else if(view === 'entrada') {
    ops.renderEntrada(c);
  } else if(view === 'salida') {
    ops.renderSalida(c);
  } else if(view === 'historial') {
    ops.renderHistorial(c);
  } else if(view === 'ajustes') {
    ops.renderAjustes(c);
  } else if(view === 'toma') {
    ops.renderToma(c);
  } else if(view === 'admin') {
    const {renderAdmin} = await import('./admin.js?v=1777326438');
    renderAdmin(c);
  } else if(view === 'reportes') {
    const {renderReportes} = await import('./exports.js?v=1777326438');
    renderReportes(c);
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
