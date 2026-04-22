// ════════════════════════════════════════
// inventory.js — Productos, CRUD, listener
// ════════════════════════════════════════

import {
  db, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp
} from './firebase.js';
import { state, showToast, fmt, openModal, closeModal } from './utils.js';

let editingId = null;

// ── LISTENER EN TIEMPO REAL ──
export function setupProductListener(uid) {
  const unsub = onSnapshot(collection(db, 'stores', uid, 'products'), snap => {
    state.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Notificar a vistas activas
    window.dispatchEvent(new CustomEvent('products-updated'));
  });
  state.unsubs.push(unsub);
}

// ── RENDER INVENTARIO ──
export function renderInventario(container) {
  if (container) container.innerHTML = `<div id="inv-inner" style="padding:.85rem;display:flex;flex-direction:column;gap:.6rem;overflow-y:auto;height:100%"></div>`;
  _renderInv();
  window.addEventListener('products-updated', _renderInv);
}

function _renderInv() {
  const el = document.getElementById('inv-inner');
  if (!el) { window.removeEventListener('products-updated', _renderInv); return; }

  const rows = state.products.map(p => {
    const col = p.stock === 0 ? 'var(--danger)' : p.stock <= p.minStock ? 'var(--warn)' : 'var(--ok)';
    return `<div class="inv-item" id="inv-${p.id}">
      <div style="font-size:1.3rem;flex-shrink:0">${p.emoji || '📦'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:.72rem;color:var(--muted)">Venta: ${fmt(p.price)} · Costo: ${fmt(p.cost)} · Mín: ${p.minStock}</div>
        ${p.ean ? `<div style="font-size:.65rem;color:var(--border);font-family:monospace">EAN: ${p.ean}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:.35rem;flex-shrink:0">
        <button class="qb" onclick="adjStock('${p.id}',-1)">−</button>
        <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:1rem;min-width:26px;text-align:center;color:${col}">${p.stock}</span>
        <button class="qb" onclick="adjStock('${p.id}',1)">+</button>
      </div>
      <button onclick="editProduct('${p.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.95rem;padding:.2rem">✏️</button>
      <button onclick="confirmDeleteProduct('${p.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.95rem;padding:.2rem;opacity:.6" title="Eliminar">🗑️</button>
    </div>`;
  }).join('');

  el.innerHTML = rows + `<button class="add-p-btn" onclick="openAddProduct()">＋ Agregar producto</button>`;
}

// ── AJUSTAR STOCK ──
window.adjStock = async function(id, d) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const ns = Math.max(0, p.stock + d);
  await updateDoc(doc(db, 'stores', state.storeData.uid, 'products', id), { stock: ns });
};

// ── AGREGAR PRODUCTO ──
window.openAddProduct = function() {
  editingId = null;
  document.getElementById('pm-title').textContent = 'Agregar producto';
  ['pm-name','pm-price','pm-cost','pm-stock','pm-min','pm-ean','pm-emoji'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  openModal('modal-product');
};

// ── EDITAR PRODUCTO ──
window.editProduct = function(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('pm-title').textContent = 'Editar producto';
  document.getElementById('pm-name').value  = p.name;
  document.getElementById('pm-price').value = p.price;
  document.getElementById('pm-cost').value  = p.cost;
  document.getElementById('pm-stock').value = p.stock;
  document.getElementById('pm-min').value   = p.minStock;
  document.getElementById('pm-ean').value   = p.ean || '';
  document.getElementById('pm-emoji').value = p.emoji || '';
  openModal('modal-product');
};

// ── GUARDAR PRODUCTO ──
async function saveProduct() {
  const name     = document.getElementById('pm-name').value.trim();
  const price    = parseFloat(document.getElementById('pm-price').value);
  const cost     = parseFloat(document.getElementById('pm-cost').value);
  const stock    = parseInt(document.getElementById('pm-stock').value);
  const minStock = parseInt(document.getElementById('pm-min').value);
  const ean      = document.getElementById('pm-ean').value.trim();
  const emoji    = document.getElementById('pm-emoji').value.trim() || '📦';

  if (!name || isNaN(price) || isNaN(cost) || isNaN(stock) || isNaN(minStock)) {
    showToast('Completa todos los campos', 'err'); return;
  }

  const uid = state.storeData.uid;
  const data = { name, price, cost, stock, minStock, ean, emoji };

  if (editingId) {
    await updateDoc(doc(db, 'stores', uid, 'products', editingId), data);
    showToast('✓ Producto actualizado');
  } else {
    await addDoc(collection(db, 'stores', uid, 'products'), { ...data, createdAt: serverTimestamp() });
    showToast('✓ Producto agregado');
  }
  closeModal('modal-product');
};

// ── CONFIRMAR ELIMINAR ──
window.confirmDeleteProduct = function(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('del-name').textContent = p.name;
  document.getElementById('del-stock-warn').style.display = p.stock > 0 ? 'block' : 'none';
  document.getElementById('del-stock-warn').textContent = `⚠️ Tiene ${p.stock} unidades en stock`;
  window._pendingDeleteId = id;
  openModal('modal-delete');
};

window.confirmDeleteExecute = async function() {
  const id = window._pendingDeleteId;
  if (!id) return;
  await deleteDoc(doc(db, 'stores', state.storeData.uid, 'products', id));
  closeModal('modal-delete');
  showToast('Producto eliminado');
  window._pendingDeleteId = null;
};

// ── SCAN EAN PARA PRODUCTO ──
window.scanForProduct = function() {
  import('./scanner.js').then(m => m.openScanner('product'));
};
