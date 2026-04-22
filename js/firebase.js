// ════════════════════════════════════════
// firebase.js — Configuración y conexión
// ════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection,
  addDoc, onSnapshot, updateDoc, deleteDoc,
  query, orderBy, limit, serverTimestamp, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── CREDENCIALES ──────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCxkdMq9UoacHd8p1EODhdODBiadLB1nOs",
  authDomain: "stockdebarrio.firebaseapp.com",
  projectId: "stockdebarrio",
  storageBucket: "stockdebarrio.firebasestorage.app",
  messagingSenderId: "344341478639",
  appId: "1:344341478639:web:772eb3d593e238f804ef1a",
  measurementId: "G-L08MQXR4Y0"
};
// ─────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── MODO OFFLINE: persistencia local automática ──
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Offline: múltiples tabs abiertas');
  else if (err.code === 'unimplemented')  console.warn('Offline: navegador no compatible');
});

export { auth, db, app };
export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut,
  doc, setDoc, getDoc, getDocs, collection, addDoc,
  onSnapshot, updateDoc, deleteDoc,
  query, orderBy, limit, serverTimestamp
};
