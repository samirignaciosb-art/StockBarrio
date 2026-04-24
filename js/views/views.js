// views.js — All view renderers
import { state, fmt, toDate, showToast, openModal, closeModal } from './utils.js';
import { saveProductDB, deleteProductDB, adjustStockDB, addStock, recordSale } from './data.js';

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
export function renderDashboard(c) {
  c.innerHTML = `<div id="dash-root"></div>`;
  buildDash();
  const fn = () => buildDash();
  window.addEventListener('products-updated', fn);
  window.addEventListener('sales-updated', fn);
  c._cleanup = () => { window.removeEventListener('products-updated',fn); window.removeEventListener('sales-updated',fn); };
}

function buildDash() {
  const el = document.getElementById('dash-root'); if(!el) return;
  const now = new Date(), today = now.toLocaleDateString('es-CL');
  const wkStart = new Date(now); wkStart.setDate(now.getDate()-((now.getDay()+6)%7)); wkStart.setHours(0,0,0,0);
  const pwkStart = new Date(wkStart); pwkStart.setDate(wkStart.getDate()-7);
  const m30 = new Date(now); m30.setDate(now.getDate()-30);

  const todaySales = state.sales.filter(s=>toDate(s.createdAt).toLocaleDateString('es-CL')===today);
  const wkSales    = state.sales.filter(s=>toDate(s.createdAt)>=wkStart);
  const pwkSales   = state.sales.filter(s=>{ const d=toDate(s.createdAt); return d>=pwkStart&&d<wkStart; });
  const m30Sales   = state.sales.filter(s=>toDate(s.createdAt)>=m30);

  const income  = todaySales.reduce((s,x)=>s+x.total,0);
  const cost    = todaySales.reduce((s,x)=>s+x.cost,0);
  const profit  = income-cost;
  const margin  = income>0?Math.round((profit/income)*100):0;
  const invested= state.products.reduce((s,p)=>s+p.cost*p.stock,0);
  const wkInc   = wkSales.reduce((s,x)=>s+x.total,0);
  const pwkInc  = pwkSales.reduce((s,x)=>s+x.total,0);
  const wkDiff  = pwkInc>0?Math.round(((wkInc-pwkInc)/pwkInc)*100):null;
  const criticals= state.products.filter(p=>p.stock<=p.minStock).length;

  // Rotation
  const rot={};
  m30Sales.forEach(s=>(s.items||[]).forEach(i=>{rot[i.name]=(rot[i.name]||0)+i.qty;}));
  const top5=Object.entries(rot).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxQty=top5[0]?.[1]||1;

  // Dead stock
  const soldSet=new Set(Object.keys(rot));
  const dead=state.products.filter(p=>p.stock>0&&!soldSet.has(p.name));

  // Critical alerts
  const alerts=[...state.products.filter(p=>p.stock===0),...state.products.filter(p=>p.stock>0&&p.stock<=p.minStock)].slice(0,5);

  el.innerHTML=`
    <div class="kpi-row">
      <div class="kpi-card green">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Ingresos hoy</div>
        <div class="kpi-value green">${fmt(income)}</div>
        <div class="kpi-sub">${todaySales.length} venta${todaySales.length!==1?'s':''} · ganancia ${fmt(profit)}</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-icon">📊</div>
        <div class="kpi-label">Esta semana</div>
        <div class="kpi-value blue">${fmt(wkInc)}</div>
        <div class="kpi-sub">${wkDiff!==null?`<span style="color:${wkDiff>=0?'var(--acc)':'var(--red)'}">${wkDiff>=0?'▲':'▼'} ${Math.abs(wkDiff)}%</span> vs sem. ant.`:'primera semana'}</div>
      </div>
      <div class="kpi-card warn">
        <div class="kpi-icon">🏪</div>
        <div class="kpi-label">Capital en stock</div>
        <div class="kpi-value warn">${fmt(invested)}</div>
        <div class="kpi-sub">margen promedio ${margin}%</div>
      </div>
      <div class="kpi-card ${criticals>0?'red':'green'}">
        <div class="kpi-icon">${criticals>0?'🚨':'✅'}</div>
        <div class="kpi-label">Alertas stock</div>
        <div class="kpi-value ${criticals>0?'red':'green'}">${criticals}</div>
        <div class="kpi-sub">${criticals>0?'productos críticos':'todo en orden'}</div>
      </div>
    </div>

    <div class="dash-grid">
      <div style="display:flex;flex-direction:column;gap:1rem">
        <!-- Top productos -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔥 Productos más vendidos — 30 días</div>
            <span class="card-badge green">${m30Sales.length} ventas</span>
          </div>
          <div class="card-body">
            ${top5.length===0
              ?`<div class="empty-state"><div class="es-icon">📦</div><p>Sin ventas registradas aún</p></div>`
              :top5.map(([name,qty],i)=>{
                const p=state.products.find(x=>x.name===name);
                const avgDay=qty/30;
                const dias=p&&avgDay>0?Math.round(p.stock/avgDay):null;
                return `<div class="top-product">
                  <div class="top-product-head">
                    <span class="top-product-name">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '} ${name}</span>
                    <span class="top-product-qty">${qty} uds.</span>
                  </div>
                  <div class="stock-bar"><div class="stock-bar-fill" style="width:${Math.round((qty/maxQty)*100)}%;background:var(--acc)"></div></div>
                  <div class="top-product-meta">${p?`Margen: ${fmt(p.price-p.cost)}/ud · Stock: ${p.stock}`:''}${dias!==null?` · <span style="color:${dias<=7?'var(--red)':dias<=14?'var(--warn)':'var(--text2)'}">~${dias} días de stock</span>`:''}</div>
                </div>`;
              }).join('')}
          </div>
        </div>

        <!-- Semana vs semana -->
        <div class="card">
          <div class="card-header"><div class="card-title">📅 Esta semana vs semana anterior</div></div>
          <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div style="text-align:center;padding:1rem;background:var(--surface2);border-radius:var(--r)">
              <div style="font-size:.72rem;font-weight:600;color:var(--text2);margin-bottom:.4rem;text-transform:uppercase">Esta semana</div>
              <div style="font-size:1.5rem;font-weight:800;color:var(--acc)">${fmt(wkInc)}</div>
              <div style="font-size:.72rem;color:var(--text2);margin-top:.2rem">${wkSales.length} ventas</div>
            </div>
            <div style="text-align:center;padding:1rem;background:var(--surface2);border-radius:var(--r)">
              <div style="font-size:.72rem;font-weight:600;color:var(--text2);margin-bottom:.4rem;text-transform:uppercase">Semana anterior</div>
              <div style="font-size:1.5rem;font-weight:800;color:var(--text2)">${fmt(pwkInc)}</div>
              <div style="font-size:.72rem;color:var(--text2);margin-top:.2rem">${pwkSales.length} ventas</div>
            </div>
            ${wkDiff!==null?`<div style="grid-column:1/-1;text-align:center;font-size:.85rem;font-weight:600;padding:.65rem;border-radius:var(--r);background:${wkDiff>=0?'var(--acc-dim)':'var(--red-dim)'};color:${wkDiff>=0?'var(--acc)':'var(--red)'}">
              ${wkDiff>=0?'▲':'▼'} ${Math.abs(wkDiff)}% ${wkDiff>=0?'más':'menos'} que la semana anterior
            </div>`:''}
          </div>
        </div>

        ${dead.length>0?`<div class="card">
          <div class="card-header"><div class="card-title">💀 Stock sin movimiento — 30 días</div><span class="card-badge red">${dead.length} productos</span></div>
          <table class="tbl">
            <thead><tr><th>Producto</th><th>Stock</th><th>Capital inmovilizado</th></tr></thead>
            <tbody>${dead.map(p=>`<tr>
              <td>${p.emoji||'📦'} ${p.name}</td>
              <td><span class="pill low">${p.stock} uds.</span></td>
              <td class="mono" style="color:var(--warn)">${fmt(p.stock*p.cost)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`:''}
      </div>

      <!-- RIGHT COLUMN -->
      <div style="display:flex;flex-direction:column;gap:1rem">
        <!-- Alertas -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🚨 Alertas de stock</div>
            ${criticals>0?`<span class="card-badge red">${criticals} críticos</span>`:`<span class="card-badge green">OK</span>`}
          </div>
          <div class="card-body">
            ${alerts.length===0
              ?`<div style="text-align:center;color:var(--acc);font-size:.85rem;padding:.5rem">✓ Todo el stock está en orden</div>`
              :`<div class="alert-list">${alerts.map(p=>`<div class="alert-item">
                <div class="alert-dot ${p.stock===0?'red':'warn'}"></div>
                <div class="alert-info">
                  <div class="alert-name">${p.emoji||'📦'} ${p.name}</div>
                  <div class="alert-detail">${p.stock===0?'Sin stock':`${p.stock} uds. (mín: ${p.minStock})`}</div>
                </div>
                <span class="alert-tag ${p.stock===0?'red':'warn'}">${p.stock===0?'URGENTE':'BAJO'}</span>
              </div>`).join('')}</div>`}
          </div>
        </div>

        <!-- Última actividad -->
        <div class="card">
          <div class="card-header"><div class="card-title">⚡ Última actividad</div></div>
          <div>
            ${state.sales.slice(0,6).map(s=>{
              const d=toDate(s.createdAt);
              return `<div class="hist-row">
                <div>
                  <div class="hist-time">${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</div>
                  <div class="hist-desc">${(s.items||[]).slice(0,2).map(i=>`${i.qty}× ${i.name}`).join(', ')}${(s.items||[]).length>2?` +${s.items.length-2} más`:''}</div>
                </div>
                <div class="hist-amount">${fmt(s.total)}</div>
              </div>`;
            }).join('') || `<div style="padding:1rem;text-align:center;color:var(--text2);font-size:.83rem">Sin ventas aún</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════
// ALERTAS + QUÉ COMPRAR
// ══════════════════════════════════════
export function renderAlertas(c) {
  c.innerHTML = `<div id="alerts-root"></div>`;
  buildAlerts();
  const fn = () => buildAlerts();
  window.addEventListener('products-updated', fn);
  c._cleanup = () => window.removeEventListener('products-updated', fn);
}

function buildAlerts() {
  const el = document.getElementById('alerts-root'); if(!el) return;
  const critical = state.products.filter(p=>p.stock===0);
  const low      = state.products.filter(p=>p.stock>0&&p.stock<=p.minStock);
  const all      = [...critical,...low];
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="card">
        <div class="card-header"><div class="card-title">⚡ Stock crítico</div>${all.length>0?`<span class="card-badge red">${all.length}</span>`:''}</div>
        <div class="card-body">
          ${all.length===0?`<div style="text-align:center;color:var(--acc);padding:1rem">✓ Todo en orden</div>`
          :`<div class="alert-list">${all.map(p=>`<div class="alert-item">
            <div class="alert-dot ${p.stock===0?'red':'warn'}"></div>
            <div class="alert-info">
              <div class="alert-name">${p.emoji||'📦'} ${p.name}</div>
              <div class="alert-detail">${p.stock===0?'Sin stock':`${p.stock} uds. — mín: ${p.minStock}`}</div>
            </div>
            <span class="alert-tag ${p.stock===0?'red':'warn'}">${p.stock===0?'URGENTE':'BAJO'}</span>
          </div>`).join('')}</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🛒 Lista de compras sugerida</div></div>
        <div class="card-body">
          ${all.length===0?`<div style="text-align:center;color:var(--text2);padding:1rem;font-size:.85rem">No hay compras urgentes</div>`
          :all.map(p=>{const toBuy=Math.max(p.minStock*3-p.stock,p.minStock); return `<div class="buy-item">
            <div><div class="buy-name">${p.emoji||'📦'} ${p.name}</div><div class="buy-meta">Stock: ${p.stock} · Mín: ${p.minStock}</div></div>
            <div><div class="buy-qty">${toBuy} uds.</div><div class="buy-cost">≈ ${fmt(toBuy*p.cost)}</div></div>
          </div>`;}).join('')}
        </div>
      </div>
    </div>`;
}

export function renderComprar(c) { renderAlertas(c); }

// ══════════════════════════════════════
// ENTRADA DE MERCADERÍA
// ══════════════════════════════════════
export function renderEntrada(c) {
  c.innerHTML = `
    <div style="max-width:700px">
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><div class="card-title">📥 Registrar entrada de mercadería</div></div>
        <div class="card-body">
          <div class="search-wrap">
            <span style="color:var(--text2)">🔍</span>
            <input type="text" id="entrada-search" placeholder="Buscar producto..." oninput="filterEntrada()">
            <button class="btn-sm" onclick="openModal('modal-scanner')" style="flex:0;padding:.4rem .75rem">📷</button>
          </div>
          <div id="entrada-list"></div>
        </div>
      </div>
    </div>`;
  buildEntrada();
  window.addEventListener('products-updated', buildEntrada);
  c._cleanup = () => window.removeEventListener('products-updated', buildEntrada);
}

window.filterEntrada = () => buildEntrada(document.getElementById('entrada-search')?.value?.toLowerCase()||'');

function buildEntrada(filter='') {
  const el = document.getElementById('entrada-list'); if(!el) return;
  const list = state.products.filter(p=>p.name.toLowerCase().includes(filter));
  if(!list.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📦</div><p>Sin productos. Agrega productos en Inventario.</p></div>`;return;}
  el.innerHTML = list.map(p=>`
    <div class="inv-row" id="entrada-${p.id}">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">Stock actual: <b style="color:${p.stock<=p.minStock?'var(--warn)':'var(--acc)'}">${p.stock} uds.</b></div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <button class="qb lg" onclick="quickAdd('${p.id}',1)">+1</button>
        <button class="qb lg" onclick="quickAdd('${p.id}',5)">+5</button>
        <button class="qb lg" onclick="quickAdd('${p.id}',10)">+10</button>
        <input type="number" id="qty-${p.id}" placeholder="Cant." min="1" style="width:70px;padding:.45rem .6rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:.85rem;outline:none;text-align:center" onkeydown="if(event.key==='Enter')addEntrada('${p.id}')">
        <button class="btn-sm" onclick="addEntrada('${p.id}')">Agregar</button>
      </div>
    </div>`).join('');
}

window.quickAdd = async function(id, qty) {
  await addStock(id, qty);
};

window.addEntrada = async function(id) {
  const input = document.getElementById('qty-'+id);
  const qty   = parseInt(input?.value);
  if(!qty||qty<=0){showToast('Ingresa una cantidad válida','err');return;}
  await addStock(id, qty);
  if(input) input.value='';
};

// ══════════════════════════════════════
// SALIDA / VENTAS RÁPIDAS
// ══════════════════════════════════════
let saleCart = [];

export function renderSalida(c) {
  saleCart = [];
  c.innerHTML = `
    <div style="max-width:700px">
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><div class="card-title">📤 Registrar salida / venta</div></div>
        <div class="card-body">
          <div class="search-wrap">
            <span style="color:var(--text2)">🔍</span>
            <input type="text" id="salida-search" placeholder="Buscar producto..." oninput="filterSalida()">
            <button class="btn-sm" onclick="openModal('modal-scanner')" style="flex:0;padding:.4rem .75rem">📷</button>
          </div>
          <div id="salida-list"></div>
        </div>
      </div>
      <!-- Cart -->
      <div class="card" id="salida-cart-card" style="display:none">
        <div class="card-header">
          <div class="card-title">🧾 Venta actual</div>
          <button class="btn-sm ghost" onclick="clearSaleCart()">Limpiar</button>
        </div>
        <div class="card-body">
          <div id="salida-cart"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
            <div>
              <div style="font-size:.72rem;color:var(--text2);margin-bottom:.2rem">Total</div>
              <div style="font-size:1.8rem;font-weight:800;color:var(--acc);font-family:var(--font)" id="salida-total">$0</div>
            </div>
            <button class="btn-primary" style="width:auto;padding:.8rem 1.75rem" onclick="confirmSale()">Confirmar venta →</button>
          </div>
        </div>
      </div>
    </div>`;
  buildSalida();
  window.addEventListener('products-updated', buildSalida);
  c._cleanup = () => window.removeEventListener('products-updated', buildSalida);
}

window.filterSalida = () => buildSalida(document.getElementById('salida-search')?.value?.toLowerCase()||'');

function buildSalida(filter='') {
  const el = document.getElementById('salida-list'); if(!el) return;
  const list = state.products.filter(p=>p.name.toLowerCase().includes(filter)&&p.stock>0);
  if(!list.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📦</div><p>Sin productos con stock disponible</p></div>`;return;}
  el.innerHTML = list.map(p=>`
    <div class="inv-row">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">${fmt(p.price)} · Stock: <b>${p.stock}</b></div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <button class="qb lg" onclick="addToSale('${p.id}',1)">−1</button>
        <button class="qb lg" onclick="addToSaleCustom('${p.id}')">+N</button>
        <button class="btn-sm" onclick="addToSale('${p.id}',1)">Agregar</button>
      </div>
    </div>`).join('');
}

window.addToSale = function(id, qty=1) {
  const p = state.products.find(x=>x.id===id); if(!p) return;
  const inc = saleCart.find(x=>x.id===id);
  if(inc){if(inc.qty>=p.stock){showToast('Sin más stock','err');return;}inc.qty+=qty;}
  else saleCart.push({id:p.id,name:p.name,price:p.price,qty});
  renderSaleCart();
};

window.addToSaleCustom = function(id) {
  const qty = parseInt(prompt('¿Cuántas unidades?')||'0');
  if(qty>0) window.addToSale(id, qty);
};

window.removeSaleItem = function(id) {
  saleCart = saleCart.filter(x=>x.id!==id);
  renderSaleCart();
};

window.clearSaleCart = function() { saleCart=[]; renderSaleCart(); };

function renderSaleCart() {
  const el  = document.getElementById('salida-cart');
  const tot = document.getElementById('salida-total');
  const card= document.getElementById('salida-cart-card');
  if(!el) return;
  if(!saleCart.length){if(card)card.style.display='none';return;}
  if(card) card.style.display='block';
  let sum=0;
  el.innerHTML = saleCart.map(item=>{
    sum+=item.price*item.qty;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:.85rem;font-weight:600">${item.name}</div>
        <div style="font-size:.72rem;color:var(--text2)">${fmt(item.price)} × ${item.qty}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem">
        <span style="font-weight:700;color:var(--acc);font-family:var(--font-mono)">${fmt(item.price*item.qty)}</span>
        <button class="btn-sm danger" onclick="removeSaleItem('${item.id}')" style="padding:.3rem .6rem;font-size:.75rem">✕</button>
      </div>
    </div>`;
  }).join('');
  if(tot) tot.textContent = fmt(sum);
}

window.confirmSale = async function() {
  if(!saleCart.length){showToast('Agrega productos primero','err');return;}
  await recordSale(saleCart);
  saleCart=[];
  renderSaleCart();
  buildSalida();
};

// ══════════════════════════════════════
// INVENTARIO
// ══════════════════════════════════════
let editingId = null;

export function renderInventario(c) {
  c.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">📦 Inventario completo</div>
        <button class="btn-sm" onclick="window.openAddProduct()">＋ Agregar producto</button>
      </div>
      <div class="search-wrap" style="margin:1rem 1rem 0">
        <span style="color:var(--text2)">🔍</span>
        <input type="text" id="inv-search" placeholder="Buscar..." oninput="filterInv()">
      </div>
      <div id="inv-list"></div>
    </div>`;
  buildInv();
  window.addEventListener('products-updated', buildInv);
  c._cleanup = () => window.removeEventListener('products-updated', buildInv);
}

window.filterInv = () => buildInv(document.getElementById('inv-search')?.value?.toLowerCase()||'');

function buildInv(filter='') {
  const el = document.getElementById('inv-list'); if(!el) return;
  const list = state.products.filter(p=>p.name.toLowerCase().includes(filter));
  if(!list.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📦</div><p>Sin productos. Agrega tu primer producto.</p></div>`;return;}
  el.innerHTML = list.map(p=>{
    const col = p.stock===0?'var(--red)':p.stock<=p.minStock?'var(--warn)':'var(--acc)';
    return `<div class="inv-row">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">Venta: ${fmt(p.price)} · Costo: ${fmt(p.cost)} · Mín: ${p.minStock}</div>
        ${p.ean?`<div class="inv-ean">EAN: ${p.ean}</div>`:''}
      </div>
      <div class="inv-ctrl">
        <button class="qb" onclick="adjInvStock('${p.id}',-1)">−</button>
        <span class="inv-stock" style="color:${col}">${p.stock}</span>
        <button class="qb" onclick="adjInvStock('${p.id}',1)">+</button>
      </div>
      <div class="inv-actions">
        <button class="btn-inv" onclick="editProduct('${p.id}')" title="Editar">✏️</button>
        <button class="btn-inv danger" onclick="confirmDelete('${p.id}')" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.adjInvStock = async function(id,d) {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  const ns=Math.max(0,p.stock+d);
  await adjustStockDB(id,ns);
};

window.openAddProduct = function() {
  editingId=null;
  document.getElementById('pm-title').textContent='Agregar producto';
  ['pm-name','pm-price','pm-cost','pm-stock','pm-min','pm-ean','pm-emoji'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  openModal('modal-product');
};

window.editProduct = function(id) {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  editingId=id;
  document.getElementById('pm-title').textContent='Editar producto';
  document.getElementById('pm-name').value =p.name;
  document.getElementById('pm-price').value=p.price;
  document.getElementById('pm-cost').value =p.cost;
  document.getElementById('pm-stock').value=p.stock;
  document.getElementById('pm-min').value  =p.minStock;
  document.getElementById('pm-ean').value  =p.ean||'';
  document.getElementById('pm-emoji').value=p.emoji||'';
  openModal('modal-product');
};

window.saveProduct = async function() {
  const name    =document.getElementById('pm-name').value.trim();
  const price   =parseFloat(document.getElementById('pm-price').value);
  const cost    =parseFloat(document.getElementById('pm-cost').value);
  const stock   =parseInt(document.getElementById('pm-stock').value);
  const minStock=parseInt(document.getElementById('pm-min').value);
  const ean     =document.getElementById('pm-ean').value.trim();
  const emoji   =document.getElementById('pm-emoji').value.trim()||'📦';
  if(!name||isNaN(price)||isNaN(cost)||isNaN(stock)||isNaN(minStock)){showToast('Completa todos los campos','err');return;}
  await saveProductDB({name,price,cost,stock,minStock,ean,emoji},editingId);
  closeModal('modal-product');
  showToast(editingId?'✓ Producto actualizado':'✓ Producto agregado');
};

window.confirmDelete = function(id) {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  document.getElementById('del-name').textContent=p.name;
  const warn=document.getElementById('del-warn');
  if(p.stock>0){warn.textContent=`⚠️ Tiene ${p.stock} unidades en stock`;warn.style.display='block';}
  else warn.style.display='none';
  window._delId=id;
  openModal('modal-delete');
};

window.confirmDeleteExecute = async function() {
  if(!window._delId)return;
  await deleteProductDB(window._delId);
  closeModal('modal-delete');
  showToast('Producto eliminado');
  window._delId=null;
};

// ══════════════════════════════════════
// HISTORIAL
// ══════════════════════════════════════
export function renderHistorial(c) {
  c.innerHTML=`
    <div class="card">
      <div class="card-header"><div class="card-title">📋 Historial de ventas</div></div>
      <div id="hist-list"></div>
    </div>`;
  buildHist();
  window.addEventListener('sales-updated', buildHist);
  c._cleanup = () => window.removeEventListener('sales-updated', buildHist);
}

function buildHist() {
  const el=document.getElementById('hist-list'); if(!el)return;
  if(!state.sales.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📋</div><p>Sin ventas registradas aún</p></div>`;return;}
  el.innerHTML=state.sales.slice(0,80).map(s=>{
    const d=toDate(s.createdAt);
    return `<div class="hist-row">
      <div>
        <div class="hist-time">${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="hist-desc">${(s.items||[]).map(i=>`${i.qty}× ${i.name}`).join(', ')}</div>
      </div>
      <div class="hist-amount">${fmt(s.total)}</div>
    </div>`;
  }).join('');
}

window.scanForProduct = function() { import('./scanner.js').then(m=>m.openScanner('product')); };
window.closeModal = closeModal;
window.openModal  = openModal;
