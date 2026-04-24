// ════════════════════════════════════════
// vendors.js — Gestión de vendedores y PINs
// ════════════════════════════════════════

import { state, showToast, fmt, openModal, closeModal } from './utils.js';
import { createVendor, deleteVendor, loadVendors } from './auth.js';

// ── RENDER PANEL VENDEDORES ──
export async function renderVendors(container) {
  if (container) container.innerHTML = `<div id="vendors-inner" style="padding:.85rem;display:flex;flex-direction:column;gap:.75rem;overflow-y:auto;height:100%"></div>`;
  await _buildVendors();
}

async function _buildVendors() {
  const el = document.getElementById('vendors-inner');
  if (!el) return;

  // Código del negocio para que vendedores puedan ingresar
  const { ensureStoreCode } = await import('./auth.js');
  const storeCode = await ensureStoreCode();
  const vendors   = await loadVendors();

  el.innerHTML = `
    <div style="background:rgba(0,229,160,.07);border:1px solid rgba(0,229,160,.2);border-radius:12px;padding:1rem">
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:.3rem">Código del negocio para vendedores</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.4rem;color:var(--acc);letter-spacing:.05em">${storeCode}</div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:.25rem">El vendedor ingresa este código + su PIN</div>
    </div>

    <div class="sec-t" style="margin-top:.25rem">👥 Vendedores activos</div>

    ${vendors.length === 0
      ? `<div style="color:var(--muted);font-size:.85rem">No hay vendedores registrados.</div>`
      : vendors.map(v => `
          <div class="inv-item">
            <div style="font-size:1.3rem">👤</div>
            <div style="flex:1">
              <div style="font-size:.88rem;font-weight:500">${v.name}</div>
              <div style="font-size:.72rem;color:var(--muted)">PIN: <b style="color:var(--text);font-family:monospace;letter-spacing:.1em">${v.pin}</b></div>
            </div>
            <button onclick="removeVendor('${v.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.85rem;opacity:.7">Eliminar</button>
          </div>`).join('')}

    <button class="add-p-btn" onclick="openAddVendor()">＋ Agregar vendedor</button>
  `;
}

window.openAddVendor = function() {
  document.getElementById('nv-name').value = '';
  document.getElementById('nv-pin').value  = '';
  openModal('modal-vendor');
};

window.saveVendor = async function() {
  const name = document.getElementById('nv-name').value.trim();
  const pin  = document.getElementById('nv-pin').value.trim();

  if (!name) { showToast('Ingresa el nombre del vendedor', 'err'); return; }
  if (!/^\d{4}$/.test(pin)) { showToast('El PIN debe ser de exactamente 4 dígitos', 'err'); return; }

  const ok = await createVendor(name, pin);
  if (ok) {
    closeModal('modal-vendor');
    await _buildVendors();
  }
};

window.removeVendor = async function(id) {
  if (!confirm('¿Eliminar este vendedor?')) return;
  await deleteVendor(id);
  await _buildVendors();
};
