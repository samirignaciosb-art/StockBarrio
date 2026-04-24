// data.js — Firestore CRUD + listeners
import { db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp, setDoc, getDoc } from './firebase.js';
import { state, showToast, queueSale, getQueue, clearQueue, toDate } from './utils.js';

// ══════════════════════════════════════
// LISTENERS
// ══════════════════════════════════════
export function startListeners(uid) {
  const unsubP = onSnapshot(collection(db,'stores',uid,'products'), snap => {
    state.products = snap.docs.map(d=>({id:d.id,...d.data()}));
    window.dispatchEvent(new Event('products-updated'));
  });
  const unsubS = onSnapshot(
    query(collection(db,'stores',uid,'sales'), orderBy('createdAt','desc'), limit(300)),
    snap => { state.sales = snap.docs.map(d=>({id:d.id,...d.data()})); window.dispatchEvent(new Event('sales-updated')); }
  );
  const unsubA = onSnapshot(
    query(collection(db,'stores',uid,'adjustments'), orderBy('createdAt','desc'), limit(200)),
    snap => { state.adjustments = snap.docs.map(d=>({id:d.id,...d.data()})); window.dispatchEvent(new Event('adjustments-updated')); }
  );
  state.unsubs.push(unsubP, unsubS, unsubA);
  window.addEventListener('online', syncOfflineQueue);
}

// ══════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════
export async function saveProductDB(data, id=null) {
  const uid = state.uid;
  if(id) await updateDoc(doc(db,'stores',uid,'products',id), {...data, updatedAt:serverTimestamp()});
  else   await addDoc(collection(db,'stores',uid,'products'), {...data, createdAt:serverTimestamp()});
}

export async function deleteProductDB(id) {
  await deleteDoc(doc(db,'stores',state.uid,'products',id));
}

export async function adjustStockDB(id, newStock, reason='', type='manual') {
  const uid = state.uid;
  const p   = state.products.find(x=>x.id===id);
  if(!p) return;
  const prev = p.stock;
  await updateDoc(doc(db,'stores',uid,'products',id), {stock:newStock, updatedAt:serverTimestamp()});
  // Log adjustment
  if(reason || type !== 'sale') {
    await addDoc(collection(db,'stores',uid,'adjustments'), {
      productId: id, productName: p.name,
      prev, next: newStock, diff: newStock-prev,
      type, reason, createdAt: serverTimestamp()
    });
  }
}

// ══════════════════════════════════════
// STOCK ENTRY (mercadería que entra)
// ══════════════════════════════════════
export async function addStockEntry(id, qty, reason='Entrada de mercadería') {
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  await adjustStockDB(id, p.stock+qty, reason, 'entry');
  showToast(`✓ +${qty} ${p.name}`);
}

// ══════════════════════════════════════
// SALES
// ══════════════════════════════════════
export async function recordSale(items) {
  const uid   = state.uid;
  const total = items.reduce((s,i)=>s+i.price*i.qty, 0);
  const cost  = items.reduce((s,i)=>{const p=state.products.find(x=>x.id===i.id);return s+(p?p.cost*i.qty:0);}, 0);
  const saleData = { items, total, cost, createdAt: new Date().toISOString() };

  if(!state.isOnline) {
    // Offline: update stock locally + queue
    state.products.forEach(p => {
      const c = items.find(x=>x.id===p.id);
      if(c) p.stock = Math.max(0, p.stock-c.qty);
    });
    window.dispatchEvent(new Event('products-updated'));
    queueSale({...saleData, uid});
    state.sales.unshift({id:'local-'+Date.now(), ...saleData});
    window.dispatchEvent(new Event('sales-updated'));
    showToast('Venta guardada offline','warn');
    return;
  }

  // Online
  for(const item of items) {
    const p = state.products.find(x=>x.id===item.id);
    if(p) await updateDoc(doc(db,'stores',uid,'products',p.id), {stock: Math.max(0,p.stock-item.qty), updatedAt:serverTimestamp()});
  }
  await addDoc(collection(db,'stores',uid,'sales'), {...saleData, createdAt:serverTimestamp()});
  showToast('✓ Venta registrada');
}

async function syncOfflineQueue() {
  const q = getQueue();
  if(!q.length) return;
  for(const sale of q) {
    const {uid,...data}=sale;
    try { await addDoc(collection(db,'stores',uid,'sales'),{...data,createdAt:serverTimestamp(),_offline:true}); }
    catch(e){}
  }
  clearQueue();
  showToast(`✓ ${q.length} venta(s) sincronizadas`);
}

// ══════════════════════════════════════
// EAN CACHE (base global compartida)
// ══════════════════════════════════════
export async function lookupEANCache(ean) {
  try {
    const snap = await getDoc(doc(db,'ean_cache',ean));
    return snap.exists() ? snap.data() : null;
  } catch(e) { return null; }
}

export async function saveEANCache(ean, data) {
  try { await setDoc(doc(db,'ean_cache',ean), {...data, cachedAt:new Date().toISOString()}); }
  catch(e) {}
}
