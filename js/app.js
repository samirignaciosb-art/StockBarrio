// ════════════════════════════════════════
// app.js — Orquestador principal
// ════════════════════════════════════════

import { state, showToast, initNetworkWatcher } from './utils.js';
import { doLogout as _doLogout } from './auth.js';
import { initAuthPersistence }  from './auth.js';
import { initGunReader }        from './scanner.js';
import { updateAlertBadge }     from './dashboard.js';

// ── LANZAR APP DESPUÉS DE LOGIN ──
export function launchApp(storeName, role) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('tb-name').textContent = storeName;

  renderNav(role);

  if (role === 'vendor') switchView('vender');
  else switchView('dashboard');

  // Watcher online/offline
  initNetworkWatcher(
    () => { showToast('✓ Conexión restaurada', 'ok'); updateNetworkUI(true);  },
    () => { showToast('Sin conexión — modo offline', 'warn');  updateNetworkUI(false); }
  );

  updateNetworkUI(navigator.onLine);
  window.addEventListener('products-updated', updateAlertBadge);
}

function updateNetworkUI(online) {
  const dot = document.getElementById('net-dot');
  const lbl = document.getElementById('net-lbl');
  if (!dot || !lbl) return;
  dot.style.background = online ? 'var(--ok)' : 'var(--warn)';
  lbl.textContent      = online ? 'en línea' : 'offline';
  lbl.style.color      = online ? 'var(--ok)' : 'var(--warn)';
}

// ── NAVEGACIÓN INFERIOR ──
function renderNav(role) {
  const nav = document.getElementById('bottom-nav');
  if (role === 'vendor') {
    nav.innerHTML = `
      <button class="nv active" id="nav-vender"    onclick="switchView('vender')"><span>🛍️</span>Vender</button>
      <button class="nv"        id="nav-historial"  onclick="switchView('historial')"><span>📋</span>Ventas</button>`;
  } else {
    nav.innerHTML = `
      <button class="nv active" id="nav-dashboard"  onclick="switchView('dashboard')"><span>📊</span>Resumen</button>
      <button class="nv"        id="nav-alertas"    onclick="switchView('alertas')"><span>🚨</span>Alertas<i class="nbadge" id="alert-badge" style="display:none"></i></button>
      <button class="nv"        id="nav-inventario" onclick="switchView('inventario')"><span>📦</span>Stock</button>
      <button class="nv"        id="nav-historial"  onclick="switchView('historial')"><span>📋</span>Ventas</button>
      <button class="nv"        id="nav-vendedores" onclick="switchView('vendedores')"><span>👥</span>Equipo</button>`;
  }
}

// ── CAMBIAR VISTA ──
window.switchView = async function(v) {
  state.currentView = v;
  document.querySelectorAll('.nv').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + v)?.classList.add('active');

  const c = document.getElementById('main-content');

  if (v === 'vender') {
    const { renderVender } = await import('./sales.js');
    renderVender(c);
  } else if (v === 'dashboard') {
    const { renderDashboard } = await import('./dashboard.js');
    renderDashboard(c);
  } else if (v === 'alertas') {
    const { renderAlertas } = await import('./dashboard.js');
    renderAlertas(c);
  } else if (v === 'inventario') {
    const { renderInventario } = await import('./inventory.js');
    renderInventario(c);
  } else if (v === 'historial') {
    const { renderHistorial } = await import('./sales.js');
    renderHistorial(c);
  } else if (v === 'vendedores') {
    const { renderVendors } = await import('./vendors.js');
    renderVendors(c);
  }
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initAuthPersistence();
  initGunReader();

  // Escáner manual: cerrar con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      import('./scanner.js').then(m => m.closeScanner());
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Cerrar modales tocando el overlay
  document.addEventListener('click', e => {
    if (!e.target.classList.contains('modal-overlay')) return;
    if (e.target.id === 'modal-scanner') {
      import('./scanner.js').then(m => m.closeScanner());
    } else {
      e.target.classList.remove('open');
    }
  });
});

// Exponer para HTML
window.launchApp = launchApp;

window.doLogout = _doLogout;
