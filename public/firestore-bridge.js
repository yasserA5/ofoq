import { db, auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  console.log("SAVE PAGE auth user:", user ? user.uid : null);
});

window.fs = {
  db,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy
};