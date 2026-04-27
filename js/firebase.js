// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxkdMq9UoacHd8p1EODhdODBiadLB1nOs",
  authDomain: "stockdebarrio.firebaseapp.com",
  projectId: "stockdebarrio",
  storageBucket: "stockdebarrio.firebasestorage.app",
  messagingSenderId: "344341478639",
  appId: "1:344341478639:web:772eb3d593e238f804ef1a"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

enableIndexedDbPersistence(db).catch(e => { if(e.code !== 'failed-precondition' && e.code !== 'unimplemented') console.warn(e); });

export { auth, db };
export { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut };
export { doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp };
