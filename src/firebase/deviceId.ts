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

/* clearDeviceId was removed in 009 — the old guest→Google migration flow
 * that rotated the deviceId has been replaced with an idempotent migratedFrom
 * guard that does not require rotation (see authBootstrap.ts). */
