// ════════════════════════════════════════
// auth.js — Login dueño, PIN vendedor, sesión
// ════════════════════════════════════════

import {
  auth, db,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut,
  doc, setDoc, getDoc, collection, getDocs, addDoc, deleteDoc, serverTimestamp
} from './firebase.js';
import { state, showToast, fmt } from './utils.js';
import { launchApp } from './app.js';

// ── ERRORES FIREBASE LEGIBLES ──
function fbErr(code) {
  const map = {
    'auth/email-already-in-use': 'Ese email ya está registrado',
    'auth/invalid-email':        'Email inválido',
    'auth/weak-password':        'Contraseña muy corta (mín 6 caracteres)',
    'auth/wrong-password':       'Contraseña incorrecta',
    'auth/invalid-credential':   'Email o contraseña incorrectos',
    'auth/user-not-found':       'Usuario no encontrado',
    'auth/too-many-requests':    'Demasiados intentos. Espera unos minutos',
  };
  return map[code] || 'Error: ' + (code || 'desconocido');
}

// ── REGISTRO DUEÑO ──
export async function doRegister() {
  const storeName = document.getElementById('reg-store').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const pass      = document.getElementById('reg-pass').value;

  if (!storeName || !email || !pass) { showToast('Completa todos los campos', 'err'); return; }
  if (pass.length < 6) { showToast('Contraseña mínimo 6 caracteres', 'err'); return; }

  setLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    await setDoc(doc(db, 'stores', uid), {
      storeName, email, uid,
      createdAt: serverTimestamp(),
      plan: 'basico'
    });
    state.storeData = { uid, storeName, role: 'owner' };
    sessionStorage.setItem('sb_role', 'owner');
    setupFirestoreListeners(uid);
    launchApp(storeName, 'owner');
  } catch(e) {
    showToast(fbErr(e.code), 'err');
  } finally {
    setLoading(false);
  }
}

// ── LOGIN DUEÑO ──
export async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Ingresa email y contraseña', 'err'); return; }

  setLoading(true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    const snap = await getDoc(doc(db, 'stores', uid));
    if (!snap.exists()) throw new Error('auth/user-not-found');
    state.storeData = { ...snap.data(), role: 'owner' };
    sessionStorage.setItem('sb_role', 'owner');
    setupFirestoreListeners(uid);
    launchApp(state.storeData.storeName, 'owner');
  } catch(e) {
    showToast(fbErr(e.code), 'err');
  } finally {
    setLoading(false);
  }
}

// ── LOGIN VENDEDOR POR PIN ──
export async function doVendorLogin() {
  const storeCode = document.getElementById('vendor-store').value.trim().toLowerCase().replace(/\s+/g,'_');
  const pin       = document.getElementById('vendor-pin').value.trim();
  if (!storeCode || !pin) { showToast('Ingresa el código del negocio y tu PIN', 'err'); return; }

  setLoading(true);
  try {
    // Buscar negocio por storeCode
    const storeSnap = await getDoc(doc(db, 'store_codes', storeCode));
    if (!storeSnap.exists()) { showToast('Negocio no encontrado', 'err'); setLoading(false); return; }
    const { uid } = storeSnap.data();

    // Verificar PIN en la colección de vendedores
    const vendorsSnap = await getDocs(collection(db, 'stores', uid, 'vendors'));
    const vendor = vendorsSnap.docs.map(d => ({id:d.id,...d.data()})).find(v => v.pin === pin && v.active);
    if (!vendor) { showToast('PIN incorrecto', 'err'); setLoading(false); return; }

    const storeDoc = await getDoc(doc(db, 'stores', uid));
    state.storeData = { ...storeDoc.data(), role: 'vendor', vendorName: vendor.name };
    sessionStorage.setItem('sb_role', 'vendor');
    sessionStorage.setItem('sb_uid', uid);
    setupFirestoreListeners(uid);
    launchApp(storeDoc.data().storeName, 'vendor');
  } catch(e) {
    showToast('Error al ingresar: ' + e.message, 'err');
  } finally {
    setLoading(false);
  }
}

// ── LOGOUT ──
export async function doLogout() {
  state.unsubs.forEach(u => u());
  state.unsubs = [];
  state.products = [];
  state.sales = [];
  state.cart = [];
  state.storeData = null;
  sessionStorage.clear();
  await signOut(auth);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  showAuthTab('login-owner');
}

// ── PERSISTIR SESIÓN (auto-login al recargar) ──
export function initAuthPersistence() {
  onAuthStateChanged(auth, async user => {
    if (!user || state.storeData) return;
    try {
      const snap = await getDoc(doc(db, 'stores', user.uid));
      if (!snap.exists()) return;
      const savedRole = sessionStorage.getItem('sb_role') || 'owner';
      state.storeData = { ...snap.data(), role: savedRole };
      setupFirestoreListeners(user.uid);
      launchApp(state.storeData.storeName, savedRole);
    } catch(e) { /* sesión no restaurable */ }
  });

  // También restaurar sesión de vendedor (sin Firebase Auth)
  const savedRole = sessionStorage.getItem('sb_role');
  const savedUid  = sessionStorage.getItem('sb_uid');
  if (savedRole === 'vendor' && savedUid) {
    getDoc(doc(db, 'stores', savedUid)).then(snap => {
      if (!snap.exists()) return;
      state.storeData = { ...snap.data(), role: 'vendor' };
      setupFirestoreListeners(savedUid);
      launchApp(snap.data().storeName, 'vendor');
    }).catch(() => {});
  }
}

// ── FIRESTORE LISTENERS en tiempo real ──
function setupFirestoreListeners(uid) {
  const { onSnapshot, collection, query, orderBy, limit } = window._fb;
  // Importadas globalmente desde app.js — ver nota abajo
  import('./inventory.js').then(m => m.setupProductListener(uid));
  import('./sales.js').then(m => m.setupSalesListener(uid));
}

// ── GESTIÓN DE VENDEDORES (solo dueño) ──
export async function createVendor(name, pin) {
  const uid = state.storeData?.uid;
  if (!uid) return;
  // PIN único de 4 dígitos
  const existing = await getDocs(collection(db, 'stores', uid, 'vendors'));
  const pins = existing.docs.map(d => d.data().pin);
  if (pins.includes(pin)) { showToast('Ese PIN ya existe, usa otro', 'err'); return false; }

  await addDoc(collection(db, 'stores', uid, 'vendors'), {
    name, pin, active: true, createdAt: serverTimestamp()
  });
  showToast(`✓ Vendedor ${name} creado con PIN ${pin}`);
  return true;
}

export async function deleteVendor(vendorId) {
  const uid = state.storeData?.uid;
  if (!uid) return;
  await deleteDoc(doc(db, 'stores', uid, 'vendors', vendorId));
  showToast('Vendedor eliminado');
}

export async function loadVendors() {
  const uid = state.storeData?.uid;
  if (!uid) return [];
  const snap = await getDocs(collection(db, 'stores', uid, 'vendors'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── CREAR CÓDIGO DE NEGOCIO (para que vendedores puedan encontrarlo) ──
export async function ensureStoreCode() {
  const { uid, storeName } = state.storeData;
  const code = storeName.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0, 20);
  await setDoc(doc(db, 'store_codes', code), { uid, storeName });
  return code;
}

// ── UI HELPERS ──
export function showAuthTab(tab) {
  document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + tab).style.display = 'block';
  document.getElementById('tab-' + tab).classList.add('active');
}

function setLoading(v) {
  document.querySelectorAll('.btn-auth').forEach(b => {
    b.disabled = v;
    if (v) b.dataset.label = b.dataset.label || b.textContent;
    b.textContent = v ? 'Cargando...' : (b.dataset.label || b.textContent);
  });
}

// Exponer globalmente para onclick en HTML
window.doRegister     = doRegister;
window.doLogin        = doLogin;
window.doVendorLogin  = doVendorLogin;
window.doLogout       = doLogout;
window.showAuthTab    = showAuthTab;
