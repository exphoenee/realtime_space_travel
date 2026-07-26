import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "firebase/auth";

// Mock deviceId BEFORE importing
vi.mock("../firebase/deviceId", () => ({
  getDeviceId: () => "mock-device-id",
}));

import useAuthStore, { selectRtdbKey, getRtdbKey } from "./useAuthStore";

const createMockUser = (
  uid: string,
  isAnonymous: boolean,
): Partial<User> =>
  ({ uid, isAnonymous }) as unknown as User;

beforeEach(() => {
  // Reset the store to initial state between tests
  useAuthStore.setState({
    user: null,
    status: "loading",
    _initialized: false,
    displayName: null,
    isAnonymous: true,
    uid: null,
    deviceId: "mock-device-id",
    authError: null,
    nickname: "",
    nicknameLoaded: false,
  });
});

describe("selectRtdbKey (derived RTDB key invariant)", () => {
  it("returns deviceId for anonymous user", () => {
    const anonUser = createMockUser("anon-123", true);
    useAuthStore.getState().setUser(anonUser as User);

    const key = selectRtdbKey(useAuthStore.getState());
    expect(key).toBe("mock-device-id");
  });

  it("returns user.uid for Google (non-anonymous) user", () => {
    const googleUser = createMockUser("google-uid-456", false);
    useAuthStore.getState().setUser(googleUser as User);

    const key = selectRtdbKey(useAuthStore.getState());
    expect(key).toBe("google-uid-456");
  });

  it("returns deviceId when user is null (signed out)", () => {
    useAuthStore.getState().setUser(null);

    const key = selectRtdbKey(useAuthStore.getState());
    expect(key).toBe("mock-device-id");
  });

  it("setDeviceId does NOT affect the key for non-anonymous users", () => {
    const googleUser = createMockUser("google-uid-789", false);
    useAuthStore.getState().setUser(googleUser as User);
    useAuthStore.getState().setDeviceId("new-device-xyz");

    const key = selectRtdbKey(useAuthStore.getState());
    // Must still be the uid, NOT the new deviceId
    expect(key).toBe("google-uid-789");
  });

  it("getRtdbKey returns user.uid for Google user (non-React call site)", () => {
    const googleUser = createMockUser("google-uid-999", false);
    useAuthStore.getState().setUser(googleUser as User);

    expect(getRtdbKey()).toBe("google-uid-999");
  });

  it("setRtdbKey action does NOT exist in the store", () => {
    const state = useAuthStore.getState() as unknown;
    const stateRecord = state as Record<string, unknown>;
    expect("setRtdbKey" in stateRecord).toBe(false);
    expect((stateRecord as any).rtdbKey).toBeUndefined();
  });
});
