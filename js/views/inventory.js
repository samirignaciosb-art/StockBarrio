// views/inventory.js
import { state, fmt, showToast, openModal, closeModal } from '../utils.js';
import { saveProductDB, deleteProductDB, adjustStockDB } from '../data.js';

let editingId=null;

export function renderInventario(c){
  c.innerHTML=`
    <div class="card" style="animation:fadeIn .3s ease">
      <div class="card-header">
        <div class="card-title">📦 Inventario completo</div>
        <button class="btn-sm" onclick="openAddProduct()">＋ Agregar</button>
      </div>
      <div class="search-wrap" style="margin:1rem 1rem 0">
        <span style="color:var(--text2)">🔍</span>
        <input type="text" id="inv-search" placeholder="Buscar producto o EAN..." oninput="filterInv()">
        <button class="btn-sm ghost" style="flex:0;padding:.4rem .75rem" onclick="openScanner('product')" title="Escanear EAN">📷</button>
      </div>
      <div id="inv-list"></div>
    </div>`;
  buildInv();
  window.addEventListener('products-updated',buildInv);
}

window.filterInv = () => buildInv(document.getElementById('inv-search')?.value?.toLowerCase()||'');
window.openScanner = (mode) => import('../scanner.js').then(m=>m.openScanner(mode));

function buildInv(filter=''){
  const el=document.getElementById('inv-list'); if(!el)return;
  const list=state.products.filter(p=>
    p.name.toLowerCase().includes(filter)||
    (p.ean&&p.ean.includes(filter))
  );
  if(!list.length){
    el.innerHTML=`<div class="empty-state"><div class="es-icon">📦</div><p>Sin productos. Agrega el primero.</p></div>`;
    return;
  }
  el.innerHTML=list.map(p=>{
    const col=p.stock===0?'var(--red)':p.stock<=p.minStock?'var(--warn)':'var(--acc)';
    return `<div class="inv-row">
      <div class="inv-emoji">${p.emoji||'📦'}</div>
      <div class="inv-info">
        <div class="inv-name">${p.name}</div>
        <div class="inv-prices">Venta: ${fmt(p.price)} · Costo: ${fmt(p.cost)} · Mín: ${p.minStock} · Margen: ${p.price>0?Math.round(((p.price-p.cost)/p.price)*100):0}%</div>
        ${p.ean?`<div class="inv-ean">EAN: ${p.ean}</div>`:''}
      </div>
      <div class="inv-ctrl">
        <button class="qb" onclick="adjInv('${p.id}',-1)">−</button>
        <span class="inv-stock" style="color:${col}">${p.stock}</span>
        <button class="qb" onclick="adjInv('${p.id}',1)">+</button>
      </div>
      <div class="inv-actions">
        <button class="btn-inv" onclick="editProduct('${p.id}')" title="Editar">✏️</button>
        <button class="btn-inv danger" onclick="confirmDelete('${p.id}')" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.adjInv = async (id,d) => {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  await adjustStockDB(id, Math.max(0,p.stock+d), 'Ajuste manual', 'manual');
};

window.openAddProduct = () => {
  editingId=null;
  document.getElementById('pm-title').textContent='Agregar producto';
  ['pm-name','pm-price','pm-cost','pm-stock','pm-min','pm-ean'].forEach(id=>{
    const e=document.getElementById(id); if(e)e.value='';
  });
  window._pendingEmoji=null;
  const hint=document.getElementById('ean-hint');
  if(hint){hint.textContent='';hint.style.display='none';}
  openModal('modal-product');
};

window.editProduct = id => {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  editingId=id;
  document.getElementById('pm-title').textContent='Editar producto';
  document.getElementById('pm-name').value =p.name;
  document.getElementById('pm-price').value=p.price;
  document.getElementById('pm-cost').value =p.cost;
  document.getElementById('pm-stock').value=p.stock;
  document.getElementById('pm-min').value  =p.minStock;
  document.getElementById('pm-ean').value  =p.ean||'';
  window._pendingEmoji=p.emoji||'📦';
  const hint=document.getElementById('ean-hint');
  if(hint){hint.textContent='';hint.style.display='none';}
  openModal('modal-product');
};

window.saveProduct = async () => {
  const name    =document.getElementById('pm-name').value.trim();
  const price   =parseFloat(document.getElementById('pm-price').value);
  const cost    =parseFloat(document.getElementById('pm-cost').value);
  const stock   =parseInt(document.getElementById('pm-stock').value);
  const minStock=parseInt(document.getElementById('pm-min').value);
  const ean     =document.getElementById('pm-ean').value.trim();
  const emoji   =window._pendingEmoji||'📦';

  if(!name||isNaN(price)||isNaN(cost)||isNaN(stock)||isNaN(minStock)){
    showToast('Completa todos los campos','err'); return;
  }
  await saveProductDB({name,price,cost,stock,minStock,ean,emoji}, editingId);
  closeModal('modal-product');
  showToast(editingId?'✓ Producto actualizado':'✓ Producto agregado');
};

window.confirmDelete = id => {
  const p=state.products.find(x=>x.id===id); if(!p)return;
  document.getElementById('del-name').textContent=p.name;
  const warn=document.getElementById('del-warn');
  if(p.stock>0){warn.textContent=`⚠️ Tiene ${p.stock} unidades en stock`;warn.style.display='block';}
  else warn.style.display='none';
  window._delId=id;
  openModal('modal-delete');
};

window.confirmDeleteExecute = async () => {
  if(!window._delId)return;
  await deleteProductDB(window._delId);
  closeModal('modal-delete');
  showToast('Producto eliminado');
  window._delId=null;
};

window.scanForProduct = () => import('../scanner.js').then(m=>m.openScanner('product'));
window.closeModal = closeModal;
window.openModal  = openModal;
