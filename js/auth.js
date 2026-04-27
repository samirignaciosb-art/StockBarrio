// auth.js
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, doc, setDoc, getDoc, serverTimestamp } from './firebase.js';
import { state, showToast, initTheme, initNetwork } from './utils.js';

const ERR = {
  'auth/email-already-in-use': 'Email ya registrado',
  'auth/invalid-credential':   'Email o contraseña incorrectos',
  'auth/wrong-password':       'Email o contraseña incorrectos',
  'auth/user-not-found':       'Usuario no encontrado',
  'auth/weak-password':        'Contraseña muy corta (mín 6 caracteres)',
  'auth/too-many-requests':    'Demasiados intentos, espera un momento',
  'auth/invalid-email':        'Email inválido',
};
const fbErr = c => ERR[c] || 'Error de conexión';

function setLoading(v) {
  document.querySelectorAll('.btn-auth').forEach(b => {
    if(!b.dataset.orig) b.dataset.orig = b.textContent;
    b.disabled    = v;
    b.textContent = v ? 'Cargando...' : b.dataset.orig;
  });
}

export async function doRegister() {
  const storeName = document.getElementById('reg-store').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const pass      = document.getElementById('reg-pass').value;
  if(!storeName||!email||!pass){ showToast('Completa todos los campos','err'); return; }
  if(pass.length<6){ showToast('Contraseña mínimo 6 caracteres','err'); return; }
  setLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    await setDoc(doc(db,'stores',uid),{storeName,email,uid,createdAt:serverTimestamp(),plan:'basico'});
    await boot(uid, storeName, email);
  } catch(e){ showToast(fbErr(e.code),'err'); }
  finally{ setLoading(false); }
}

export async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if(!email||!pass){ showToast('Ingresa email y contraseña','err'); return; }
  setLoading(true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    const snap = await getDoc(doc(db,'stores',uid));
    const storeName = snap.exists() ? snap.data().storeName : email.split('@')[0];
    if(!snap.exists()) await setDoc(doc(db,'stores',uid),{storeName,email,uid,createdAt:serverTimestamp()});
    await boot(uid, storeName, email);
  } catch(e){ showToast(fbErr(e.code),'err'); }
  finally{ setLoading(false); }
}

export async function doLogout() {
  state.unsubs.forEach(u=>u()); state.unsubs=[];
  state.products=[]; state.sales=[]; state.adjustments=[];
  state.uid=null; state.storeName='';
  sessionStorage.clear();
  await signOut(auth);
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').classList.remove('hidden');
}

async function boot(uid, storeName, email='') {
  state.uid=uid; state.storeName=storeName;
  sessionStorage.setItem('sb_uid', uid);
  sessionStorage.setItem('sb_email', email||'');
  sessionStorage.setItem('sb_store', storeName);
  const {startListeners} = await import('./data.js');
  startListeners(uid);
  const {launchApp} = await import('./app.js');
  launchApp(storeName);
}

let _booting = false;

export function initAuth() {
  initTheme();
  // Restore session on reload
  onAuthStateChanged(auth, async user => {
    if(!user || state.uid || _booting) return;
    _booting = true;
    try {
      const snap = await getDoc(doc(db,'stores',user.uid));
      const storeName = snap.exists() ? snap.data().storeName : user.email.split('@')[0];
      await boot(user.uid, storeName, user.email||'');
    } catch(e){
      console.error('Session restore error:', e);
      _booting = false;
    }
  });
}

export function showAuthTab(tab) {
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  document.getElementById('apanel-'+tab)?.classList.add('active');
  document.getElementById('atab-'+tab)?.classList.add('active');
}

window.doLogin     = doLogin;
window.doRegister  = doRegister;
window.doLogout    = doLogout;
window.showAuthTab = showAuthTab;

export function isAdmin(email) {
  return email === 'samirhelado@gmail.com';
}
