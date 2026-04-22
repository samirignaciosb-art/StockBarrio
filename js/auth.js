// auth.js
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, doc, setDoc, getDoc, serverTimestamp } from './firebase.js';
import { state, showToast, initTheme, initNetwork } from './utils.js';

const ERR = { 'auth/email-already-in-use':'Email ya registrado', 'auth/invalid-credential':'Email o contraseña incorrectos', 'auth/weak-password':'Contraseña muy corta', 'auth/too-many-requests':'Demasiados intentos, espera un momento' };
const fbErr = code => ERR[code] || 'Error al conectar';

function setLoading(v) {
  document.querySelectorAll('.btn-primary').forEach(b => { b.disabled=v; b.textContent=v?'Cargando...':(b.dataset.orig||b.textContent); if(!v&&!b.dataset.orig)b.dataset.orig=b.textContent; });
}

export async function doRegister() {
  const storeName=document.getElementById('reg-store').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const pass=document.getElementById('reg-pass').value;
  if(!storeName||!email||!pass){showToast('Completa todos los campos','err');return;}
  if(pass.length<6){showToast('Contraseña mínimo 6 caracteres','err');return;}
  setLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    await setDoc(doc(db,'stores',uid),{storeName,email,uid,createdAt:serverTimestamp(),plan:'basico'});
    state.uid=uid; state.storeName=storeName;
    sessionStorage.setItem('sb_uid',uid); sessionStorage.setItem('sb_store',storeName);
    const {startListeners} = await import('./data.js');
    startListeners(uid);
    const {launchApp} = await import('./app.js');
    launchApp(storeName);
  } catch(e){showToast(fbErr(e.code),'err');}
  finally{setLoading(false);}
}

export async function doLogin() {
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  if(!email||!pass){showToast('Ingresa email y contraseña','err');return;}
  setLoading(true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    const snap = await getDoc(doc(db,'stores',uid));
    const storeName = snap.exists()?snap.data().storeName:email.split('@')[0];
    if(!snap.exists()) await setDoc(doc(db,'stores',uid),{storeName,email,uid,createdAt:serverTimestamp()});
    state.uid=uid; state.storeName=storeName;
    sessionStorage.setItem('sb_uid',uid); sessionStorage.setItem('sb_store',storeName);
    const {startListeners} = await import('./data.js');
    startListeners(uid);
    const {launchApp} = await import('./app.js');
    launchApp(storeName);
  } catch(e){showToast(fbErr(e.code),'err');}
  finally{setLoading(false);}
}

export async function doLogout() {
  state.unsubs.forEach(u=>u()); state.unsubs=[];
  state.products=[]; state.sales=[]; state.uid=null;
  sessionStorage.clear();
  await signOut(auth);
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').classList.remove('hidden');
}

export function initAuth() {
  initTheme();
  onAuthStateChanged(auth, async user => {
    if(!user||state.uid)return;
    try {
      const snap = await getDoc(doc(db,'stores',user.uid));
      const storeName = snap.exists()?snap.data().storeName:user.email.split('@')[0];
      state.uid=user.uid; state.storeName=storeName;
      sessionStorage.setItem('sb_uid',user.uid); sessionStorage.setItem('sb_store',storeName);
      const {startListeners} = await import('./data.js');
      startListeners(user.uid);
      const {launchApp} = await import('./app.js');
      launchApp(storeName);
    } catch(e){}
  });
}

export function showAuthTab(tab) {
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  document.getElementById('apanel-'+tab).classList.add('active');
  document.getElementById('atab-'+tab).classList.add('active');
}

// Expose globally
window.doLogin    = doLogin;
window.doRegister = doRegister;
window.doLogout   = doLogout;
window.showAuthTab = showAuthTab;
