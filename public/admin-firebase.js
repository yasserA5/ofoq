import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-init.js";

// A named app keeps its own login, so signing in or out on the public site
// never changes the admin panel's session (and the reverse).
export const app = initializeApp(firebaseConfig, "admin");
export const db = getFirestore(app);
export const auth = getAuth(app);
