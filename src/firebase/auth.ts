import {
  signInWithPopup,
  linkWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./config";

/** Sign in with Google popup. */
export const signInWithGoogle = async (): Promise<User> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

/**
 * Link the current anonymous user to a Google account (anonymous → permanent upgrade).
 * Uses linkWithPopup to preserve the anonymous UID and its data (wallet, inventory, settings).
 */
export const linkAnonymousToGoogle = async (): Promise<User> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await linkWithPopup(auth.currentUser!, provider);
  return result.user;
};

/** Sign out (returns to anonymous session on next auth state change). */
export const signOut = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
};

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export const onAuthChange = (
  callback: (user: User | null) => void,
): (() => void) => {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
};
