import { db, auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  orderBy
}
 from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  console.log("SAVE PAGE auth user:", user ? user.uid : null);
});

window.fs = {
  db,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  orderBy
};

window.dispatchEvent(new CustomEvent('firestoreReady'));