import { ref, onValue, update, set, type Unsubscribe, type DatabaseReference } from "firebase/database";
import { getFirebaseDB } from "./config";
import type { User } from "firebase/auth";
import {
  STARTING_CREDITS,
  DEBUG_STARTING_CREDITS,
  BASE_EXOPLANET_IDS,
} from "../constants/shopCatalog";

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

/** Default user data for first-time users. */
export interface UserNode {
  profile: {
    displayName: string;
    photoURL: string | null;
    provider: "anonymous" | "google";
    isAnonymous: boolean;
    createdAt: number;
    lastLoginAt: number;
    /** Custom nickname editable by the user. */
    nickname: string;
  };
  settings: {
    activeShipId: string | null;
    activeMusicId: string | null;
    musicMuted: boolean;
    musicVolume: number;
    difficulty: string;
    language: string;
  };
  wallet: {
    credits: number;
  };
  inventory: {
    ships: Record<string, boolean>;
    music: Record<string, boolean>;
    exoplanets: Record<string, boolean>;
  };
  stats: {
    bestServiceSeconds: number;
  };
}

const getDefaultUserNode = (user: User, provider: "anonymous" | "google"): UserNode => ({
  profile: {
    displayName: user.displayName ?? "Anonymous Traveler",
    photoURL: user.photoURL,
    provider,
    isAnonymous: user.isAnonymous,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    nickname: "",
  },
  settings: {
    activeShipId: null,
    activeMusicId: null,
    musicMuted: false,
    musicVolume: 0.5,
    difficulty: "medium",
    language: navigator.language?.split("-")[0] ?? "en",
  },
  wallet: {
    credits: DEBUG_MODE ? DEBUG_STARTING_CREDITS : STARTING_CREDITS,
  },
  inventory: {
    ships: {},
    music: {},
    // Seed the base exoplanets so a fresh user does not lose them on first sync.
    exoplanets: Object.fromEntries(BASE_EXOPLANET_IDS.map((id) => [id, true])),
  },
  stats: {
    bestServiceSeconds: 0,
  },
});

/**
 * Create or update the device_map entry so the security rules can verify
 * ownership: device_map/{deviceId} → firebaseAuthUid.
 *
 * This MUST be called BEFORE any read/write at `users/{deviceId}` because the
 * `/users/$deviceId` rules verify that `device_map/$deviceId == auth.uid`.
 */
export const ensureDeviceMap = async (
  deviceId: string,
  firebaseAuthUid: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const mapRef = ref(db, `device_map/${deviceId}`);
  await set(mapRef, firebaseAuthUid);
};

/**
 * Ensure the user node exists in RTDB.
 * If missing, creates it with defaults (idempotent).
 *
 * @param deviceId The stable device-based key — the node lives at `users/{deviceId}`.
 */
export const ensureUserNode = async (user: User, provider: "anonymous" | "google", deviceId: string): Promise<void> => {
  const db = getFirebaseDB();
  const userRef = ref(db, `users/${deviceId}`);

  // Check if node exists
  const { get } = await import("firebase/database");
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    // Always update profile + lastLoginAt (handles anonymous→Google upgrade)
    const updates: Record<string, unknown> = {
      "profile/lastLoginAt": Date.now(),
      "profile/provider": provider,
      "profile/displayName": user.displayName ?? (provider === "google" ? user.email ?? "Google User" : "Anonymous Traveler"),
      "profile/photoURL": user.photoURL,
      "profile/isAnonymous": user.isAnonymous,
      // Preserve existing nickname — do NOT overwrite it on re-login
    };
    await update(userRef, updates);
    return;
  }

  // Create default node.
  //
  // Use `update` (not `set`) so the write is evaluated PER top-level child
  // (profile/settings/wallet/inventory/stats). The security rules grant
  // `.write` only on those children — NOT on `users/$uid` itself — and RTDB
  // write rules cascade downward, never upward. A `set` on the parent path
  // therefore hits the (absent) `users/$uid` rule and fails with
  // PERMISSION_DENIED, whereas a multi-path `update` is checked against each
  // child rule and succeeds. This also keeps the Phase-2 rules (server-only
  // wallet/inventory) achievable without a $uid-level write grant.
  const defaults = getDefaultUserNode(user, provider);
  await update(userRef, defaults as unknown as Record<string, unknown>);
};

/**
 * Migrate guest data from `users/{deviceId}` to `users/{targetUid}`.
 *
 * When a guest user signs in with Google, this:
 * 1. Reads the guest data at `users/{deviceId}`
 * 2. Writes it to `users/{targetUid}` (merging with any existing data)
 * 3. Deletes `users/{deviceId}`
 * 4. Deletes `device_map/{deviceId}`
 *
 * After migration, all subsequent operations use `users/{targetUid}`.
 * The security rules grant access via `$key == auth.uid` for the target path.
 *
 * @returns true if guest data was found and migrated, false otherwise.
 */
export const migrateGuestData = async (
  deviceId: string,
  targetUid: string,
): Promise<boolean> => {
  // No migration needed if the keys are the same (theoretical edge case)
  if (deviceId === targetUid) return false;

  const db = getFirebaseDB();
  const guestRef = ref(db, `users/${deviceId}`);

  const { get } = await import("firebase/database");
  const snapshot = await get(guestRef);

  // No guest data to migrate
  if (!snapshot.exists()) return false;

  const guestData = snapshot.val() as UserNode;

  // Check if the target already has data
  const targetRef = ref(db, `users/${targetUid}`);
  const targetSnapshot = await get(targetRef);

  if (targetSnapshot.exists()) {
    // Merge: combine guest + existing data. Guest wins for most fields,
    // but wallet credits are summed (so nothing is lost).
    const targetData = targetSnapshot.val() as UserNode;

    // Merge credits: sum them
    guestData.wallet.credits = (guestData.wallet?.credits ?? 0) + (targetData.wallet?.credits ?? 0);

    // Merge inventory: union of both sets
    if (targetData.inventory) {
      for (const cat of ["ships", "music", "exoplanets"] as const) {
        if (!guestData.inventory) guestData.inventory = { ships: {}, music: {}, exoplanets: {} };
        if (targetData.inventory[cat]) {
          for (const key of Object.keys(targetData.inventory[cat])) {
            if (targetData.inventory[cat][key]) {
              guestData.inventory[cat][key] = true;
            }
          }
        }
      }
    }

    // Stats: keep the best
    if (targetData.stats?.bestServiceSeconds !== undefined && guestData.stats) {
      guestData.stats.bestServiceSeconds = Math.max(
        guestData.stats.bestServiceSeconds ?? 0,
        targetData.stats.bestServiceSeconds,
      );
    }

    // Settings: guest settings take precedence (they were actively playing)
    // (guestData.settings already has the guest values from the snapshot)
  }

  // Write merged data to target path.
  // Use `update` (not `set`) so the write is evaluated PER top-level child
  // (profile/settings/wallet/inventory/stats). The security rules grant
  // `.write` only on those children — NOT on `users/$key` itself — and RTDB
  // write rules cascade downward, never upward. A `set` on the parent path
  // would hit the (absent) `users/$key` rule and fail with PERMISSION_DENIED.
  await update(targetRef, {
    profile: guestData.profile,
    settings: guestData.settings,
    wallet: guestData.wallet,
    inventory: guestData.inventory,
    stats: guestData.stats,
  } as unknown as Record<string, unknown>);

  // Delete guest data (write null to the parent — this is allowed because the
  // device_map entry still exists at this point, so $key == auth.uid passes...
  // Wait: the parent path itself still has no .write rule, but delete via set(null)
  // to $key itself also fails. Instead, delete each child individually.
  await update(guestRef, {
    profile: null,
    settings: null,
    wallet: null,
    inventory: null,
    stats: null,
  } as unknown as Record<string, unknown>);

  // Delete device_map entry (no longer needed; targetUid grants access via $key == auth.uid)
  // The security rule `data.val() == auth.uid` allows deletion.
  const mapRef = ref(db, `device_map/${deviceId}`);
  await set(mapRef, null);

  return true;
};

/**
 * Subscribe to a user's data in RTDB.
 * Calls callback every time the data changes.
 * Returns an unsubscribe function.
 *
 * Automatically retries on `permission_denied` with exponential backoff.
 * This works around a Firebase RTDB race condition where the WebSocket
 * connection may not yet have received the auth token when the first
 * listen request is sent — the REST-based `get`/`update` calls (which
 * send a token inline) succeed, but `onValue` over the still-authenticating
 * WebSocket sees `auth = null` and is denied.
 */
export const subscribeUser = (
  uid: string,
  callback: (data: UserNode | null) => void,
  maxRetries = 4,
  baseDelayMs = 1000,
): Unsubscribe => {
  const db = getFirebaseDB();
  const userRef = ref(db, `users/${uid}`);

  let unsub: Unsubscribe | null = null;
  let retryCount = 0;
  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const attempt = () => {
    if (cancelled) return;

    unsub = onValue(
      userRef,
      (snapshot) => {
        // A successful read signals the connection is alive and authenticated.
        retryCount = 0;
        const data = snapshot.val();
        callback(data as UserNode | null);
      },
      (error) => {
        // Determine whether this is a permission_denied error.
        const isPermissionDenied =
          (error as { code?: string })?.code === "PERMISSION_DENIED" ||
          /permission_denied/i.test(String(error));

        if (isPermissionDenied && retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelayMs * Math.pow(2, retryCount - 1); // 1s, 2s, 4s, 8s
          console.warn(
            `Firebase subscribe permission_denied — retry ${retryCount}/${maxRetries} ` +
            `for uid ${uid} in ${delay}ms`,
          );
          timerId = setTimeout(attempt, delay);
        } else {
          console.error("Firebase subscribe error:", error);
          callback(null);
        }
      },
    );
  };

  attempt();

  // Return a cleanup function that cancels pending retries and unsubscribes.
  return () => {
    cancelled = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (unsub) unsub();
  };
};

/**
 * Update user settings in RTDB (partial update).
 */
export const updateUserSettings = async (
  uid: string,
  settings: Partial<UserNode["settings"]>,
): Promise<void> => {
  const db = getFirebaseDB();
  const settingsRef = ref(db, `users/${uid}/settings`);

  const updates: Record<string, unknown> = {};
  if (settings.activeShipId !== undefined) updates.activeShipId = settings.activeShipId;
  if (settings.activeMusicId !== undefined) updates.activeMusicId = settings.activeMusicId;
  if (settings.musicMuted !== undefined) updates.musicMuted = settings.musicMuted;
  if (settings.musicVolume !== undefined) updates.musicVolume = settings.musicVolume;
  if (settings.difficulty !== undefined) updates.difficulty = settings.difficulty;
  if (settings.language !== undefined) updates.language = settings.language;

  await update(settingsRef, updates);
};

/**
 * Update user stats in RTDB (partial update).
 */
export const updateUserStats = async (
  uid: string,
  stats: Partial<UserNode["stats"]>,
): Promise<void> => {
  const db = getFirebaseDB();
  const statsRef = ref(db, `users/${uid}/stats`);
  await update(statsRef, stats);
};

/**
 * Update the user's credit balance in RTDB.
 */
export const updateUserWallet = async (
  uid: string,
  credits: number,
): Promise<void> => {
  const db = getFirebaseDB();
  const walletRef = ref(db, `users/${uid}/wallet`);
  await set(walletRef, { credits });
};

/**
 * Update the user's custom nickname in RTDB.
 */
export const updateUserNickname = async (
  uid: string,
  nickname: string,
): Promise<void> => {
  const db = getFirebaseDB();
  await update(ref(db, `users/${uid}/profile`), { nickname });
};

/**
 * Update the user's inventory in RTDB.
 * Merges with existing inventory for the given category.
 */
export const updateUserInventory = async (
  uid: string,
  category: "ships" | "music" | "exoplanets",
  items: Record<string, boolean>,
): Promise<void> => {
  const db = getFirebaseDB();
  const invRef = ref(db, `users/${uid}/inventory/${category}`);
  await set(invRef, items);
};
