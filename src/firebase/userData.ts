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
    /** Idempotence mark: maps deviceId → true once that guest node has been merged. */
    migratedFrom?: Record<string, boolean>;
    /** Audit trail: orphan credits that were discarded because the target already had a wallet. */
    orphanDiscardedCredits?: Record<string, number>;
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
 * @param options.seedWallet  When false, the wallet branch is NOT written.
 *        Used when a guest→Google migration is pending: the migration itself
 *        will bring the wallet data, and writing STARTING_CREDITS here would
 *        make the target node look like it already has a wallet (causing the
 *        migration wallet-policy to skip credit transfer).
 */
export const ensureUserNode = async (
  user: User,
  provider: "anonymous" | "google",
  deviceId: string,
  options?: { seedWallet?: boolean },
): Promise<void> => {
  const db = getFirebaseDB();
  const userRef = ref(db, `users/${deviceId}`);
  const seedWallet = options?.seedWallet !== false; // default: true

  // Check if node exists
  const { get } = await import("firebase/database");
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const existing = snapshot.val();

    // Always update profile + lastLoginAt (handles anonymous→Google upgrade)
    const updates: Record<string, unknown> = {
      "profile/lastLoginAt": Date.now(),
      "profile/provider": provider,
      "profile/displayName": user.displayName ?? (provider === "google" ? user.email ?? "Google User" : "Anonymous Traveler"),
      "profile/photoURL": user.photoURL,
      "profile/isAnonymous": user.isAnonymous,
      // Preserve existing nickname — do NOT overwrite it on re-login
    };

    // Write createdAt only if it's missing from the existing node.
    // An orphan node written by the old fallback-ág may lack createdAt.
    if (!existing.profile || !existing.profile.createdAt) {
      updates["profile/createdAt"] = Date.now();
    }

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

  // Conditionally omit the wallet branch to avoid seeding credits when a
  // guest→Google migration is pending (see authBootstrap migrationPending).
  if (!seedWallet) {
    const { wallet: _wallet, ...rest } = defaults;
    await update(userRef, rest as unknown as Record<string, unknown>);
  } else {
    await update(userRef, defaults as unknown as Record<string, unknown>);
  }
};

/**
 * Migrate guest data from `users/{deviceId}` to `users/{targetUid}`.
 *
 * When a guest user signs in with Google, this:
 * 1. Reads the guest data at `users/{deviceId}`
 * 2. Merges it into `users/{targetUid}` (idempotent merge via migratedFrom guard)
 * 3. Deletes `users/{deviceId}` children, `device_map/{deviceId}`
 * 4. Marks the migration as done via `users/{targetUid}/profile/migratedFrom/{deviceId}`
 *
 * All of the above happens in a SINGLE atomic root multi-path `update()` call
 * (or a fallback lépésenkénti sequence if the root-update fails).
 *
 * Wallet policy:
 * - If the target already has a `wallet` branch: target wins. Non-zero orphan
 *   credits are logged via console.warn and written to an audit field
 *   (`profile/orphanDiscardedCredits/{deviceId}`).
 * - If the target has NO `wallet` branch: guest credits are transferred.
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
  const guestSnapshot = await get(guestRef);

  // No guest data to migrate
  if (!guestSnapshot.exists()) return false;

  const guestData = guestSnapshot.val() as DeepPartial<UserNode>;

  // Check if the target already has data
  const targetRef = ref(db, `users/${targetUid}`);
  const targetSnapshot = await get(targetRef);

  let targetData: DeepPartial<UserNode> | null = null;
  if (targetSnapshot.exists()) {
    targetData = targetSnapshot.val() as DeepPartial<UserNode>;

    // Idempotence guard: if this deviceId was already migrated, skip merge.
    if (targetData.profile?.migratedFrom?.[deviceId] === true) {
      // Already migrated — just clean up the orphan guest node.
      await cleanupGuestNode(db, deviceId);
      return true;
    }
  }

  // --- Build the atomic updates object ---
  // Root multi-path update: all writes in a single call.
  // Uses ONLY leaf-level paths to avoid RTDB path overlap errors.
  const updates: Record<string, unknown> = {};

  // Idempotence mark (always written)
  updates[`users/${targetUid}/profile/migratedFrom/${deviceId}`] = true;

  // --- Wallet ---
  const guestCredits = guestData.wallet?.credits ?? 0;
  const targetCredits = targetData?.wallet?.credits ?? 0;

  if (targetData?.wallet === undefined || targetData.wallet === null) {
    // Target has NO wallet → transfer guest credits
    updates[`users/${targetUid}/wallet/credits`] = guestCredits;
  } else {
    // Target has a wallet → target wins
    if (guestCredits > 0) {
      console.warn(
        `Guest data migration: orphan credits discarded. deviceId=${deviceId}, ` +
        `credits=${guestCredits}. Target uid=${targetUid} already has wallet.`,
      );
      // Audit trail so the orphan credits can be manually restored if needed
      updates[`users/${targetUid}/profile/orphanDiscardedCredits/${deviceId}`] = guestCredits;
    }
  }

  // --- Inventory (union) ---
  const categories = ["ships", "music", "exoplanets"] as const;
  for (const cat of categories) {
    const guestCat = guestData.inventory?.[cat];
    if (!guestCat) continue;
    for (const [key, val] of Object.entries(guestCat)) {
      if (val === true) {
        updates[`users/${targetUid}/inventory/${cat}/${key}`] = true;
      }
    }
  }

  // --- Stats (max) ---
  const guestBest = guestData.stats?.bestServiceSeconds ?? 0;
  const targetBest = targetData?.stats?.bestServiceSeconds ?? 0;
  if (guestBest > targetBest) {
    updates[`users/${targetUid}/stats/bestServiceSeconds`] = guestBest;
  }

  // --- Settings (only if target has none) ---
  if (!targetData?.settings) {
    if (guestData.settings) {
      // Write individual leaf fields
      if (guestData.settings.activeShipId !== undefined)
        updates[`users/${targetUid}/settings/activeShipId`] = guestData.settings.activeShipId;
      if (guestData.settings.activeMusicId !== undefined)
        updates[`users/${targetUid}/settings/activeMusicId`] = guestData.settings.activeMusicId;
      if (guestData.settings.musicMuted !== undefined)
        updates[`users/${targetUid}/settings/musicMuted`] = guestData.settings.musicMuted;
      if (guestData.settings.musicVolume !== undefined)
        updates[`users/${targetUid}/settings/musicVolume`] = guestData.settings.musicVolume;
      if (guestData.settings.difficulty !== undefined)
        updates[`users/${targetUid}/settings/difficulty`] = guestData.settings.difficulty;
      if (guestData.settings.language !== undefined)
        updates[`users/${targetUid}/settings/language`] = guestData.settings.language;
    }
  }

  // --- Profile (nickname only if target has none; createdAt only if target has none) ---
  if (!targetData?.profile?.nickname && guestData.profile?.nickname) {
    updates[`users/${targetUid}/profile/nickname`] = guestData.profile.nickname;
  }
  if (!targetData?.profile?.createdAt && guestData.profile?.createdAt) {
    updates[`users/${targetUid}/profile/createdAt`] = guestData.profile.createdAt;
  }

  // --- Cleanup: delete guest node children + device_map ---
  // Get the actual keys from the guest snapshot to delete them
  const guestKeys = Object.keys(guestSnapshot.val() || {});
  for (const key of guestKeys) {
    updates[`users/${deviceId}/${key}`] = null;
  }
  updates[`device_map/${deviceId}`] = null;

  // --- Validate: no undefined values, no overlapping paths ---
  for (const [path, val] of Object.entries(updates)) {
    if (val === undefined) {
      console.warn(`migrateGuestData: skipping undefined value at ${path}`);
      delete updates[path];
    }
  }

  // --- Execute atomic multi-path update ---
  const rootRef = ref(db); // root reference for multi-path update
  try {
    await update(rootRef, updates);
  } catch (err) {
    console.error("migrateGuestData: atomic multi-path update failed:", err);

    // Fallback: lépésenkénti sequence (rollback-barát)
    // 1. Write target data + migratedFrom mark
    const targetUpdates: Record<string, unknown> = {};
    for (const [path, val] of Object.entries(updates)) {
      if (path.startsWith(`users/${targetUid}/`)) {
        targetUpdates[path.replace(`users/${targetUid}/`, "")] = val;
      }
    }
    await update(ref(db, `users/${targetUid}`), targetUpdates as Record<string, unknown>);

    // 2. Delete guest node children
    await cleanupGuestNode(db, deviceId);

    // 3. Delete device_map
    const mapRef = ref(db, `device_map/${deviceId}`);
    await set(mapRef, null);
  }

  return true;
};

/**
 * Type helper: all fields optional (for null-safe guest data access).
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Delete all children of a guest node.
 */
const cleanupGuestNode = async (db: ReturnType<typeof getFirebaseDB>, deviceId: string): Promise<void> => {
  const guestRef = ref(db, `users/${deviceId}`);
  const { get } = await import("firebase/database");
  const snap = await get(guestRef);
  if (!snap.exists()) return;

  const keys = Object.keys(snap.val());
  if (keys.length === 0) return;

  const cleanup: Record<string, null> = {};
  for (const key of keys) {
    cleanup[key] = null;
  }
  await update(guestRef, cleanup);
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
