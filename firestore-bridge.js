import { db } from "./firebase-init.js";
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  console.log("SAVE PAGE auth user:", user ? user.uid : null);
});

import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

window.fs = { db, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc };
