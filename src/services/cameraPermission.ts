import type { CameraConsent } from "../state/useUIStore";

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

/**
 * The browser's own camera permission for this origin.
 *
 * Firefox and older Safari do not expose the `camera` descriptor and throw on
 * query — those report `"unknown"`, and callers fall back to the stored
 * consent instead.
 */
export const getCameraPermissionState =
  async (): Promise<CameraPermissionState> => {
    if (!navigator.permissions?.query) return "unknown";
    try {
      const status = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      return status.state as CameraPermissionState;
    } catch {
      return "unknown";
    }
  };

/**
 * Whether the consent screen has to be shown before the game can run.
 *
 * Two independent gates guard the camera: our own UI consent (persisted in
 * RTDB, therefore shared by every device of the account) and the browser
 * permission (per browser, and revocable at any time). Trusting the stored
 * consent alone is what let a fresh browser — or a revoked permission — walk
 * past the consent screen and then fail silently at mission launch.
 */
export const needsCameraConsent = async (
  consent: CameraConsent,
): Promise<boolean> => {
  if (consent !== "granted") return true;
  const state = await getCameraPermissionState();
  return state === "denied" || state === "prompt";
};
