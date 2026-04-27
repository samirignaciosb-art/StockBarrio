// auth.js
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, doc, setDoc, getDoc, updateDoc, serverTimestamp } from './firebase.js';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { state, showToast, initTheme } from './utils.js';

const ERR = {
  'auth/email-already-in-use': 'Email ya registrado',
  'auth/invalid-credential':   'Email o contraseña incorrectos',
  'auth/wrong-password':       'Email o contraseña incorrectos',
  'auth/user-not-found':       'Usuario no encontrado',
  'auth/weak-password':        'Contraseña muy corta (mín 6 caracteres)',
  'auth/too-many-requests':    'Demasiados intentos, espera un momento',
  'auth/invalid-email':        'Email inválido',
  'auth/requires-recent-login':'Vuelve a ingresar tu contraseña actual para confirmar',
};
const fbErr = c => ERR[c] || 'Error de conexión';

function setLoading(v) {
  document.querySelectorAll('.btn-auth').forEach(b => {
    if(!b.dataset.orig) b.dataset.orig = b.textContent;
    b.disabled    = v;
    b.textContent = v ? 'Cargando...' : b.dataset.orig;
  });
}

// _manualLogin: true mientras doLogin/doRegister están en curso
// Se resetea en el finally — el listener onAuthStateChanged lo respeta
let _manualLogin = false;
let _booting     = false;

// ══════════════════════════════════════
// REGISTER
// ══════════════════════════════════════
export async function doRegister() {
  const storeName = document.getElementById('reg-store').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const pass      = document.getElementById('reg-pass').value;
  if(!storeName||!email||!pass){ showToast('Completa todos los campos','err'); return; }
  if(pass.length<6){ showToast('Contraseña mínimo 6 caracteres','err'); return; }
  setLoading(true);
  _manualLogin = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    await setDoc(doc(db,'stores',uid),{storeName,email,uid,createdAt:serverTimestamp(),plan:'basico'});
    await boot(uid, storeName, email);
  } catch(e){ showToast(fbErr(e.code),'err'); }
  finally{ setLoading(false); _manualLogin = false; }
}

// ══════════════════════════════════════
// LOGIN
// ══════════════════════════════════════
export async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const pass     = document.getElementById('login-pass').value;
  const remember = document.getElementById('login-remember')?.checked ?? false;
  if(!email||!pass){ showToast('Ingresa email y contraseña','err'); return; }
  setLoading(true);
  _manualLogin = true; // el listener lo verá true y no interferirá
  try {
    if(remember) localStorage.setItem('sb_persist','local');
    else         localStorage.removeItem('sb_persist');

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    const snap = await getDoc(doc(db,'stores',uid));
    const data = snap.exists() ? snap.data() : {};
    const storeName = data.storeName || email.split('@')[0];
    if(!snap.exists()) await setDoc(doc(db,'stores',uid),{storeName,email,uid,createdAt:serverTimestamp()});

    await boot(uid, storeName, email);

    // Si es cuenta creada por admin, forzar cambio de contraseña
    if(data.mustChangePass) showChangePassModal(true);

  } catch(e){ showToast(fbErr(e.code),'err'); }
  finally{ setLoading(false); _manualLogin = false; }
}

// ══════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════
export async function doLogout() {
  state.unsubs.forEach(u=>u()); state.unsubs=[];
  state.products=[]; state.sales=[]; state.adjustments=[];
  state.uid=null; state.storeName='';
  sessionStorage.clear();
  localStorage.removeItem('sb_persist');
  await signOut(auth);
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').classList.remove('hidden');
}

// ══════════════════════════════════════
// BOOT
// ══════════════════════════════════════
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

// ══════════════════════════════════════
// INIT AUTH
// ══════════════════════════════════════
export function initAuth() {
  initTheme();

  // Marcar checkbox si guardó preferencia
  const cb = document.getElementById('login-remember');
  if(cb) cb.checked = localStorage.getItem('sb_persist') === 'local';

  onAuthStateChanged(auth, async user => {
    // doLogin/doRegister maneja el boot ellos mismos
    if(_manualLogin) return;
    if(!user || state.uid || _booting) return;

    // Solo restaurar sesión si eligió "mantener sesión"
    if(localStorage.getItem('sb_persist') !== 'local') {
      await signOut(auth);
      return;
    }

    _booting = true;
    try {
      const snap = await getDoc(doc(db,'stores',user.uid));
      if(!snap.exists()) { await signOut(auth); _booting=false; return; }
      const data = snap.data();
      await boot(user.uid, data.storeName, user.email||'');
      if(data.mustChangePass) showChangePassModal(true);
    } catch(e) {
      console.error('Session restore error:', e);
      _booting = false;
    }
  });
}

// ══════════════════════════════════════
// CAMBIAR CONTRASEÑA
// ══════════════════════════════════════
export function showChangePassModal(forced=false) {
  if(!document.getElementById('modal-changepass')) {
    const m = document.createElement('div');
    m.id = 'modal-changepass';
    m.className = 'modal-overlay';
    m.innerHTML = `
      <div class="modal-box">
        <h3 id="cpm-title">🔑 Cambiar contraseña</h3>
        <p id="cpm-msg" style="font-size:.83rem;color:var(--text2);margin-bottom:1rem"></p>
        <div class="field" id="cpm-current-wrap">
          <label>Contraseña actual</label>
          <input id="cpm-current" type="password" placeholder="••••••" autocomplete="current-password">
        </div>
        <div class="field">
          <label>Nueva contraseña</label>
          <input id="cpm-new" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
        </div>
        <div class="field">
          <label>Repetir nueva contraseña</label>
          <input id="cpm-new2" type="password" placeholder="Repite la nueva contraseña" autocomplete="new-password">
        </div>
        <div class="modal-btns">
          <button class="mbtn-cancel" id="cpm-cancel-btn" onclick="closeChangePassModal()">Cancelar</button>
          <button class="mbtn-ok" onclick="doChangePass()">Guardar contraseña</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  const forced2 = forced;
  document.getElementById('cpm-title').textContent = forced2
    ? '🔑 Debes cambiar tu contraseña'
    : '🔑 Cambiar contraseña';
  document.getElementById('cpm-msg').textContent = forced2
    ? 'Tu cuenta fue creada con una contraseña temporal. Elige una nueva para continuar.'
    : 'Ingresa tu contraseña actual y luego la nueva.';
  document.getElementById('cpm-cancel-btn').style.display = forced2 ? 'none' : '';
  document.getElementById('cpm-current-wrap').style.display = forced2 ? 'none' : '';
  document.getElementById('modal-changepass').classList.add('open');
  setTimeout(() => document.getElementById('cpm-new')?.focus(), 100);
}

window.closeChangePassModal = function() {
  document.getElementById('modal-changepass')?.classList.remove('open');
};

window.doChangePass = async function() {
  const forced    = document.getElementById('cpm-cancel-btn')?.style.display === 'none';
  const currPass  = document.getElementById('cpm-current')?.value || '';
  const newPass   = document.getElementById('cpm-new')?.value     || '';
  const newPass2  = document.getElementById('cpm-new2')?.value    || '';

  if(newPass.length < 6)     { showToast('Mínimo 6 caracteres','err'); return; }
  if(newPass !== newPass2)   { showToast('Las contraseñas no coinciden','err'); return; }
  if(!forced && !currPass)   { showToast('Ingresa tu contraseña actual','err'); return; }

  const btn = document.querySelector('#modal-changepass .mbtn-ok');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }

  try {
    const user = auth.currentUser;
    if(!user) throw new Error('Sin sesión');

    if(!forced) {
      const cred = EmailAuthProvider.credential(user.email, currPass);
      await reauthenticateWithCredential(user, cred);
    }

    await updatePassword(user, newPass);

    if(state.uid) {
      await updateDoc(doc(db,'stores',state.uid), { mustChangePass: false, tempPass: null });
    }

    closeChangePassModal();
    showToast('✓ Contraseña actualizada');

  } catch(e) {
    showToast(fbErr(e.code),'err');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='Guardar contraseña'; }
  }
};

// ══════════════════════════════════════
// AUTH TAB
// ══════════════════════════════════════
export function showAuthTab(tab) {
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  document.getElementById('apanel-'+tab)?.classList.add('active');
  document.getElementById('atab-'+tab)?.classList.add('active');
}

window.doLogin             = doLogin;
window.doRegister          = doRegister;
window.doLogout            = doLogout;
window.showAuthTab         = showAuthTab;
window.showChangePassModal = showChangePassModal;

export function isAdmin(email) {
  return email === 'samirhelado@gmail.com';
}
