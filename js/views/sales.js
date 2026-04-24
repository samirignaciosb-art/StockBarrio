// ════════════════════════════════════════
// sales.js — Carrito, ventas, offline queue
// ════════════════════════════════════════

import {
  db, collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, limit, serverTimestamp
} from './firebase.js';
import {
  state, showToast, fmt, toDate,
  openModal, closeModal, queueOfflineSale, getOfflineQueue, clearOfflineQueue
} from './utils.js';

// ── LISTENER EN TIEMPO REAL ──
export function setupSalesListener(uid) {
  const q = query(
    collection(db, 'stores', uid, 'sales'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  const unsub = onSnapshot(q, snap => {
    state.sales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.dispatchEvent(new CustomEvent('sales-updated'));
  });
  state.unsubs.push(unsub);

  // Sincronizar ventas offline al reconectar
  window.addEventListener('online', syncOfflineQueue);
}

// ── RENDER VISTA VENDEDOR ──
export function renderVender(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
      <div style="padding:.75rem .8rem .4rem;flex-shrink:0">
        <div style="display:flex;gap:.6rem;align-items:center">
          <div class="sbox">
            <span style="color:var(--muted)">🔍</span>
            <input type="text" id="vsearch" placeholder="Buscar producto..."
              oninput="filterGrid()" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:'Epilogue',sans-serif;font-size:.92rem">
          </div>
          <button class="scan-btn" onclick="openScannerSell()" title="Escanear">📷</button>
        </div>
        <div id="offline-banner" style="display:none;margin-top:.5rem;background:rgba(255,184,0,.1);border:1px solid var(--warn);border-radius:8px;padding:.4rem .75rem;font-size:.75rem;color:var(--warn);text-align:center">
          📵 Sin conexión — las ventas se guardarán y sincronizarán al reconectar
        </div>
      </div>

      <div id="pgrid" class="pgrid"></div>

      <div class="cart-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:.92rem;display:flex;align-items:center;gap:.45rem">
            🧾 Venta <span id="cart-cnt" class="cnt-badge" style="display:none"></span>
          </div>
          <button onclick="clearCart()" style="background:none;border:none;color:var(--muted);font-size:.75rem;cursor:pointer;font-family:'Epilogue',sans-serif">Limpiar</button>
        </div>
        <div id="cart-items" style="display:flex;flex-direction:column;gap:.4rem;overflow-y:auto;max-height:120px"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.7rem;padding-top:.7rem;border-top:1px solid var(--border);gap:.75rem">
          <div>
            <div style="font-size:.7rem;color:var(--muted)">Total a cobrar</div>
            <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.6rem;color:var(--acc);line-height:1" id="cart-total">$0</div>
          </div>
          <button class="cobrar-btn" id="cobrar-btn" onclick="openSaleConfirm()" disabled>Cobrar →</button>
        </div>
      </div>
    </div>`;

  renderGrid();
  renderCart();
  updateOfflineBanner();
  window.addEventListener('products-updated', () => renderGrid(document.getElementById('vsearch')?.value?.toLowerCase() || ''));
  window.addEventListener('online',  updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);
}

function updateOfflineBanner() {
  const b = document.getElementById('offline-banner');
  if (b) b.style.display = state.isOnline ? 'none' : 'block';
}

// ── GRID DE PRODUCTOS ──
function filterGrid() {
  renderGrid(document.getElementById('vsearch')?.value?.toLowerCase() || '');
};

export function renderGrid(filter = '') {
  const el = document.getElementById('pgrid');
  if (!el) return;
  const list = state.products.filter(p => p.name.toLowerCase().includes(filter));
  if (!list.length) {
    el.innerHTML = `<div style="color:var(--muted);grid-column:1/-1;text-align:center;padding:2rem;font-size:.85rem">Sin resultados</div>`;
    return;
  }
  el.innerHTML = list.map(p => {
    const st = p.stock === 0 ? 'out' : p.stock <= p.minStock ? 'low' : 'ok';
    return `<div class="pcard ${st}" onclick="addToCart('${p.id}')">
      <span class="pcard-badge ${st}">${st==='out'?'Sin stock':st==='low'?'¡Poco!':'✓'}</span>
      <div style="font-size:1.5rem;margin-bottom:.3rem">${p.emoji || '📦'}</div>
      <div class="pcard-name">${p.name}</div>
      <div class="pcard-price">${fmt(p.price)}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:.2rem">Stock: ${p.stock}</div>
    </div>`;
  }).join('');
}

// ── CARRITO ──
function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p || p.stock === 0) return;
  const inc = state.cart.find(x => x.id === id);
  if (inc) {
    if (inc.qty >= p.stock) { showToast('Sin más stock disponible', 'err'); return; }
    inc.qty++;
  } else {
    state.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
  }
  renderCart();
};

function changeQty(id, d) {
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.qty += d;
  if (item.qty <= 0) state.cart = state.cart.filter(x => x.id !== id);
  renderCart();
};

function clearCart() { state.cart = []; renderCart(); };

export function renderCart() {
  const el  = document.getElementById('cart-items');
  const cnt = document.getElementById('cart-cnt');
  const tot = document.getElementById('cart-total');
  const btn = document.getElementById('cobrar-btn');
  if (!el) return;

  if (!state.cart.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.8rem;text-align:center;padding:.5rem 0">Toca un producto para agregar ↑</div>`;
    if (cnt) { cnt.textContent = ''; cnt.style.display = 'none'; }
    if (tot) tot.textContent = '$0';
    if (btn) btn.disabled = true;
    return;
  }

  let sum = 0;
  el.innerHTML = state.cart.map(item => {
    sum += item.price * item.qty;
    return `<div class="cart-item">
      <div style="flex:1;font-size:.83rem;font-weight:500">${item.name}</div>
      <div style="display:flex;align-items:center;gap:.45rem">
        <button class="qb" onclick="changeQty('${item.id}',-1)">−</button>
        <span style="font-weight:700;min-width:16px;text-align:center;font-size:.9rem">${item.qty}</span>
        <button class="qb" onclick="changeQty('${item.id}',1)">+</button>
        <span style="color:var(--acc);font-weight:600;min-width:52px;text-align:right;font-size:.83rem">${fmt(item.price*item.qty)}</span>
      </div>
    </div>`;
  }).join('');

  const totalQty = state.cart.reduce((s, i) => s + i.qty, 0);
  if (cnt) { cnt.textContent = totalQty; cnt.style.display = 'inline'; }
  if (tot) tot.textContent = fmt(sum);
  if (btn) btn.disabled = false;
}

// ── CONFIRMAR VENTA ──
function openSaleConfirm() {
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('ms-items').textContent = state.cart.map(i => `${i.qty}× ${i.name}`).join(' · ');
  document.getElementById('ms-total').textContent = fmt(total);
  document.getElementById('modal-sale').classList.add('open');
};

// ── COMPLETAR VENTA ──
async function completeSale() {
  const uid   = state.storeData.uid;
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cost  = state.cart.reduce((s, i) => {
    const p = state.products.find(x => x.id === i.id);
    return s + (p ? p.cost * i.qty : 0);
  }, 0);
  const saleData = {
    items: state.cart.map(i => ({ ...i })),
    total, cost,
    vendorName: state.storeData.vendorName || 'Dueño',
    createdAt: new Date().toISOString()
  };

  if (!state.isOnline) {
    // Guardar offline y descontar stock localmente
    queueOfflineSale({ ...saleData, uid });
    state.products.forEach(p => {
      const c = state.cart.find(x => x.id === p.id);
      if (c) p.stock -= c.qty;
    });
    window.dispatchEvent(new CustomEvent('products-updated'));
    state.cart = [];
    closeModal('modal-sale');
    renderCart();
    showToast('✓ Venta guardada (se sincronizará al reconectar)', 'warn');
    return;
  }

  // Online: guardar en Firebase
  for (const item of state.cart) {
    const p = state.products.find(x => x.id === item.id);
    if (p) await updateDoc(doc(db, 'stores', uid, 'products', p.id), { stock: p.stock - item.qty });
  }
  await addDoc(collection(db, 'stores', uid, 'sales'), {
    ...saleData, createdAt: serverTimestamp()
  });

  state.cart = [];
  closeModal('modal-sale');
  renderCart();
  showToast('✓ Venta registrada');
};

// ── SINCRONIZAR COLA OFFLINE ──
async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length) return;
  showToast(`Sincronizando ${queue.length} venta(s)...`, 'warn');
  for (const sale of queue) {
    const { uid, ...data } = sale;
    try {
      await addDoc(collection(db, 'stores', uid, 'sales'), {
        ...data, createdAt: serverTimestamp(), _wasOffline: true
      });
    } catch(e) { console.error('Sync failed', e); }
  }
  clearOfflineQueue();
  showToast('✓ Ventas sincronizadas');
}

// ── RENDER HISTORIAL ──
export function renderHistorial(container) {
  if (container) container.innerHTML = `<div id="hist-inner" style="padding:.85rem;display:flex;flex-direction:column;gap:.5rem;overflow-y:auto;height:100%"></div>`;
  _renderHist();
  window.addEventListener('sales-updated', _renderHist);
}

function _renderHist() {
  const el = document.getElementById('hist-inner');
  if (!el) { window.removeEventListener('sales-updated', _renderHist); return; }
  if (!state.sales.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Sin ventas aún.</div>`;
    return;
  }
  el.innerHTML = state.sales.slice(0, 80).map(s => {
    const d = toDate(s.createdAt);
    return `<div class="sale-row">
      <div>
        <div style="font-size:.7rem;color:var(--muted)">${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}${s.vendorName?' · '+s.vendorName:''}</div>
        <div style="font-size:.83rem;margin-top:.1rem">${(s.items||[]).map(i=>`${i.qty}× ${i.name}`).join(', ')}</div>
      </div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--ok);white-space:nowrap">${fmt(s.total)}</div>
    </div>`;
  }).join('');
}

window.openScannerSell = function() {
  import('./scanner.js').then(m => m.openScanner('sell'));
};
window.addToCart = addToCart;
window.changeQty = changeQty;
window.clearCart = clearCart;
window.filterGrid = filterGrid;
window.openSaleConfirm = openSaleConfirm;
window.completeSale = completeSale;
