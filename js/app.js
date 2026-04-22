// app.js — Orquestador principal
import { initAuth } from './auth.js';
import { initTheme, initNetwork, toggleTheme, showToast } from './utils.js';
import { initGun } from './scanner.js';

const PAGE_TITLES = {
  dashboard: 'Dashboard', alertas: 'Alertas de stock', comprar: 'Qué comprar',
  entrada: 'Entrada de mercadería', salida: 'Salida / Ventas', inventario: 'Inventario', historial: 'Historial'
};

export function launchApp(storeName) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.add('visible');
  document.getElementById('sb-store-name').textContent = storeName;
  document.getElementById('tb-store').textContent = storeName;
  navigate('dashboard');

  initNetwork(
    () => showToast('✓ Conexión restaurada'),
    () => showToast('Sin conexión — modo offline', 'warn')
  );

  window.addEventListener('products-updated', updateAlertBadge);
  window.addEventListener('sales-updated',    updateAlertBadge);
}

let currentCleanup = null;

window.navigate = async function(view) {
  // Cleanup previous view listeners
  const content = document.getElementById('main-content');
  if(content._cleanup){content._cleanup();content._cleanup=null;}

  // Update nav
  document.querySelectorAll('.nav-item, .mnv').forEach(n => n.classList.remove('active'));
  document.getElementById('snav-'+view)?.classList.add('active');
  document.getElementById('mnav-'+view)?.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[view] || view;

  // Render view
  const { renderDashboard, renderAlertas, renderComprar, renderEntrada, renderSalida, renderInventario, renderHistorial } = await import('./views.js');
  const renders = { dashboard:renderDashboard, alertas:renderAlertas, comprar:renderComprar, entrada:renderEntrada, salida:renderSalida, inventario:renderInventario, historial:renderHistorial };
  const fn = renders[view];
  if(fn) fn(content);
};

function updateAlertBadge() {
  const { state } = window._state || {};
  import('./utils.js').then(({state})=>{
    const cnt = state.products.filter(p=>p.stock<=p.minStock).length;
    ['snav-badge','mnav-badge'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.textContent=cnt; el.style.display=cnt>0?'inline':'none';
    });
  });
}

// Theme toggle exposed
window.toggleTheme = toggleTheme;

// Modal close on overlay click
document.addEventListener('click', e=>{
  if(!e.target.classList.contains('modal-overlay'))return;
  if(e.target.id==='modal-scanner'){ import('./scanner.js').then(m=>m.closeScanner()); }
  else e.target.classList.remove('open');
});

// Escape key
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape')return;
  import('./scanner.js').then(m=>m.closeScanner());
  document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
});

// Boot
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  initAuth();
  initGun();
});

window.launchApp = launchApp;
