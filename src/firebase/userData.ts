import { ref, onValue, update, set, type Unsubscribe, type DatabaseReference } from "firebase/database";
import { getFirebaseDB } from "./config";
import type { User } from "firebase/auth";

/** Default user data for first-time users. */
export interface UserNode {
  profile: {
    displayName: string;
    photoURL: string | null;
    provider: "anonymous" | "google";
    isAnonymous: boolean;
    createdAt: number;
    lastLoginAt: number;
  };
  settings: {
    activeShipId: string | null;
    activeMusicId: string | null;
    musicMuted: boolean;
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
  },
  settings: {
    activeShipId: null,
    activeMusicId: null,
    musicMuted: false,
    language: navigator.language?.split("-")[0] ?? "en",
  },
  wallet: {
    credits: 0,
  },
  inventory: {
    ships: {},
    music: {},
    exoplanets: {},
  },
  stats: {
    bestServiceSeconds: 0,
  },
});

/**
 * Ensure the user node exists in RTDB.
 * If missing, creates it with defaults (idempotent).
 */
export const ensureUserNode = async (user: User, provider: "anonymous" | "google"): Promise<void> => {
  const db = getFirebaseDB();
  const userRef = ref(db, `users/${user.uid}`);

  // Check if node exists
  const { get } = await import("firebase/database");
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    // Update lastLoginAt
    await update(userRef, {
      "profile/lastLoginAt": Date.now(),
    });
    return;
  }

  // Create default node
  const defaults = getDefaultUserNode(user, provider);
  await set(userRef, defaults);
};

/**
 * Subscribe to a user's data in RTDB.
 * Calls callback every time the data changes.
 * Returns an unsubscribe function.
 */
export const subscribeUser = (
  uid: string,
  callback: (data: UserNode | null) => void,
): Unsubscribe => {
  const db = getFirebaseDB();
  const userRef = ref(db, `users/${uid}`);

  return onValue(
    userRef,
    (snapshot) => {
      const data = snapshot.val();
      callback(data as UserNode | null);
    },
    (error) => {
      console.error("Firebase subscribe error:", error);
      callback(null);
    },
  );
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
