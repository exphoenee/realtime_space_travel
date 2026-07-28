import { ref, onValue, update, set, runTransaction, push, type Unsubscribe, type DatabaseReference } from "firebase/database";
import { getFirebaseDB } from "./config";
import type { User } from "firebase/auth";
import {
  STARTING_CREDITS,
  DEBUG_STARTING_CREDITS,
  BASE_EXOPLANET_IDS,
} from "../constants/shopCatalog";
import type { FailureRecord, SuccessRecord, FriendRequest, UserOnlineStatus, UserPublicProfile, ChatMessage, MultiplayerSession, SessionStatus } from "../types";

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

/** Random space-themed nicknames for new users */
const ANON_NICKNAMES = [
  "cosmic_drifter",
  "star_wanderer",
  "nebula_rider",
  "void_walker",
  "astro_nova",
  "lunar_pilgrim",
  "solar_sailor",
  "eclipse_hunter",
  "quantum_traveler",
  "orbital_vagabond",
  "cassiopeia_roamer",
  "deep_space_nomad",
  "asteroid_hopper",
  "galaxy_gazer",
  "comet_chaser",
  "terra_explorer",
  "stellar_mariner",
  "dark_matter_rider",
  "photon_glider",
  "supernova_surfer",
];

/** Generate a random anonymous nickname like "cosmic_drifter_4821" */
const generateRandomNickname = (): string => {
  const base = ANON_NICKNAMES[Math.floor(Math.random() * ANON_NICKNAMES.length)];
  const digits = Math.floor(1000 + Math.random() * 9000); // 1000–9999
  return `${base}_${digits}`;
};

/**
 * Result of a guest data migration attempt.
 * - "noop": nothing to do (same key, or no guest node)
 * - "blocked": the target account has already claimed a guest merge
 * - "merged": first-time merge with credits transferred
 */
export type MergeResult =
  | { kind: "noop" }
  | { kind: "blocked" }
  | { kind: "merged"; addedCredits: number };

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
    /**
     * DEPRECATED (legacy): per-deviceId idempotence mark.
     * Do NOT write new entries here — use `guestMergeClaimed` instead.
     * Non-empty migratedFrom is treated as "claimed" by isGuestMergeClaimed().
     */
    migratedFrom?: Record<string, boolean>;
    /**
     * Per-account gate: once true, this account has merged a guest session.
     * Further merge attempts are blocked (guest node cleaned, credits audited).
     * This is the REPLACEMENT for the per-deviceId migratedFrom map.
     */
    guestMergeClaimed?: boolean;
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
    nickname: generateRandomNickname(),
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
/**
 * Check if a target account has already claimed a guest merge.
 * Returns true if:
 * - guestMergeClaimed === true (new flag), OR
 * - migratedFrom has any keys (legacy — non-empty means already claimed)
 */
export const isGuestMergeClaimed = (
  targetData: DeepPartial<UserNode> | null,
): boolean => {
  if (!targetData?.profile) return false;
  if (targetData.profile.guestMergeClaimed === true) return true;
  const migratedFrom = targetData.profile.migratedFrom;
  if (migratedFrom && typeof migratedFrom === "object" && Object.keys(migratedFrom).length > 0) {
    return true;
  }
  return false;
};

/**
 * Migrate guest data from `users/{deviceId}` to `users/{targetUid}`.
 *
 * When a guest user signs in with Google, this:
 * 1. Reads the guest data at `users/{deviceId}`
 * 2. If the target has NOT claimed a merge yet:
 *    - Merges guest data INTO the target (ADDITION for credits, union for inventory,
 *      max for stats, settings only if target has none)
 *    - Sets `profile/guestMergeClaimed = true`
 * 3. If the target HAS claimed a merge:
 *    - BLOCKS the merge (no credit/item transfer)
 *    - Audits orphan credits to `profile/orphanDiscardedCredits/{deviceId}`
 * 4. Always: deletes guest node children + device_map/{deviceId}
 *
 * All writes happen in a SINGLE atomic root multi-path `update()` call
 * (or a fallback lépésenkénti sequence if the root-update fails).
 *
 * Wallet policy:
 * - FIRST merge: guest credits ADD to target credits (`target + guest`).
 * - BLOCKED (already claimed): no wallet write; orphan credits audited.
 *
 * @returns MergeResult indicating what happened.
 */
export const migrateGuestData = async (
  deviceId: string,
  targetUid: string,
): Promise<MergeResult> => {
  // No migration needed if the keys are the same (theoretical edge case)
  if (deviceId === targetUid) return { kind: "noop" };

  const db = getFirebaseDB();
  const { get } = await import("firebase/database");

  // Read guest node
  const guestRef = ref(db, `users/${deviceId}`);
  const guestSnapshot = await get(guestRef);

  // No guest data to migrate
  if (!guestSnapshot.exists()) return { kind: "noop" };

  const guestData = guestSnapshot.val() as DeepPartial<UserNode>;

  // Read target node
  const targetRef = ref(db, `users/${targetUid}`);
  const targetSnapshot = await get(targetRef);

  let targetData: DeepPartial<UserNode> | null = null;
  if (targetSnapshot.exists()) {
    targetData = targetSnapshot.val() as DeepPartial<UserNode>;
  }

  // --- Build the atomic updates object ---
  // Root multi-path update: all writes in a single call.
  // Uses ONLY leaf-level paths to avoid RTDB path overlap errors.
  const updates: Record<string, unknown> = {};

  const guestCredits = guestData.wallet?.credits ?? 0;

  // --- CAPU CHECK: is merge already claimed? ---
  if (isGuestMergeClaimed(targetData)) {
    // BLOCKED: no credit/item transfer, just audit + cleanup
    if (guestCredits > 0) {
      console.warn(
        `Guest merge BLOCKED: orphan credits discarded. deviceId=${deviceId}, ` +
        `credits=${guestCredits}. Target uid=${targetUid} already claimed a merge.`,
      );
      updates[`users/${targetUid}/profile/orphanDiscardedCredits/${deviceId}`] = guestCredits;
    }

    // Ensure flag is set (idempotent)
    updates[`users/${targetUid}/profile/guestMergeClaimed`] = true;

    // Cleanup: delete guest node children + device_map
    const guestKeys = Object.keys(guestSnapshot.val() || {});
    for (const key of guestKeys) {
      updates[`users/${deviceId}/${key}`] = null;
    }
    updates[`device_map/${deviceId}`] = null;

    // --- Validate: no undefined values ---
    for (const [path, val] of Object.entries(updates)) {
      if (val === undefined) {
        console.warn(`migrateGuestData: skipping undefined value at ${path}`);
        delete updates[path];
      }
    }

    // Execute atomic multi-path update
    await executeAtomicUpdate(db, updates, deviceId);

    return { kind: "blocked" };
  }

  // --- FIRST MERGE: target + guest ADDITION ---
  // Idempotence mark: DO NOT write migratedFrom (deprecated) — use guestMergeClaimed
  updates[`users/${targetUid}/profile/guestMergeClaimed`] = true;

  // --- Wallet: ADDITION (NOT overwrite) ---
  const targetCredits = targetData?.wallet?.credits ?? 0;
  const newCredits = targetCredits + guestCredits;
  updates[`users/${targetUid}/wallet/credits`] = newCredits;

  // --- Inventory (union: guest items only where target doesn't have them) ---
  const categories = ["ships", "music", "exoplanets"] as const;
  for (const cat of categories) {
    const guestCat = guestData.inventory?.[cat];
    if (!guestCat) continue;
    for (const [key, val] of Object.entries(guestCat)) {
      if (val === true) {
        // Only write if target doesn't already have this item
        const targetHas = targetData?.inventory?.[cat]?.[key] === true;
        if (!targetHas) {
          updates[`users/${targetUid}/inventory/${cat}/${key}`] = true;
        }
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

  // Verify no prefix-overlapping paths (leaf-level only)
  const paths = Object.keys(updates);
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (paths[i].startsWith(paths[j] + "/") || paths[j].startsWith(paths[i] + "/")) {
        console.warn(`migrateGuestData: overlapping paths detected: ${paths[i]} vs ${paths[j]}`);
      }
    }
  }

  // --- Execute atomic multi-path update ---
  await executeAtomicUpdate(db, updates, deviceId);

  return { kind: "merged", addedCredits: guestCredits };
};

/**
 * Execute the atomic multi-path update with fallback.
 * Tries root-level update first; if that fails, does lépésenkénti sequence.
 */
async function executeAtomicUpdate(
  db: ReturnType<typeof getFirebaseDB>,
  updates: Record<string, unknown>,
  deviceId: string,
): Promise<void> {
  const rootRef = ref(db);
  try {
    await update(rootRef, updates);
  } catch (err) {
    console.error("migrateGuestData: atomic multi-path update failed:", err);

    // Fallback: lépésenkénti sequence (rollback-barát)
    // Extract target updates (any path starting with `users/${targetUid}/`)
    const targetUpdates: Record<string, unknown> = {};
    const targetUidPath = Object.keys(updates).find(k => k.startsWith("users/") && !k.startsWith("users/$"));
    // Find all target paths (anything that's not a cleanup path)
    for (const [path, val] of Object.entries(updates)) {
      if (!path.startsWith(`users/${deviceId}/`) && !path.startsWith(`device_map/`)) {
        // Extract the relative path from the first segment
        const match = path.match(/^users\/[^/]+\/(.+)$/);
        if (match) {
          targetUpdates[match[1]] = val;
        }
      }
    }

    if (Object.keys(targetUpdates).length > 0) {
      // Write target data (guestMergeClaimed flag + all merge values)
      // We need to find the targetUid from the updates
      const targetUidKey = Object.keys(updates).find(k =>
        k.startsWith("users/") && !k.startsWith(`users/${deviceId}/`)
      );
      if (targetUidKey) {
        const uid = targetUidKey.split("/")[1];
        await update(ref(db, `users/${uid}`), targetUpdates as Record<string, unknown>);
      }
    }

    // Delete guest node children
    await cleanupGuestNode(db, deviceId);

    // Delete device_map
    const mapRef = ref(db, `device_map/${deviceId}`);
    await set(mapRef, null);
  }
}

/**
 * Type helper: all fields optional (for null-safe guest data access).
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Delete all children of a guest node AND its device_map entry.
 * This is the universal cleanup — every code path that deletes a guest node
 * MUST also delete `device_map/{deviceId}` to prevent mapping leaks.
 */
const cleanupGuestNode = async (db: ReturnType<typeof getFirebaseDB>, deviceId: string): Promise<void> => {
  const guestRef = ref(db, `users/${deviceId}`);
  const { get } = await import("firebase/database");
  const snap = await get(guestRef);

  // Build the cleanup updates (guest node children + device_map)
  const cleanup: Record<string, unknown> = {};
  if (snap.exists()) {
    const keys = Object.keys(snap.val());
    if (keys.length > 0) {
      for (const key of keys) {
        cleanup[`users/${deviceId}/${key}`] = null;
      }
    }
  }
  // Always delete device_map too
  cleanup[`device_map/${deviceId}`] = null;

  if (Object.keys(cleanup).length === 0) return;

  // Use root update for atomicity (both guest node and device_map in one call)
  const rootRef = ref(db);
  await update(rootRef, cleanup);
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
 * Update the user's credit balance in RTDB (set-based overwrite).
 *
 * Used by the DEBUG / non-Stripe flow (useShopStore.buyCredits).
 * For Stripe purchases, use `incrementUserWallet` instead — it uses
 * runTransaction for atomic credit addition.
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
 * Atomically increment the user's credit balance using runTransaction.
 *
 * This is the Stripe-flow entry point: it reads the current server-side
 * balance in a transaction, adds `delta`, and writes the result.
 * Unlike `updateUserWallet` (which uses `set()` and OVERWRITES), this
 * ADDS to the existing balance and is race-condition safe.
 *
 * Automatically handles null/undefined by treating missing credits as 0.
 *
 * @returns The new credit balance after the increment.
 */
export const incrementUserWallet = async (
  uid: string,
  delta: number,
): Promise<number> => {
  const db = getFirebaseDB();
  const creditRef = ref(db, `users/${uid}/wallet/credits`);

  const result = await runTransaction(creditRef, (current) => {
    return (current ?? 0) + delta;
  });

  // result.snapshot.val() is the new value after the transaction
  return (result.snapshot.val() as number) ?? 0;
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

// --- Wall of Shame ---

/**
 * Save a failure record to RTDB under `walls/{uid}/failures`.
 * Uses push() to create a new entry with an auto-generated key.
 */
export const saveFailureRecord = async (
  uid: string,
  record: FailureRecord,
): Promise<void> => {
  const db = getFirebaseDB();
  const failuresRef = ref(db, `walls/${uid}/failures`);
  await push(failuresRef, record);
};

/**
 * Subscribe to failure records in RTDB.
 * Calls callback with an array of FailureRecord every time data changes.
 * Returns an unsubscribe function.
 */
export const subscribeFailures = (
  uid: string,
  callback: (records: FailureRecord[]) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const failuresRef = ref(db, `walls/${uid}/failures`);

  return onValue(failuresRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    // Convert the object of push-IDs → array of FailureRecords
    const records: FailureRecord[] = Object.entries(data).map(([pushId, value]) => {
      const record = value as FailureRecord;
      return { ...record, id: record.id || pushId };
    });
    // Sort by failedAt descending (most recent first)
    records.sort((a, b) => b.failedAt - a.failedAt);
    callback(records);
  });
};

// --- Social / Friends ---

/**
 * Send a friend request from the current user to another user.
 * Creates entries in both:
 * - friendRequests/{toUid}/{fromUid} (recipient's inbox)
 * - outgoingRequests/{fromUid}/{toUid} (sender's outbox — for real-time status)
 */
export const sendFriendRequest = async (
  fromUid: string,
  toUid: string,
  fromNickname: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const rootRef = ref(db);
  await update(rootRef, {
    [`friendRequests/${toUid}/${fromUid}`]: {
      from: fromUid,
      fromNickname,
      at: Date.now(),
      status: "pending",
    },
    [`outgoingRequests/${fromUid}/${toUid}`]: {
      to: toUid,
      at: Date.now(),
      status: "pending",
    },
  });
};

/**
 * Accept a friend request.
 * Adds each user to the other's friends list, updates the request status,
 * and cleans up the sender's outgoing request entry.
 */
export const acceptFriendRequest = async (
  uid: string,
  fromUid: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const rootRef = ref(db);

  // Atomic multi-path update:
  // 1. Add to both friends lists
  // 2. Update request status to accepted
  // 3. Delete outgoing request (sender sees real-time update)
  await update(rootRef, {
    [`friends/${uid}/${fromUid}`]: true,
    [`friends/${fromUid}/${uid}`]: true,
    [`friendRequests/${uid}/${fromUid}/status`]: "accepted",
    [`outgoingRequests/${fromUid}/${uid}`]: null,
  });
};

/**
 * Reject a friend request (removes it entirely).
 * Also cleans up the sender's outgoing request entry.
 */
export const rejectFriendRequest = async (
  uid: string,
  fromUid: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const rootRef = ref(db);

  // Delete both the recipient's inbox entry and the sender's outbox entry
  await update(rootRef, {
    [`friendRequests/${uid}/${fromUid}`]: null,
    [`outgoingRequests/${fromUid}/${uid}`]: null,
  });
};

/**
 * Remove a friend from both friends lists.
 */
export const removeFriend = async (
  uid: string,
  friendUid: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const rootRef = ref(db);

  await update(rootRef, {
    [`friends/${uid}/${friendUid}`]: null,
    [`friends/${friendUid}/${uid}`]: null,
  });
};

/**
 * Subscribe to a user's friends list.
 * Returns an array of friend UIDs.
 */
export const subscribeFriends = (
  uid: string,
  callback: (friendUids: string[]) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const friendsRef = ref(db, `friends/${uid}`);

  return onValue(friendsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const uids = Object.keys(data);
    callback(uids);
  });
};

/**
 * Subscribe to outgoing friend requests for a user.
 * Returns a Set of UIDs that the user has sent pending requests to.
 * This subscription provides real-time updates — when the recipient
 * accepts or rejects, the callback fires immediately.
 */
export const subscribeOutgoingRequests = (
  uid: string,
  callback: (pendingTargetUids: Set<string>) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const outgoingRef = ref(db, `outgoingRequests/${uid}`);

  return onValue(outgoingRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback(new Set());
      return;
    }
    // Filter only entries with status === "pending"
    const pending = new Set<string>();
    for (const [targetUid, value] of Object.entries(data)) {
      const entry = value as { status?: string } | null;
      if (entry && entry.status === "pending") {
        pending.add(targetUid);
      }
    }
    callback(pending);
  });
};

/**
 * Subscribe to incoming friend requests for a user.
 * Returns an array of FriendRequest objects with the sender's uid.
 */
export const subscribeFriendRequests = (
  uid: string,
  callback: (requests: (FriendRequest & { uid: string })[]) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const requestsRef = ref(db, `friendRequests/${uid}`);

  return onValue(requestsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const requests: (FriendRequest & { uid: string })[] = Object.entries(data)
      .map(([fromUid, value]) => {
        const req = value as FriendRequest;
        return { ...req, uid: fromUid };
      })
      .filter((r) => r.status === "pending");
    // Sort by most recent first
    requests.sort((a, b) => b.at - a.at);
    callback(requests);
  });
};

/**
 * Subscribe to a user's online status.
 */
export const subscribeUserOnlineStatus = (
  targetUid: string,
  callback: (status: UserOnlineStatus) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const statusRef = ref(db, `usersPublic/${targetUid}/onlineStatus`);

  return onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    callback(data ?? "offline");
  });
};

/**
 * Update the current user's online status.
 */
export const updateOnlineStatus = async (
  uid: string,
  status: UserOnlineStatus,
): Promise<void> => {
  const db = getFirebaseDB();
  await update(ref(db, `usersPublic/${uid}`), { onlineStatus: status });
};

/**
 * Update the current user's public profile (nickname + displayName).
 * Creates the usersPublic entry if it doesn't exist.
 */
export const updateUserPublicProfile = async (
  uid: string,
  nickname: string,
  displayName: string | null,
): Promise<void> => {
  const db = getFirebaseDB();
  await update(ref(db, `usersPublic/${uid}`), {
    nickname,
    displayName,
  });
};

/**
 * Look up a user by their exact Firebase UID.
 * Returns the public profile if found, or null if not found.
 */
export const lookupUserByUid = async (
  uid: string,
): Promise<UserPublicProfile | null> => {
  const db = getFirebaseDB();
  const { get } = await import("firebase/database");
  const userRef = ref(db, `usersPublic/${uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.val() as {
    nickname?: string;
    displayName?: string | null;
    onlineStatus?: UserOnlineStatus;
  };

  return {
    uid,
    displayName: data.displayName ?? null,
    nickname: data.nickname ?? "",
    onlineStatus: data.onlineStatus ?? "offline",
  };
};

/**
 * Search the usersPublic index for matching users.
 * Client-side filtering on nickname and displayName.
 * Returns up to 20 results sorted by nickname.
 */
export const searchUsersPublic = async (
  searchTerm: string,
  excludeUid?: string,
): Promise<UserPublicProfile[]> => {
  const db = getFirebaseDB();
  const { get } = await import("firebase/database");
  const publicRef = ref(db, "usersPublic");
  const snapshot = await get(publicRef);

  if (!snapshot.exists()) return [];

  const data = snapshot.val() as Record<
    string,
    { nickname?: string; displayName?: string | null; onlineStatus?: UserOnlineStatus }
  >;
  const term = searchTerm.toLowerCase().trim();

  const results: UserPublicProfile[] = [];
  for (const [uid, profile] of Object.entries(data)) {
    // Exclude self
    if (excludeUid && uid === excludeUid) continue;

    const nickname = profile.nickname ?? "";
    const displayName = profile.displayName ?? "";

    // Match against nickname or displayName only (not uid — uid contains random chars causing false positives)
    if (
      nickname.toLowerCase().includes(term) ||
      displayName.toLowerCase().includes(term)
    ) {
      results.push({
        uid,
        displayName: profile.displayName ?? null,
        nickname,
        onlineStatus: profile.onlineStatus ?? "offline",
      });
    }
  }

  // Sort by nickname, then displayName
  results.sort((a, b) => {
    const aName = a.nickname || a.displayName || "";
    const bName = b.nickname || b.displayName || "";
    return aName.localeCompare(bName);
  });

  return results.slice(0, 20);
};

// --- Chat ---

/**
 * Deterministic chat ID for two participants.
 * Sorted UIDs joined by "_" — guarantees the same ID regardless of argument order.
 */
export const getChatId = (uid1: string, uid2: string): string => {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

/**
 * Update the typing status for a user in a chat.
 * Sets chats/{chatId}/typing/{uid} to true/false.
 * The false value is auto-set after a timeout on the client side.
 */
export const updateTypingStatus = async (
  chatId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> => {
  const db = getFirebaseDB();
  const typingRef = ref(db, `chats/${chatId}/typing/${uid}`);
  await set(typingRef, isTyping);
};

/**
 * Subscribe to a user's typing status in a chat.
 * Returns an unsubscribe function.
 */
export const subscribeTypingStatus = (
  chatId: string,
  uid: string,
  callback: (isTyping: boolean) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const typingRef = ref(db, `chats/${chatId}/typing/${uid}`);

  return onValue(typingRef, (snapshot) => {
    const val = snapshot.val();
    callback(val === true);
  });
};

/**
 * Send a chat message to an existing chat.
 * Creates a new push entry under chats/{chatId}/messages.
 * Also increments the recipient's unread counter atomically.
 */
export const sendMessage = async (
  chatId: string,
  fromUid: string,
  text: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const messagesRef = ref(db, `chats/${chatId}/messages`);

  const now = Date.now();
  const message: { from: string; text: string; at: number } = {
    from: fromUid,
    text,
    at: now,
  };

  // Push message
  await push(messagesRef, message);

  // Derive the recipient UID from the chatId (sorted: uid1_uid2)
  const parts = chatId.split("_");
  const toUid = parts[0] === fromUid ? parts[1] : parts[0];

  // Atomically increment unread count for the recipient
  const unreadRef = ref(db, `chats/${chatId}/unread/${toUid}`);
  try {
    await runTransaction(unreadRef, (current) => {
      return (current ?? 0) + 1;
    });
  } catch (err) {
    console.error("Failed to increment unread count:", err);
  }
};

/**
 * Subscribe to all messages in a chat.
 * Returns an array of ChatMessage objects with their push IDs.
 */
export const subscribeChatMessages = (
  chatId: string,
  callback: (messages: (ChatMessage & { id: string })[]) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const messagesRef = ref(db, `chats/${chatId}/messages`);

  return onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const messages: (ChatMessage & { id: string })[] = Object.entries(data).map(
      ([pushId, value]) => {
        const msg = value as ChatMessage;
        return { ...msg, id: pushId };
      },
    );
    messages.sort((a, b) => a.at - b.at);
    callback(messages);
  });
};

/**
 * Initialize a chat between two users (creates the participants node).
 * Idempotent — safe to call multiple times.
 */
export const initChat = async (
  chatId: string,
  uid1: string,
  uid2: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const participantsRef = ref(db, `chats/${chatId}/participants`);
  await update(participantsRef, { [uid1]: true, [uid2]: true });
};

/**
 * Mark a chat as read by resetting the unread counter for this user.
 */
export const markChatRead = async (
  chatId: string,
  uid: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const unreadRef = ref(db, `chats/${chatId}/unread/${uid}`);
  await set(unreadRef, 0);
};

/**
 * Subscribe to the unread message count for a user in a specific chat.
 * Returns an unsubscribe function.
 */
export const subscribeUnreadCount = (
  chatId: string,
  uid: string,
  callback: (count: number) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const unreadRef = ref(db, `chats/${chatId}/unread/${uid}`);

  return onValue(unreadRef, (snapshot) => {
    const val = snapshot.val();
    callback(typeof val === "number" ? val : 0);
  });
};

// --- Multiplayer Sessions ---

/**
 * Create a new multiplayer session.
 * The creator becomes the host.
 * Returns the session ID.
 */
export const createSession = async (
  hostUid: string,
  hostNickname: string,
  sessionId?: string,
): Promise<string> => {
  const db = getFirebaseDB();
  const id = sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  const session: Omit<MultiplayerSession, "participants"> & {
    participants: Record<string, { nickname: string; attention: boolean; joinedAt: number }>;
  } = {
    host: hostUid,
    status: "waiting",
    createdAt: now,
    participants: {
      [hostUid]: {
        nickname: hostNickname,
        attention: false,
        joinedAt: now,
      },
    },
  };

  await set(ref(db, `sessions/${id}`), session);
  return id;
};

/**
 * Join an existing multiplayer session.
 * Max 8 participants.
 */
export const joinSession = async (
  sessionId: string,
  uid: string,
  nickname: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const sessionRef = ref(db, `sessions/${sessionId}`);
  const { get } = await import("firebase/database");
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    throw new Error("Session not found");
  }

  const session = snapshot.val() as MultiplayerSession;
  if (session.status !== "waiting") {
    throw new Error("Session is not accepting participants");
  }

  const participantCount = Object.keys(session.participants || {}).length;
  if (participantCount >= 8) {
    throw new Error("Session is full (max 8 participants)");
  }

  const now = Date.now();
  await update(ref(db), {
    [`sessions/${sessionId}/participants/${uid}`]: {
      nickname,
      attention: false,
      joinedAt: now,
    },
  });
};

/**
 * Leave a multiplayer session.
 * If the leaving user is the host, transfers host to the next participant.
 * If no participants remain, deletes the session.
 */
export const leaveSession = async (
  sessionId: string,
  uid: string,
): Promise<void> => {
  const db = getFirebaseDB();
  const { get } = await import("firebase/database");
  const sessionRef = ref(db, `sessions/${sessionId}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) return;

  const session = snapshot.val() as MultiplayerSession;
  const participantUids = Object.keys(session.participants || {});

  if (uid === session.host) {
    // Host is leaving — transfer host or delete session
    const remaining = participantUids.filter((puid) => puid !== uid);
    if (remaining.length === 0) {
      // No participants left — delete the session
      await set(sessionRef, null);
      return;
    }
    // Transfer host to the next participant
    const newHost = remaining[0];
    await update(ref(db), {
      [`sessions/${sessionId}/host`]: newHost,
      [`sessions/${sessionId}/participants/${uid}`]: null,
    });
  } else {
    // Non-host leaving — just remove
    await set(ref(db, `sessions/${sessionId}/participants/${uid}`), null);
  }
};

/**
 * Subscribe to a specific session's data in real-time.
 */
export const subscribeSession = (
  sessionId: string,
  callback: (session: MultiplayerSession | null) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const sessionRef = ref(db, `sessions/${sessionId}`);

  return onValue(sessionRef, (snapshot) => {
    const data = snapshot.val() as MultiplayerSession | null;
    callback(data);
  });
};

/**
 * Set the session status (e.g., "waiting" → "playing" → "ended").
 */
export const setSessionStatus = async (
  sessionId: string,
  status: SessionStatus,
): Promise<void> => {
  const db = getFirebaseDB();
  await set(ref(db, `sessions/${sessionId}/status`), status);
};

/**
 * Update the attention status of a participant in a session.
 */
export const updateSessionAttention = async (
  sessionId: string,
  uid: string,
  attention: boolean,
): Promise<void> => {
  const db = getFirebaseDB();
  await set(ref(db, `sessions/${sessionId}/participants/${uid}/attention`), attention);
};

/**
 * Subscribe to all sessions a user is participating in.
 * Returns a subscription that provides session IDs the user belongs to.
 * Note: This reads the sessions collection (client-side filter).
 */
export const subscribeMySessions = (
  uid: string,
  callback: (sessionIds: string[]) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const sessionsRef = ref(db, "sessions");

  return onValue(sessionsRef, (snapshot) => {
    const data = snapshot.val() as Record<string, MultiplayerSession> | null;
    if (!data) {
      callback([]);
      return;
    }
    const sessionIds: string[] = [];
    for (const [sessionId, session] of Object.entries(data)) {
      if (session.participants && session.participants[uid]) {
        sessionIds.push(sessionId);
      }
    }
    callback(sessionIds);
  });
};

// --- Wall data migration (users/{uid} → walls/{uid}) ---

/**
 * One-time migration: copy existing failure/success data from the old
 * `users/{uid}/failures` and `users/{uid}/successes` paths to the new
 * `walls/{uid}/failures` and `walls/{uid}/successes` paths.
 *
 * This is needed because the `users/$key/.read` security rule blocks
 * friend access at the parent level, so failures/successes were moved
 * to a top-level `walls/{uid}` path with its own friend-friendly .read rule.
 *
 * The migration only runs if the NEW path is empty and the OLD path has data.
 * Idempotent — safe to call multiple times.
 */
export const migrateWallData = async (uid: string): Promise<void> => {
  const db = getFirebaseDB();
  const { get } = await import("firebase/database");

  // Check old paths
  const oldFailuresRef = ref(db, `users/${uid}/failures`);
  const oldSuccessesRef = ref(db, `users/${uid}/successes`);
  // Check new paths
  const newFailuresRef = ref(db, `walls/${uid}/failures`);
  const newSuccessesRef = ref(db, `walls/${uid}/successes`);

  const [oldFailSnap, oldSuccSnap, newFailSnap, newSuccSnap] = await Promise.all([
    get(oldFailuresRef),
    get(oldSuccessesRef),
    get(newFailuresRef),
    get(newSuccessesRef),
  ]);

  const updates: Record<string, unknown> = {};

  // Migrate failures if old has data and new is empty
  if (oldFailSnap.exists() && !newFailSnap.exists()) {
    const oldData = oldFailSnap.val();
    for (const [pushId, value] of Object.entries(oldData)) {
      updates[`walls/${uid}/failures/${pushId}`] = value;
    }
  }

  // Migrate successes if old has data and new is empty
  if (oldSuccSnap.exists() && !newSuccSnap.exists()) {
    const oldData = oldSuccSnap.val();
    for (const [pushId, value] of Object.entries(oldData)) {
      updates[`walls/${uid}/successes/${pushId}`] = value;
    }
  }

  if (Object.keys(updates).length === 0) return;

  const rootRef = ref(db);
  await update(rootRef, updates);
  console.log(`Wall data migration: copied ${Object.keys(updates).length} records from users/${uid} to walls/${uid}`);
};

// --- Success Records (debug / Firebase sync) ---

/**
 * Save a success record to RTDB under `walls/{uid}/successes`.
 * Uses push() to create a new entry with an auto-generated key.
 */
export const saveSuccessRecord = async (
  uid: string,
  record: SuccessRecord,
): Promise<void> => {
  const db = getFirebaseDB();
  const successesRef = ref(db, `walls/${uid}/successes`);
  await push(successesRef, record);
};

/**
 * Subscribe to success records in RTDB.
 * Calls callback with an array of SuccessRecord every time data changes.
 * Returns an unsubscribe function.
 */
/**
 * Check if a user is currently in an active multiplayer session.
 * Uses subscribeMySessions and returns true if any waiting/playing session exists.
 */
export const checkHasActiveSession = async (uid: string): Promise<boolean> => {
  const db = getFirebaseDB();
  const { get } = await import("firebase/database");
  const snapshot = await get(ref(db, "sessions"));
  if (!snapshot.exists()) return false;

  const data = snapshot.val() as Record<string, MultiplayerSession>;
  for (const session of Object.values(data)) {
    if (
      session.participants &&
      session.participants[uid] &&
      (session.status === "waiting" || session.status === "playing")
    ) {
      return true;
    }
  }
  return false;
};

export const subscribeSuccesses = (
  uid: string,
  callback: (records: SuccessRecord[]) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const successesRef = ref(db, `walls/${uid}/successes`);

  return onValue(successesRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const records: SuccessRecord[] = Object.entries(data).map(([pushId, value]) => {
      const record = value as SuccessRecord;
      return { ...record, id: record.id || pushId };
    });
    records.sort((a, b) => b.completedAt - a.completedAt);
    callback(records);
  });
};
