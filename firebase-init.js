// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA14BXeVtyme64MYHQcfnThyted_mNIZPY",
  authDomain: "ofouq-academie.firebaseapp.com",
  projectId: "ofouq-academie",
  storageBucket: "ofouq-academie.firebasestorage.app",
  messagingSenderId: "479091527932",
  appId: "1:479091527932:web:379085d6bac81b61f30779",
  measurementId: "G-V69EP1BSDW"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
