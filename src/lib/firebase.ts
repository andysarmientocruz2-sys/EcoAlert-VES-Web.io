import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDyZx7ZPHRJXSjQJgmpn4ZNEZJSm9oukRg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "accessacount.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "accessacount",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "accessacount.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "740270861211",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:740270861211:web:6c46024bcdd2c17c3e4f3e",
};

const localDemo = new URLSearchParams(window.location.search).get("demo") === "1" || import.meta.env.VITE_DEMO_MODE === "true";
export const FIREBASE_READY = !localDemo && !!(config.apiKey && config.projectId);

const app = FIREBASE_READY
  ? (getApps().length ? getApps()[0] : initializeApp(config))
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
