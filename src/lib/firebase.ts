import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC2jYf8XfGtErHinUAy8V5AArYTSFj_SvM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ecoalert-ves.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ecoalert-ves",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ecoalert-ves.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "190726486094",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:190726486094:web:66f1655c9c1361b9612b1f",
};

const localDemo = new URLSearchParams(window.location.search).get("demo") === "1" || import.meta.env.VITE_DEMO_MODE === "true";
export const FIREBASE_READY = !localDemo && !!(config.apiKey && config.projectId);

const app = FIREBASE_READY
  ? (getApps().length ? getApps()[0] : initializeApp(config))
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
googleProvider.addScope("email");
googleProvider.addScope("profile");
