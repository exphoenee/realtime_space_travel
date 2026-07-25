import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

const getFirebaseConfig = () => {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !databaseURL || !projectId) {
    console.error(
      "Firebase config missing. Ensure .env has VITE_FIREBASE_API_KEY, " +
      "VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_URL, and VITE_FIREBASE_PROJECT_ID."
    );
  }

  return {
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

/** Initialize Firebase (idempotent — safe to call multiple times). */
export const initFirebase = (): { app: FirebaseApp; auth: Auth; db: Database } => {
  if (app && auth && db) return { app, auth, db };

  app = initializeApp(getFirebaseConfig());
  auth = getAuth(app);
  db = getDatabase(app);

  return { app, auth, db };
};

/** Get the Firebase Auth instance (initializes if needed). */
export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    const result = initFirebase();
    return result.auth;
  }
  return auth;
};

/** Get the Firebase Realtime Database instance (initializes if needed). */
export const getFirebaseDB = (): Database => {
  if (!db) {
    const result = initFirebase();
    return result.db;
  }
  return db;
};
