import {
  signInAnonymously,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./config";

/** Sign in with Google using redirect (no popup -> no blocking). */
export const signInWithGoogle = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(auth, provider);
};

/** Sign in anonymously. Used for auto-login so every player has a uid. */
export const signInAnonymous = async (): Promise<User> => {
  const auth = getFirebaseAuth();
  const result = await signInAnonymously(auth);
  return result.user;
};

/**
 * Link the current anonymous user to a Google account using redirect.
 * Does NOT return a user — the page redirects away. On return,
 * call checkRedirectResult() to get the linked user.
 */
export const linkAnonymousToGoogle = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No active session to link");
  await linkWithRedirect(currentUser, provider);
};

/**
 * Check for a pending redirect result from a Google sign-in or link.
 * Returns the user if a redirect sign-in completed, or null.
 */
export const checkRedirectResult = async (): Promise<User | null> => {
  const auth = getFirebaseAuth();
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
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

/** User-friendly auth error messages */
export const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const code = (error as any).code ?? "";
    switch (code) {
      case "auth/popup-blocked":
      case "auth/popup-closed-by-user":
        return "login.error.popupBlocked";
      case "auth/credential-already-in-use":
        return "login.error.alreadyInUse";
      case "auth/account-exists-with-different-credential":
        return "login.error.accountExists";
      case "auth/cancelled-popup-request":
        return "login.error.cancelled";
      case "auth/network-request-failed":
        return "login.error.network";
      default:
        return "login.error.generic";
    }
  }
  return "login.error.generic";
};
