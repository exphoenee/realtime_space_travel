/**
 * Device-based guest identity.
 *
 * Generates a UUID on first visit and persists it in localStorage so the same
 * guest identity survives page reloads, sign-out, and browser restarts (as long
 * as localStorage is not cleared).
 *
 * This UUID is used as the stable key for the user's RTDB node (`users/{deviceId}`)
 * and is mapped to the current Firebase auth UID via `device_map/{deviceId}` in
 * the security rules.
 */

const DEVICE_ID_KEY = "realtime_space_travel_device_id";

/** Read or create the persistent device ID. */
export const getDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

/**
 * Clear the device ID entirely from localStorage, then generate a brand-new
 * UUID and persist it. Call this after a successful guest → Google migration
 * so the old deviceId can never be reused for a new guest session.
 *
 * The old guest RTDB node at users/{oldId} and the device_map/{oldId} entry
 * have already been deleted by migrateGuestData — this finalises the cleanup
 * on the client side.
 *
 * Returns the new device ID.
 */
export const clearDeviceId = (): string => {
  // Explicitly remove the old key first, then generate + persist a new one.
  localStorage.removeItem(DEVICE_ID_KEY);
  const newId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
};
