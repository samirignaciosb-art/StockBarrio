// data.js — Firestore listeners
import { db, collection, onSnapshot, query, orderBy, limit, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from './firebase.js';
import { state, showToast, queueSale, getQueue, clearQueue, toDate } from './utils.js';

export function startListeners(uid) {
  // Products
  const unsubP = onSnapshot(collection(db,'stores',uid,'products'), snap => {
    state.products = snap.docs.map(d=>({id:d.id,...d.data()}));
    window.dispatchEvent(new Event('products-updated'));
  });
  // Sales
  const unsubS = onSnapshot(query(collection(db,'stores',uid,'sales'),orderBy('createdAt','desc'),limit(300)), snap => {
    state.sales = snap.docs.map(d=>({id:d.id,...d.data()}));
    window.dispatchEvent(new Event('sales-updated'));
  });
  state.unsubs.push(unsubP, unsubS);
  window.addEventListener('online', syncOfflineQueue);
}

// ── PRODUCTS CRUD ──
export async function saveProductDB(data, id=null) {
  const uid = state.uid;
  if(id) await updateDoc(doc(db,'stores',uid,'products',id), data);
  else   await addDoc(collection(db,'stores',uid,'products'),{...data,createdAt:serverTimestamp()});
}

export async function deleteProductDB(id) {
  await deleteDoc(doc(db,'stores',state.uid,'products',id));
}

export async function adjustStockDB(id, newStock) {
  await updateDoc(doc(db,'stores',state.uid,'products',id),{stock:newStock});
}

// ── SALES ──
export async function recordSale(items) {
  const uid   = state.uid;
  const total = items.reduce((s,i)=>s+i.price*i.qty,0);
  const cost  = items.reduce((s,i)=>{const p=state.products.find(x=>x.id===i.id);return s+(p?p.cost*i.qty:0);},0);
  const saleData = { items, total, cost, createdAt: new Date().toISOString() };

  // Update stock locally + DB
  for(const item of items) {
    const p = state.products.find(x=>x.id===item.id);
    if(!p)continue;
    const ns = Math.max(0, p.stock - item.qty);
    if(state.isOnline) await adjustStockDB(p.id, ns);
    else p.stock = ns;
  }

  if(state.isOnline) {
    await addDoc(collection(db,'stores',uid,'sales'),{...saleData,createdAt:serverTimestamp()});
  } else {
    queueSale({...saleData,uid});
    state.sales.unshift({id:'local-'+Date.now(),...saleData});
    window.dispatchEvent(new Event('sales-updated'));
    showToast('Venta guardada offline — sincronizará al reconectar','warn');
    return;
  }
  showToast('✓ Venta registrada');
}

// Stock entry (mercadería que entra)
export async function addStock(id, qty) {
  const p = state.products.find(x=>x.id===id);
  if(!p)return;
  await adjustStockDB(id, p.stock + qty);
  showToast(`✓ +${qty} unidades registradas`);
}

async function syncOfflineQueue() {
  const q = getQueue();
  if(!q.length)return;
  for(const sale of q) {
    const {uid,...data}=sale;
    try { await addDoc(collection(db,'stores',uid,'sales'),{...data,createdAt:serverTimestamp(),_offline:true}); }
    catch(e){}
  }
  clearQueue();
  showToast(`✓ ${q.length} venta(s) sincronizadas`);
}
