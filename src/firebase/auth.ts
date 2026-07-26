import {
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signInWithRedirect,
  linkWithRedirect,
  signInWithCredential,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type AuthError,
} from "firebase/auth";
import { getFirebaseAuth } from "./config";

/**
 * Start a Google sign-in (unified entry point for both the MainMenu and
 * Settings buttons).
 *
 * - Anonymous session → linkWithPopup: keeps the same uid and all RTDB data.
 * - Otherwise → signInWithPopup.
 * - `auth/credential-already-in-use`: the Google account already exists under
 *   another uid → sign into that account (guest progress cannot be carried over).
 * - Popup blocked / unsupported → redirect fallback (page navigates away,
 *   returns null; the result is picked up by checkRedirectResult on return).
 *
 * Returns the signed-in user, or null when a redirect fallback was triggered.
 */
export const startGoogleAuth = async (): Promise<User | null> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  try {
    // Anonymous → LINK: the uid and all RTDB data are preserved
    const cred = current?.isAnonymous
      ? await linkWithPopup(current, provider)
      : await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // The Google account already exists under another uid → sign into it
    // (the guest progress cannot be transferred)
    if (code === "auth/credential-already-in-use") {
      const credential = GoogleAuthProvider.credentialFromError(err as AuthError);
      if (credential) return (await signInWithCredential(auth, credential)).user;
    }
    // Popup blocked / not supported → redirect fallback (the page navigates away)
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      if (current?.isAnonymous) {
        await linkWithRedirect(current, provider);
      } else {
        await signInWithRedirect(auth, provider);
      }
      return null;
    }
    throw err;
  }
};

/** Sign in anonymously. Used for auto-login so every player has a uid. */
export const signInAnonymous = async (): Promise<User> => {
  const auth = getFirebaseAuth();
  const result = await signInAnonymously(auth);
  return result.user;
};

/**
 * Check for a pending redirect result from a Google sign-in or link.
 * Does NOT swallow errors — the caller decides how to surface them.
 * Returns { user, error }: on success { user, error: null };
 * on failure { user: null, error }.
 */
export const checkRedirectResult = async (): Promise<{
  user: User | null;
  error: unknown | null;
}> => {
  const auth = getFirebaseAuth();
  try {
    const result = await getRedirectResult(auth);
    return { user: result?.user ?? null, error: null };
  } catch (err) {
    return { user: null, error: err };
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
