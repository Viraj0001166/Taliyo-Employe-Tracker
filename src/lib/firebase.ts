// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration (include databaseURL only if provided)
const firebaseConfigBase = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
const firebaseConfig = databaseURL
  ? { ...firebaseConfigBase, databaseURL }
  : firebaseConfigBase;

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Expose config for secondary app usage on client (safe NEXT_PUBLIC values only)
const firebaseClientConfig = firebaseConfig;

// Create or get a secondary auth instance so we can sign in another user
// without affecting the current admin session (used to link existing accounts).
const getSecondaryAuth = () => {
  const secondaryName = "Secondary";
  const existing = getApps().find(a => a.name === secondaryName);
  const secondaryApp = existing ?? initializeApp(firebaseClientConfig, secondaryName);
  return getAuth(secondaryApp);
};

export { app, auth, db, storage, firebaseClientConfig, getSecondaryAuth };