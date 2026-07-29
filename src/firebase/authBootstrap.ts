import { getFirebaseAuth, getFirebaseDB } from "./config";
import { ref, onDisconnect as rtdbOnDisconnect, set } from "firebase/database";
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
  updateOnlineStatus,
  updateUserPublicProfile,
  type UserNode,
} from "./userData";
import { getDeviceId } from "./deviceId";
import useAuthStore, { getRtdbKey } from "../state/useAuthStore";
import type { MergeResult } from "./userData";
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
    // from users/{deviceId} to users/{user.uid}. The RTDB key for authenticated
    // users is ALWAYS user.uid — this is a structural invariant enforced by the
    // derived selectRtdbKey/getRtdbKey selectors (there is no setRtdbKey action).
    let migrationPending = false;
    if (!user.isAnonymous) {
      try {
        const result: MergeResult = await migrateGuestData(deviceId, user.uid);
        if (result.kind === "merged") {
          console.log("Guest data merged to", user.uid, "— added credits:", result.addedCredits);
        } else if (result.kind === "blocked") {
          console.log("Guest merge blocked for", user.uid, "— already claimed");
          useAuthStore.getState().setMergeNotice("login.guestMergeAlreadyClaimed");
        } else if (result.kind === "noop") {
          // Nothing to migrate — silently continue
        }
      } catch (err) {
        console.error("Guest data migration failed:", err);
        useAuthStore.getState().setAuthError(getAuthErrorMessage(err));
        // ❌ NO fallback to deviceId. The rtdbKey is a DERIVED value and
        // cannot be swapped. A migration failure is logged + surfaced to the
        // user; the next auth event retries. The identity stays on user.uid.
        migrationPending = true; // prevents wallet seeding (see ensureUserNode)
      }
    }

    // Get the RTDB key — derived from auth state, guaranteed to be user.uid
    // for non-anonymous users (see selectRtdbKey in useAuthStore.ts).
    const rtdbKey = getRtdbKey();

    // Ensure the RTDB node exists at the correct path, but subscribe REGARDLESS
    // of whether that write succeeds — a PERMISSION_DENIED on ensureUserNode
    // must not stop the read path from ever running.
    try {
      await ensureUserNode(
        user,
        user.isAnonymous ? "anonymous" : "google",
        rtdbKey,
        { seedWallet: !migrationPending }, // skip wallet seed if migration is pending
      );
    } catch (err) {
      useAuthStore.getState().setAuthError(getAuthErrorMessage(err));
      console.error("Firebase sync failed:", err);
    }
    if (unsubUser) {
      unsubUser();
      unsubUser = null;
    }
    unsubUser = subscribeUser(rtdbKey, handleUserData); // ALWAYS runs

    // --- Online status broadcast ---
    // Set online status immediately
    updateOnlineStatus(rtdbKey, "online").catch(console.error);

    // Firebase onDisconnect: when the client disconnects (browser close, tab switch,
    // network drop), the RTDB server automatically sets the status to "offline".
    // Guests are skipped: `usersPublic` only accepts writes keyed by auth.uid,
    // while a guest's rtdbKey is the deviceId — the registration would just be
    // rejected. Guests have no friend graph, so nobody reads their status.
    if (!user.isAnonymous) {
      const db = getFirebaseDB();
      const statusRef = ref(db, `usersPublic/${rtdbKey}/onlineStatus`);
      rtdbOnDisconnect(statusRef).set("offline").catch(console.error);
    }

    // --- Public profile (for search) ---
    // Create/update usersPublic entry so other players can find this user.
    // Use displayName from Firestore fallback if not provided by auth.
    const publicNickname = useAuthStore.getState().nickname || "";
    const publicDisplayName = user.displayName || (user.email ? user.email : null);
    updateUserPublicProfile(rtdbKey, publicNickname, publicDisplayName).catch(console.error);
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
