// views/operations.js
import { state, fmt, toDate, showToast, openModal } from '../utils.js';
import { addStockEntry, recordSale, adjustStockDB } from '../data.js';

// ══════════════════════════════════════
// ALERTAS — solo quiebres de stock
// ══════════════════════════════════════
export function renderAlertas(c) {
  c.innerHTML = `<div id="alerts-root" style="animation:fadeIn .3s ease"></div>`;
  buildAlerts();
  window.addEventListener('products-updated', buildAlerts);
}

function buildAlerts() {
  const el = document.getElementById('alerts-root'); if (!el) return;
  const critical = state.products.filter(p => p.stock === 0);
  const low      = state.products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const all      = [...critical, ...low];

  el.innerHTML = `
    <div style="max-width:640px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🚨 Quiebres de stock</div>
          ${all.length ? `<span class="card-badge red">${all.length} producto${all.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="card-body">
          ${all.length === 0
            ? `<div style="text-align:center;padding:2.5rem;color:var(--acc)">
                <div style="font-size:2rem;margin-bottom:.5rem">✓</div>
                <div style="font-weight:600">Todo el stock está en orden</div>
                <div style="font-size:.82rem;color:var(--text2);margin-top:.35rem">No hay productos con stock bajo o agotado</div>
               </div>`
            : `<div style="display:flex;flex-direction:column;gap:.5rem">
                ${critical.length ? `<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--red);margin:.25rem 0 .15rem;letter-spacing:.05em">Sin stock (${critical.length})</div>` : ''}
                ${critical.map(p => alertRow(p)).join('')}
                ${low.length ? `<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--warn);margin:.5rem 0 .15rem;letter-spacing:.05em">Stock bajo (${low.length})</div>` : ''}
                ${low.map(p => alertRow(p)).join('')}
               </div>`
          }
        </div>
      </div>
      ${all.length > 0 ? `
      <div style="margin-top:.75rem;text-align:center">
        <button class="btn-sm" onclick="navigate('comprar')">🛒 Ver lista de compras →</button>
      </div>` : ''}
    </div>`;
}

function alertRow(p) {
  const isOut = p.stock === 0;
  return `<div class="alert-item">
    <div class="alert-dot ${isOut ? 'red' : 'warn'}"></div>
    <div class="alert-info">
      <div class="alert-name">${p.emoji || '📦'} ${p.name}</div>
      <div class="alert-detail">${isOut ? 'Sin stock' : `${p.stock} uds. — mínimo: ${p.minStock}`}</div>
    </div>
    <span class="alert-tag ${isOut ? 'red' : 'warn'}">${isOut ? 'URGENTE' : 'BAJO'}</span>
  </div>`;
}
}

// ══════════════════════════════════════
// ENTRADA DE MERCADERÍA — flujo rápido
// ══════════════════════════════════════
export function renderEntrada(c) {
  c.innerHTML=`
    <div style="max-width:680px;animation:fadeIn .3s ease">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📥 Entrada de mercadería</div>
          <button class="btn-sm" onclick="openScanner('entry')">📷 Escanear</button>
        </div>
        <div class="card-body">
          <div class="search-wrap">
            <span style="color:var(--text2)">🔍</span>
            <input type="text" id="entrada-search" placeholder="Buscar producto..." oninput="filterEntrada()">
          </div>
          <div id="entrada-list"></div>
        </div>
      </div>
    </div>`;
  buildEntrada();
  // Pistola/escáner directo a entrada
  window._entryProduct = id => focusEntryProduct(id);
  window.addEventListener('products-updated',()=>buildEntrada(document.getElementById('entrada-search')?.value?.toLowerCase()||''));
}

window.filterEntrada = () => buildEntrada(document.getElementById('entrada-search')?.value?.toLowerCase()||'');

function buildEntrada(filter=''){
  const el=document.getElementById('entrada-list'); if(!el)return;
  const list=state.products.filter(p=>p.name.toLowerCase().includes(filter));
  if(!list.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📦</div><p>Sin productos</p></div>`;return;}
  el.innerHTML=list.map(p=>`
    <div class="inv-row" id="entry-row-${p.id}">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">Stock actual: <b style="color:${p.stock<=p.minStock?'var(--warn)':'var(--acc)'}">${p.stock} uds.</b></div>
      </div>
      <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;justify-content:flex-end">
        <button class="qb lg" onclick="quickEntry('${p.id}',1)">+1</button>
        <button class="qb lg" onclick="quickEntry('${p.id}',5)">+5</button>
        <button class="qb lg" onclick="quickEntry('${p.id}',10)">+10</button>
        <input type="number" id="eq-${p.id}" placeholder="N" min="1" inputmode="numeric"
          style="width:58px;padding:.42rem .5rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:.85rem;text-align:center;outline:none"
          onkeydown="if(event.key==='Enter')customEntry('${p.id}')">
        <button class="btn-sm" onclick="customEntry('${p.id}')">Agregar</button>
      </div>
    </div>`).join('');
}

window.quickEntry = async (id,qty) => { await addStockEntry(id,qty); };

window.customEntry = async (id) => {
  const input=document.getElementById('eq-'+id);
  const qty=parseInt(input?.value);
  if(!qty||qty<=0){showToast('Ingresa cantidad','err');return;}
  await addStockEntry(id,qty);
  if(input) input.value='';
};

function focusEntryProduct(id) {
  const row=document.getElementById('entry-row-'+id);
  if(row){ row.scrollIntoView({behavior:'smooth',block:'center'}); document.getElementById('eq-'+id)?.focus(); }
}

window.openScanner = (mode) => import('../scanner.js').then(m=>m.openScanner(mode));

// ══════════════════════════════════════
// SALIDA / VENTAS
// ══════════════════════════════════════
let saleCart=[];

export function renderSalida(c) {
  saleCart=[];
  c.innerHTML=`
    <div style="max-width:700px;animation:fadeIn .3s ease">
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header">
          <div class="card-title">📤 Registrar salida / venta</div>
          <button class="btn-sm" onclick="openScanner('sell')">📷 Escanear</button>
        </div>
        <div class="card-body">
          <div class="search-wrap">
            <span style="color:var(--text2)">🔍</span>
            <input type="text" id="salida-search" placeholder="Buscar producto..." oninput="filterSalida()">
          </div>
          <div id="salida-list"></div>
        </div>
      </div>
      <div class="card" id="sale-cart-card" style="display:none">
        <div class="card-header">
          <div class="card-title">🧾 Venta actual</div>
          <button class="btn-sm ghost" onclick="clearSaleCart()">Limpiar</button>
        </div>
        <div class="card-body">
          <div id="sale-cart-items"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);gap:.75rem">
            <div>
              <div style="font-size:.7rem;color:var(--text2)">Total a cobrar</div>
              <div style="font-size:2rem;font-weight:800;color:var(--acc);font-family:var(--font-mono)" id="sale-total">$0</div>
            </div>
            <button class="btn-primary" style="width:auto;padding:.85rem 1.75rem" onclick="confirmSale()">Cobrar →</button>
          </div>
        </div>
      </div>
    </div>`;
  buildSalida();
  window.addEventListener('products-updated',buildSalida);
}

window.filterSalida = () => buildSalida(document.getElementById('salida-search')?.value?.toLowerCase()||'');

function buildSalida(filter=''){
  const el=document.getElementById('salida-list'); if(!el)return;
  const list=state.products.filter(p=>p.name.toLowerCase().includes(filter)&&p.stock>0);
  if(!list.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📦</div><p>Sin productos con stock</p></div>`;return;}
  el.innerHTML=list.map(p=>`
    <div class="inv-row">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">${fmt(p.price)} · Stock: <b>${p.stock}</b></div>
      </div>
      <div style="display:flex;align-items:center;gap:.45rem">
        <button class="qb lg" onclick="addToSale('${p.id}',1)">−1</button>
        <button class="btn-sm" onclick="addToSale('${p.id}',1)">Agregar</button>
      </div>
    </div>`).join('');
}

window.addToSale = (id,qty=1) => {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  const inc=saleCart.find(x=>x.id===id);
  if(inc){if(inc.qty>=p.stock){showToast('Sin más stock','err');return;}inc.qty+=qty;}
  else saleCart.push({id:p.id,name:p.name,price:p.price,qty});
  renderSaleCart();
};

window.removeSaleItem = id => { saleCart=saleCart.filter(x=>x.id!==id); renderSaleCart(); };
window.clearSaleCart  = ()  => { saleCart=[]; renderSaleCart(); };

function renderSaleCart(){
  const el=document.getElementById('sale-cart-items');
  const tot=document.getElementById('sale-total');
  const card=document.getElementById('sale-cart-card');
  if(!el)return;
  if(!saleCart.length){if(card)card.style.display='none';return;}
  if(card)card.style.display='block';
  let sum=0;
  el.innerHTML=saleCart.map(item=>{
    sum+=item.price*item.qty;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:.85rem;font-weight:600">${item.name}</div>
        <div style="font-size:.72rem;color:var(--text2)">${fmt(item.price)} × ${item.qty} = ${fmt(item.price*item.qty)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem">
        <button class="qb" onclick="changeSaleQty('${item.id}',-1)">−</button>
        <span style="font-weight:700;min-width:20px;text-align:center">${item.qty}</span>
        <button class="qb" onclick="changeSaleQty('${item.id}',1)">+</button>
        <button onclick="removeSaleItem('${item.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:.2rem">✕</button>
      </div>
    </div>`;
  }).join('');
  if(tot) tot.textContent=fmt(sum);
}

window.changeSaleQty = (id,d) => {
  const item=saleCart.find(x=>x.id===id); if(!item)return;
  const p=state.products.find(x=>x.id===id);
  item.qty+=d;
  if(item.qty<=0) saleCart=saleCart.filter(x=>x.id!==id);
  else if(p&&item.qty>p.stock){item.qty=p.stock;showToast('Máximo stock disponible','warn');}
  renderSaleCart();
};

window.confirmSale = async () => {
  if(!saleCart.length){showToast('Agrega productos','err');return;}
  await recordSale(saleCart);
  saleCart=[]; renderSaleCart(); buildSalida();
};

// ══════════════════════════════════════
// HISTORIAL
// ══════════════════════════════════════
export function renderHistorial(c){
  c.innerHTML=`<div class="card" style="animation:fadeIn .3s ease"><div class="card-header"><div class="card-title">📋 Historial de ventas</div></div><div id="hist-list"></div></div>`;
  buildHist();
  window.addEventListener('sales-updated',buildHist);
}
function buildHist(){
  const el=document.getElementById('hist-list'); if(!el)return;
  if(!state.sales.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">📋</div><p>Sin ventas aún</p></div>`;return;}
  el.innerHTML=state.sales.slice(0,100).map(s=>{
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

// ══════════════════════════════════════
// AJUSTES DE STOCK — historial
// ══════════════════════════════════════
export function renderAjustes(c){
  c.innerHTML=`<div class="card" style="animation:fadeIn .3s ease"><div class="card-header"><div class="card-title">🔧 Historial de ajustes</div></div><div id="adj-list"></div></div>`;
  buildAdj();
  window.addEventListener('adjustments-updated',buildAdj);
}
function buildAdj(){
  const el=document.getElementById('adj-list'); if(!el)return;
  if(!state.adjustments.length){el.innerHTML=`<div class="empty-state"><div class="es-icon">🔧</div><p>Sin ajustes registrados</p></div>`;return;}
  el.innerHTML=state.adjustments.slice(0,100).map(a=>{
    const d=toDate(a.createdAt);
    const diffColor=a.diff>0?'var(--acc)':a.diff<0?'var(--red)':'var(--text2)';
    const typeLabel={'entry':'Entrada','manual':'Ajuste manual','sale':'Venta','toma':'Toma inventario'}[a.type]||a.type;
    return `<div class="hist-row">
      <div>
        <div class="hist-time">${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})} · <span class="pill blue" style="font-size:.65rem;padding:.1rem .4rem">${typeLabel}</span></div>
        <div class="hist-desc">${a.productName} — ${a.prev} → ${a.next} uds.${a.reason?` · ${a.reason}`:''}</div>
      </div>
      <div style="font-family:var(--font-mono);font-weight:800;color:${diffColor};white-space:nowrap">${a.diff>0?'+':''}${a.diff}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════
// TOMA DE INVENTARIO — modo especial Pro
// ══════════════════════════════════════
let tomaItems={};

export function renderToma(c){
  tomaItems={};
  c.innerHTML=`
    <div style="max-width:700px;animation:fadeIn .3s ease">
      <div style="background:linear-gradient(135deg,var(--blue-dim),var(--acc-dim));border:1px solid var(--border);border-radius:var(--r-lg);padding:1.1rem 1.25rem;margin-bottom:1rem;display:flex;gap:.85rem;align-items:flex-start">
        <div style="font-size:1.75rem">📋</div>
        <div>
          <div style="font-size:.92rem;font-weight:700;margin-bottom:.2rem">Modo toma de inventario</div>
          <div style="font-size:.78rem;color:var(--text2);line-height:1.5">Escanea o busca cada producto y registra el stock físico real. Al finalizar se actualizan todos los stocks de una vez y queda registrado el ajuste.</div>
        </div>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header">
          <div class="card-title">Conteo de productos</div>
          <button class="btn-sm" onclick="openScanner('toma')">📷 Escanear</button>
        </div>
        <div class="card-body">
          <div class="search-wrap">
            <span style="color:var(--text2)">🔍</span>
            <input type="text" id="toma-search" placeholder="Buscar producto..." oninput="filterToma()">
          </div>
          <div id="toma-list"></div>
        </div>
      </div>
      <div style="display:flex;gap:.75rem">
        <button class="btn-primary" style="flex:1" onclick="finalizarToma()">✓ Finalizar y actualizar stocks</button>
        <button class="btn-sm ghost" onclick="clearToma()">Limpiar conteo</button>
      </div>
      <div style="font-size:.72rem;color:var(--text2);text-align:center;margin-top:.5rem" id="toma-summary"></div>
    </div>`;
  buildToma();
  // Escáner → enfocar producto en toma
  window._tomaBarcode = code => {
    const p=state.products.find(x=>x.ean===code);
    if(p){ focusTomaProduct(p.id); showToast(`✓ ${p.name}`); }
    else showToast(`Código ${code} no registrado`,'err');
  };
  window.addEventListener('products-updated',buildToma);
}

window.filterToma = () => buildToma(document.getElementById('toma-search')?.value?.toLowerCase()||'');

function buildToma(filter=''){
  const el=document.getElementById('toma-list'); if(!el)return;
  const list=state.products.filter(p=>p.name.toLowerCase().includes(filter));
  el.innerHTML=list.map(p=>{
    const counted=tomaItems[p.id];
    const diff=counted!==undefined?counted-p.stock:null;
    const diffStr=diff!==null?(diff>0?`<span style="color:var(--acc)">+${diff}</span>`:diff<0?`<span style="color:var(--red)">${diff}</span>`:`<span style="color:var(--text2)">sin cambio</span>`):'';
    return `<div class="inv-row" id="toma-row-${p.id}">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">Sistema: <b>${p.stock} uds.</b>${diff!==null?` · Diferencia: ${diffStr}`:''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.45rem">
        <input type="number" id="toma-${p.id}" placeholder="Contado"
          value="${counted!==undefined?counted:''}" min="0" inputmode="numeric"
          style="width:85px;padding:.48rem .55rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:.88rem;text-align:center;outline:none;transition:border-color .2s"
          oninput="updateToma('${p.id}',this.value)"
          onfocus="this.style.borderColor='var(--acc)'" onblur="this.style.borderColor='var(--border)'">
      </div>
    </div>`;
  }).join('');
  updateTomaSummary();
}

window.updateToma = (id,val) => {
  const n=parseInt(val);
  if(!isNaN(n)&&n>=0) tomaItems[id]=n;
  else delete tomaItems[id];
  updateTomaSummary();
  // Update diff display inline
  const p=state.products.find(x=>x.id===id);
  if(p){
    const row=document.getElementById('toma-row-'+id);
    if(row){
      const diff=tomaItems[id]!==undefined?tomaItems[id]-p.stock:null;
      const pricesEl=row.querySelector('.inv-prices');
      if(pricesEl) pricesEl.innerHTML=`Sistema: <b>${p.stock} uds.</b>${diff!==null?` · Diferencia: ${diff>0?`<span style="color:var(--acc)">+${diff}</span>`:diff<0?`<span style="color:var(--red)">${diff}</span>`:`<span style="color:var(--text2)">sin cambio</span>`}`:''}`;
    }
  }
};

function focusTomaProduct(id){
  const input=document.getElementById('toma-'+id);
  if(input){ input.scrollIntoView({behavior:'smooth',block:'center'}); input.focus(); }
}

function updateTomaSummary(){
  const el=document.getElementById('toma-summary'); if(!el)return;
  const count=Object.keys(tomaItems).length;
  el.textContent=count>0?`${count} de ${state.products.length} productos contados`:'';
}

window.clearToma = () => { tomaItems={}; buildToma(); };

window.finalizarToma = async () => {
  const ids=Object.keys(tomaItems);
  if(!ids.length){showToast('Contá al menos un producto','err');return;}
  if(!confirm(`¿Actualizar stock de ${ids.length} producto(s)?`))return;
  for(const id of ids){
    await adjustStockDB(id, tomaItems[id], 'Toma de inventario', 'toma');
  }
  showToast(`✓ ${ids.length} productos actualizados`);
  tomaItems={};
  buildToma();
  setTimeout(()=>window.navigate?.('ajustes'),1200);
};

// ══════════════════════════════════════
// QUÉ COMPRAR — checklist de supermercado
// ══════════════════════════════════════
export function renderComprar(c) {
  c.innerHTML = `<div id="comprar-root" style="animation:fadeIn .3s ease"></div>`;
  buildComprar();
  window.addEventListener('products-updated', buildComprar);
}

function getChecked() {
  try { return JSON.parse(localStorage.getItem('sb_comprar_checked') || '[]'); } catch { return []; }
}
function setChecked(arr) {
  localStorage.setItem('sb_comprar_checked', JSON.stringify(arr));
}

function buildComprar() {
  const el = document.getElementById('comprar-root'); if (!el) return;
  const critical = state.products.filter(p => p.stock === 0);
  const low      = state.products.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const all      = [...critical, ...low];
  const checked  = getChecked();
  const pending  = all.filter(p => !checked.includes(p.id));
  const done     = all.filter(p =>  checked.includes(p.id));
  const total    = all.reduce((s, p) => {
    const toBuy = Math.max(p.minStock * 3 - p.stock, p.minStock);
    return s + toBuy * p.cost;
  }, 0);

  el.innerHTML = `
    <div style="max-width:620px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🛒 Lista de compras</div>
          <div style="display:flex;gap:.5rem;align-items:center">
            ${all.length > 0 ? `<span style="font-size:.78rem;color:var(--text2)">${done.length}/${all.length} listo</span>` : ''}
            ${checked.length > 0 ? `<button class="btn-sm ghost" style="padding:.28rem .6rem;font-size:.72rem" onclick="resetComprar()">↺ Resetear</button>` : ''}
          </div>
        </div>
        ${all.length === 0
          ? `<div style="padding:2.5rem;text-align:center;color:var(--acc)">
              <div style="font-size:2rem;margin-bottom:.5rem">✓</div>
              <div style="font-weight:600">No hay compras urgentes</div>
              <div style="font-size:.82rem;color:var(--text2);margin-top:.35rem">Todo el stock está en orden</div>
             </div>`
          : `<div>
              ${pending.length > 0 ? `
                <div style="padding:.6rem 1.1rem .3rem;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--text2);letter-spacing:.06em">
                  Pendiente (${pending.length})
                </div>
                ${pending.map(p => comprarRow(p, false)).join('')}` : ''}
              ${done.length > 0 ? `
                <div style="padding:.6rem 1.1rem .3rem;font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--text2);letter-spacing:.06em;border-top:1px solid var(--border);margin-top:.5rem">
                  En el carrito ✓ (${done.length})
                </div>
                ${done.map(p => comprarRow(p, true)).join('')}` : ''}
             </div>
             <div style="display:flex;justify-content:space-between;align-items:center;padding:.85rem 1.1rem;border-top:1px solid var(--border);background:var(--surface2)">
               <span style="font-size:.82rem;color:var(--text2)">Costo total estimado</span>
               <span style="font-weight:800;color:var(--warn);font-family:var(--font-mono)">${fmt(total)}</span>
             </div>`
        }
      </div>
      <div style="margin-top:.6rem;font-size:.72rem;color:var(--text2);text-align:center">
        Cantidad sugerida = mínimo × 3 — toca un ítem para marcarlo como comprado
      </div>
    </div>`;
}

function comprarRow(p, isDone) {
  const toBuy = Math.max(p.minStock * 3 - p.stock, p.minStock);
  const isOut = p.stock === 0;
  const urgColor = isOut ? 'var(--red)' : 'var(--warn)';
  return `
    <div onclick="toggleComprar('${p.id}')" style="display:flex;align-items:center;gap:.85rem;padding:.8rem 1.1rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;${isDone ? 'opacity:.5' : ''}"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isDone ? 'var(--acc)' : urgColor};
        background:${isDone ? 'var(--acc)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s">
        ${isDone ? '<span style="color:#fff;font-size:.75rem;font-weight:900">✓</span>' : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.9rem;${isDone ? 'text-decoration:line-through' : ''}">${p.emoji || '📦'} ${p.name}</div>
        <div style="font-size:.73rem;color:var(--text2);margin-top:.15rem">
          Stock: <b style="color:${urgColor}">${p.stock}</b> · mín: ${p.minStock}${!isDone ? ` · <b style="color:${urgColor}">${isOut ? '⚡ URGENTE' : '⚠ Bajo'}</b>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:700;font-size:.9rem">${toBuy} uds.</div>
        <div style="font-size:.72rem;color:var(--text2)">≈ ${fmt(toBuy * p.cost)}</div>
      </div>
    </div>`;
}

window.toggleComprar = (id) => {
  const checked = getChecked();
  const idx = checked.indexOf(id);
  if (idx === -1) checked.push(id);
  else checked.splice(idx, 1);
  setChecked(checked);
  buildComprar();
};

window.resetComprar = () => {
  localStorage.removeItem('sb_comprar_checked');
  buildComprar();
};
