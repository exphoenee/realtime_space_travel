import { getFirebaseAuth } from "./config";
import {
  onAuthChange,
  signInAnonymous,
  checkRedirectResult,
  getAuthErrorMessage,
} from "./auth";
import {
  ensureDeviceMap,
  ensureUserNode,
  subscribeUser,
  migrateGuestData,
  type UserNode,
} from "./userData";
import { getDeviceId, clearDeviceId } from "./deviceId";
import useAuthStore from "../state/useAuthStore";
import useGameStore from "../state/useGameStore";

// Module-scope singleton state. Living at module scope (rather than inside a
// React effect closure) is what makes this StrictMode-safe: the double
// mount/cleanup/mount cycle can no longer spin up a second anonymous login.
let started = false;
let anonInit = false;
let redirectCheckDone = false;
let unsubAuth: (() => void) | null = null;
let unsubUser: (() => void) | null = null;

/**
 * Trigger anonymous auto-login exactly once, and only when there is genuinely
 * no current user. `anonInit` is set to true AFTER a successful call so a
 * failure leaves it false → the next auth event can retry.
 */
const maybeAnonLogin = async () => {
  if (anonInit) return;
  if (getFirebaseAuth().currentUser != null) return;
  try {
    await signInAnonymous();
    anonInit = true; // only mark done on success → retryable on failure
  } catch (err) {
    // Leave anonInit = false so a later auth event can retry.
    useAuthStore.getState().setAuthError(getAuthErrorMessage(err));
    console.error("Anonymous auto-login failed:", err);
  }
};

/**
 * Boot the Firebase auth lifecycle. Idempotent: safe to call multiple times
 * (StrictMode, HMR) — only the first call does any work.
 *
 * @param handleUserData Callback that syncs an RTDB user node into local stores.
 *                       This logic stays in App.tsx.
 */
export const startAuthBootstrap = (
  handleUserData: (data: UserNode | null) => void,
) => {
  if (started) return; // StrictMode double-mount guard (MODULE scope!)
  started = true;

  // Process the redirect result FIRST, so onAuthChange does not prematurely
  // clear the store or start anonymous login over a pending Google return.
  checkRedirectResult().then(({ user, error }) => {
    if (error) {
      useAuthStore.getState().setAuthError(getAuthErrorMessage(error));
      console.error("Redirect sign-in failed:", error);
    }
    if (user) {
      useAuthStore.getState().setUser(user);
      // Skip intro on OAuth return — go straight to the main menu.
      useGameStore.getState().transitionTo("mainMenu");
    }
    redirectCheckDone = true;

    // If onAuthChange already fired with null and returned early, kick off
    // anonymous auto-login now that the redirect check has completed.
    if (!user && !useAuthStore.getState().user) {
      void maybeAnonLogin();
    }
  });

  unsubAuth = onAuthChange(async (user) => {
    // No user yet and the redirect result is still pending → wait, don't clear
    // the store prematurely.
    if (!user && !anonInit && !redirectCheckDone) {
      return;
    }

    useAuthStore.getState().setUser(user);

    if (!user) {
      // User signed out — tear down the old listener before its auth context
      // disappears, preventing a permission_denied cascade on the stale
      // onValue listener for the previous uid.
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }
      await maybeAnonLogin();
      return;
    }    // Create/update the device → auth mapping BEFORE touching users/{deviceId}.
    // The security rules on /users check device_map/$deviceId == auth.uid, so
    // the mapping must exist before we attempt any read or write.
    const deviceId = getDeviceId();
    try {
      await ensureDeviceMap(deviceId, user.uid);
    } catch (err) {
      console.error("device_map write failed:", err);
    }

    // If this is a Google (non-anonymous) user, attempt to migrate guest data
    // from users/{deviceId} to users/{user.uid}. The rtdbKey in the store
    // is already set to user.uid by setUser() above.
    if (!user.isAnonymous) {
      try {
        const migrated = await migrateGuestData(deviceId, user.uid);
        if (migrated) {
          console.log("Guest data migrated to", user.uid);
          // After successful migration, rotate the deviceId in localStorage so
          // the old deviceId can never be reused. The old guest data has been
          // deleted by migrateGuestData and the device_map entry is gone, but
          // without rotating, a new guest session on the same device would still
          // produce the same deviceId → another ensureUserNode with fresh defaults
          // → another migration on next Google login → credits would accumulate.
          const newDeviceId = clearDeviceId();
          const store = useAuthStore.getState();
          store.setDeviceId(newDeviceId);
          // rtdbKey stays as user.uid (set by setUser above)
        }
      } catch (err) {
        console.error("Guest data migration failed:", err);
        // Non-fatal: fall back to deviceId path if migration fails
        useAuthStore.getState().setRtdbKey(deviceId);
      }
    }

    // Determine the correct RTDB key (uid for Google users, deviceId for guests)
    const rtdbKey = useAuthStore.getState().rtdbKey;

    // Ensure the RTDB node exists at the correct path, but subscribe REGARDLESS
    // of whether that write succeeds — a PERMISSION_DENIED on ensureUserNode
    // must not stop the read path from ever running.
    try {
      await ensureUserNode(user, user.isAnonymous ? "anonymous" : "google", rtdbKey);
    } catch (err) {
      useAuthStore.getState().setAuthError(getAuthErrorMessage(err));
      console.error("Firebase sync failed:", err);
    }
    if (unsubUser) {
      unsubUser();
      unsubUser = null;
    }
    unsubUser = subscribeUser(rtdbKey, handleUserData); // ALWAYS runs
  });
};

/**
 * Tear down the auth lifecycle and reset the singleton flags. Intended for
 * tests / HMR. The App root deliberately does NOT call this from its effect
 * cleanup — keeping the singleton alive across a StrictMode remount is exactly
 * what prevents a second anonymous login.
 */
export const stopAuthBootstrap = () => {
  if (unsubAuth) {
    unsubAuth();
    unsubAuth = null;
  }
  if (unsubUser) {
    unsubUser();
    unsubUser = null;
  }
  started = false;
  anonInit = false;
  redirectCheckDone = false;
};
