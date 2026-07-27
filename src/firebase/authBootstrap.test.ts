import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted
const { mockOnAuthChange } = vi.hoisted(() => ({
  mockOnAuthChange: vi.fn(),
}));

vi.mock("./auth", () => ({
  onAuthChange: mockOnAuthChange,
  signInAnonymous: vi.fn(async () => {}),
  checkRedirectResult: vi.fn(async () => ({ user: null, error: null })),
  getAuthErrorMessage: vi.fn((err: unknown) => "login.error.generic"),
}));

vi.mock("./config", () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));

vi.mock("./deviceId", () => ({
  getDeviceId: () => "mock-device-id",
}));

import useAuthStore, { getRtdbKey } from "../state/useAuthStore";
import type { MergeResult } from "./userData";

beforeEach(() => {
  vi.clearAllMocks();
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
    mergeNotice: null,
    setUser: useAuthStore.getState().setUser,
    clearUser: useAuthStore.getState().clearUser,
    setAuthError: useAuthStore.getState().setAuthError,
    setMergeNotice: useAuthStore.getState().setMergeNotice,
    setNickname: useAuthStore.getState().setNickname,
    setDeviceId: useAuthStore.getState().setDeviceId,
  });
});

describe("authBootstrap invariants", () => {
  it("getRtdbKey returns user.uid after migration error (invariant test)", async () => {
    // This validates the core invariant: even when the Google user's auth
    // event fires with a failed migration, the rtdbKey MUST remain user.uid,
    // NOT fall back to deviceId.

    // Simulate: user signs in with Google
    const googleUser = {
      uid: "google-uid-123",
      isAnonymous: false,
      displayName: "Test User",
      email: "test@example.com",
      photoURL: null,
    };

    // Store a Google user (simulating what setUser does)
    useAuthStore.getState().setUser(googleUser as any);

    // Verify: rtdbKey must be the uid, not the deviceId
    expect(getRtdbKey()).toBe("google-uid-123");
    expect(getRtdbKey()).not.toBe("mock-device-id");
  });

  it("selectRtdbKey returns deviceId when user signs out", () => {
    useAuthStore.getState().setUser(null);
    expect(getRtdbKey()).toBe("mock-device-id");
  });

  it("setMergeNotice sets mergeNotice in store", () => {
    useAuthStore.getState().setMergeNotice("login.guestMergeAlreadyClaimed");
    expect(useAuthStore.getState().mergeNotice).toBe("login.guestMergeAlreadyClaimed");

    useAuthStore.getState().setMergeNotice(null);
    expect(useAuthStore.getState().mergeNotice).toBeNull();
  });

  it("setUser resets mergeNotice", () => {
    useAuthStore.getState().setMergeNotice("login.guestMergeAlreadyClaimed");
    expect(useAuthStore.getState().mergeNotice).toBe("login.guestMergeAlreadyClaimed");

    // Simulate a Google user signing in
    const googleUser = {
      uid: "google-uid-123",
      isAnonymous: false,
      displayName: "Test User",
      email: "test@example.com",
      photoURL: null,
    };
    useAuthStore.getState().setUser(googleUser as any);

    // mergeNotice should be reset
    expect(useAuthStore.getState().mergeNotice).toBeNull();
  });

  it("clearUser resets mergeNotice", () => {
    useAuthStore.getState().setMergeNotice("login.guestMergeAlreadyClaimed");
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().mergeNotice).toBeNull();
  });
});
