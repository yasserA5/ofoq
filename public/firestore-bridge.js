import { db } from "./firebase-init.js";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

window.fs = { db, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc };
