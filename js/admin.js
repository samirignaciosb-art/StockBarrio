// admin.js — Panel de administrador StockBarrio
// Solo accesible con el email del dueño del sistema

import { auth, db, createUserWithEmailAndPassword, doc, setDoc, collection, getDocs, updateDoc, serverTimestamp } from './firebase.js';
import { showToast, fmt, toDate } from './utils.js';

// ── TU EMAIL DE ADMIN — cambia esto por el tuyo ──
const ADMIN_EMAIL = 'samirhelado@gmail.com';

export function isAdmin(email) {
  return email === ADMIN_EMAIL;
}

// ══════════════════════════════════════
// RENDER PANEL ADMIN
// ══════════════════════════════════════
export async function renderAdmin(c) {
  c.innerHTML = `
    <div style="max-width:800px;animation:fadeIn .3s ease">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,rgba(61,139,255,.1),rgba(0,200,150,.08));border:1px solid var(--border);border-radius:var(--r-lg);padding:1.25rem 1.5rem;margin-bottom:1.25rem;display:flex;gap:1rem;align-items:center">
        <div style="font-size:2rem">⚙️</div>
        <div>
          <div style="font-size:1rem;font-weight:700">Panel de Administrador</div>
          <div style="font-size:.8rem;color:var(--text2);margin-top:.15rem">Gestión de negocios y licencias StockBarrio</div>
        </div>
      </div>

      <!-- Crear nuevo negocio -->
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header">
          <div class="card-title">➕ Crear nuevo negocio</div>
        </div>
        <div class="card-body">
          <div class="modal-grid" style="margin-bottom:.85rem">
            <div class="field">
              <label>Nombre del negocio</label>
              <input id="adm-store" type="text" placeholder="Almacén Don Pedro">
            </div>
            <div class="field">
              <label>Plan</label>
              <select id="adm-plan" style="width:100%;padding:.75rem 1rem;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:.92rem;outline:none">
                <option value="basico">Básico — $25.000</option>
                <option value="pro">Pro — $55.000</option>
                <option value="pro2">Pro II — $65.000</option>
                <option value="premium">Premium — $90.000</option>
              </select>
            </div>
          </div>
          <div class="field" style="margin-bottom:.85rem">
            <label>Email del cliente</label>
            <input id="adm-email" type="email" placeholder="cliente@negocio.cl">
          </div>
          <div class="field" style="margin-bottom:1rem">
            <label>Contraseña temporal</label>
            <div style="display:flex;gap:.5rem">
              <input id="adm-pass" type="text" placeholder="Min. 6 caracteres" style="flex:1" value="${generateTempPass()}">
              <button class="btn-sm ghost" onclick="document.getElementById('adm-pass').value='${generateTempPass()}'">🔄</button>
            </div>
            <div style="font-size:.72rem;color:var(--text2);margin-top:.35rem">
              El cliente recibirá esta contraseña temporal y deberá cambiarla al primer ingreso.
            </div>
          </div>
          <button class="btn-primary" style="width:auto;padding:.8rem 1.75rem" onclick="createClientAccount()">
            Crear negocio y enviar acceso →
          </button>
        </div>
      </div>

      <!-- Lista de negocios -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏪 Negocios registrados</div>
          <button class="btn-sm ghost" onclick="loadStores()">↻ Actualizar</button>
        </div>
        <div id="stores-list">
          <div style="padding:1.5rem;text-align:center;color:var(--text2);font-size:.85rem">Cargando...</div>
        </div>
      </div>
    </div>`;

  await loadStores();
}

// ══════════════════════════════════════
// CREAR CUENTA DE CLIENTE
// ══════════════════════════════════════
window.createClientAccount = async function() {
  const storeName = document.getElementById('adm-store').value.trim();
  const email     = document.getElementById('adm-email').value.trim();
  const pass      = document.getElementById('adm-pass').value.trim();
  const plan      = document.getElementById('adm-plan').value;

  if(!storeName || !email || !pass) {
    showToast('Completa todos los campos', 'err'); return;
  }
  if(pass.length < 6) {
    showToast('Contraseña mínimo 6 caracteres', 'err'); return;
  }

  const btn = document.querySelector('[onclick="createClientAccount()"]');
  if(btn) { btn.disabled=true; btn.textContent='Creando...'; }

  try {
    // Guardar auth actual (admin) para restaurar después
    const currentUser = auth.currentUser;

    // Crear usuario en Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;

    // Enviar email de verificación/bienvenida
    const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await sendEmailVerification(cred.user, {
      url: `https://samirignaciosb-art.github.io/StockBarrio/?welcome=1&store=${encodeURIComponent(storeName)}`,
      handleCodeInApp: false
    });

    // Guardar datos en Firestore
    await setDoc(doc(db, 'stores', uid), {
      storeName, email, uid, plan,
      createdAt:   serverTimestamp(),
      createdBy:   ADMIN_EMAIL,
      active:      true,
      mustChangePass: true,
      tempPass:    pass
    });

    // Volver a loguear como admin
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const adminPass = sessionStorage.getItem('sb_adminpass');
    if(adminPass) {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, adminPass);
    }

    showToast(`✓ Negocio "${storeName}" creado — email enviado a ${email}`);

    // Limpiar formulario
    ['adm-store','adm-email'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('adm-pass').value = generateTempPass();

    // Recargar lista
    await loadStores();

  } catch(e) {
    const errs = {
      'auth/email-already-in-use': 'Ese email ya tiene una cuenta registrada',
      'auth/invalid-email':        'Email inválido',
      'auth/weak-password':        'Contraseña muy débil',
    };
    showToast(errs[e.code] || 'Error: ' + e.message, 'err');
  } finally {
    if(btn) { btn.disabled=false; btn.textContent='Crear negocio y enviar acceso →'; }
  }
};

// ══════════════════════════════════════
// CARGAR LISTA DE NEGOCIOS
// ══════════════════════════════════════
window.loadStores = async function() {
  const el = document.getElementById('stores-list');
  if(!el) return;

  try {
    // Leer todos los negocios
    const snap = await getDocs(collection(db, 'stores'));
    const stores = snap.docs.map(d => ({id:d.id, ...d.data()}))
      .sort((a,b) => toDate(b.createdAt) - toDate(a.createdAt));

    if(!stores.length) {
      el.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text2);font-size:.85rem">Sin negocios registrados aún</div>`;
      return;
    }

    const planLabels = { basico:'Básico', pro:'Pro', pro2:'Pro II', premium:'Premium' };
    const planColors = { basico:'var(--text2)', pro:'var(--blue)', pro2:'var(--acc)', premium:'var(--warn)' };

    el.innerHTML = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Negocio</th>
            <th>Email</th>
            <th>Plan</th>
            <th>Estado</th>
            <th>Creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${stores.map(s => `
            <tr>
              <td style="font-weight:600">${s.storeName||'—'}</td>
              <td class="mono" style="font-size:.78rem">${s.email||'—'}</td>
              <td><span style="font-weight:700;color:${planColors[s.plan]||'var(--text2)'}">${planLabels[s.plan]||s.plan||'—'}</span></td>
              <td>${s.active!==false
                ? `<span class="pill ok">Activo</span>`
                : `<span class="pill out">Inactivo</span>`}</td>
              <td style="font-size:.78rem;color:var(--text2)">${s.createdAt?toDate(s.createdAt).toLocaleDateString('es-CL'):'—'}</td>
              <td>
                <div style="display:flex;gap:.4rem">
                  <button class="btn-sm ghost" style="padding:.3rem .6rem;font-size:.75rem"
                    onclick="copyAccess('${s.email}','${s.storeName}','${s.tempPass||''}')">📋 Acceso</button>
                  <button class="btn-sm ${s.active!==false?'danger':'ghost'}" style="padding:.3rem .6rem;font-size:.75rem"
                    onclick="toggleStore('${s.id}',${s.active!==false})">
                    ${s.active!==false?'Suspender':'Activar'}
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="padding:.75rem 1rem;font-size:.75rem;color:var(--text2);border-top:1px solid var(--border)">
        ${stores.length} negocio${stores.length!==1?'s':''} registrado${stores.length!==1?'s':''}
      </div>`;

  } catch(e) {
    el.innerHTML = `<div style="padding:1rem;color:var(--red);font-size:.85rem">Error al cargar: ${e.message}</div>`;
  }
};

// ══════════════════════════════════════
// COPIAR DATOS DE ACCESO
// ══════════════════════════════════════
window.copyAccess = function(email, storeName, tempPass) {
  const text = `Hola, aquí tienes tus datos de acceso a StockBarrio:

🏪 Negocio: ${storeName}
🌐 URL: https://samirignaciosb-art.github.io/StockBarrio/
📧 Email: ${email}
🔑 Contraseña temporal: ${tempPass||'(definida por el cliente)'}

Te recomendamos cambiar tu contraseña al primer ingreso.

Cualquier consulta, contáctame directamente.`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('✓ Datos de acceso copiados al portapapeles');
  }).catch(() => {
    // Fallback para móvil
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✓ Copiado');
  });
};

// ══════════════════════════════════════
// SUSPENDER / ACTIVAR NEGOCIO
// ══════════════════════════════════════
window.toggleStore = async function(storeId, currentlyActive) {
  const action = currentlyActive ? 'suspender' : 'activar';
  if(!confirm(`¿${action.charAt(0).toUpperCase()+action.slice(1)} este negocio?`)) return;
  try {
    await updateDoc(doc(db, 'stores', storeId), { active: !currentlyActive });
    showToast(`✓ Negocio ${action === 'suspender' ? 'suspendido' : 'activado'}`);
    await loadStores();
  } catch(e) {
    showToast('Error: ' + e.message, 'err');
  }
};

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function generateTempPass() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}
