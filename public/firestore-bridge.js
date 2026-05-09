import { db, auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  doc,
  orderBy,      
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  console.log("SAVE PAGE auth user:", user ? user.uid : null);
});

window.fs = {
  db,
  auth,
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  doc,
  orderBy,
  onSnapshot
};

window.dispatchEvent(new CustomEvent("firestoreReady"));