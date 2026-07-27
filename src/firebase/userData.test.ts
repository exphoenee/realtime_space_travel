import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — use vi.hoisted() to define variables the factory can reference
const { mockRef, mockGet, mockUpdate, mockSet } = vi.hoisted(() => ({
  mockRef: vi.fn((_db: unknown, path?: string) => ({ path: path ?? "" })),
  mockGet: vi.fn(),
  mockUpdate: vi.fn(async () => {}),
  mockSet: vi.fn(async () => {}),
}));

vi.mock("firebase/database", () => ({
  ref: mockRef,
  get: mockGet,
  update: mockUpdate,
  set: mockSet,
  onValue: vi.fn(),
  runTransaction: vi.fn(async (ref: unknown, updater: (current: number) => number) => {
    const result = updater(2000);
    return { snapshot: { val: () => result } };
  }),
}));

vi.mock("./config", () => ({
  getFirebaseDB: () => ({ name: "mockDb" }),
}));

import { migrateGuestData, ensureUserNode, incrementUserWallet, type MergeResult } from "./userData";
import type { User } from "firebase/auth";

const createMockUser = (overrides: Partial<User> = {}): User =>
  ({
    uid: "test-uid-123",
    isAnonymous: false,
    displayName: "Test User",
    email: "test@example.com",
    photoURL: "https://example.com/photo.jpg",
    ...overrides,
  }) as unknown as User;

beforeEach(() => {
  vi.clearAllMocks();
});

/** Extract all update arguments as [ref, updates] tuples. */
function getAllUpdateCalls(): Array<[{ path: string }, Record<string, unknown>]> {
  return mockUpdate.mock.calls.map((call: unknown) => {
    const args = call as [unknown, unknown];
    return [
      args[0] as { path: string },
      (args[1] ?? {}) as Record<string, unknown>,
    ];
  });
}

/** Find the first root-level update call and return its updates object. */
function getRootUpdates(): Record<string, unknown> | null {
  for (const [ref, updates] of getAllUpdateCalls()) {
    if (ref.path === "") return updates;
  }
  return null;
}

/** Find the first user-level update call for a given uid. */
function getUserUpdates(uid: string): Record<string, unknown> | null {
  for (const [ref, updates] of getAllUpdateCalls()) {
    if (ref.path === `users/${uid}`) return updates;
  }
  return null;
}

describe("migrateGuestData", () => {
  it("returns noop if deviceId === targetUid", async () => {
    const result: MergeResult = await migrateGuestData("same-id", "same-id");
    expect(result).toEqual({ kind: "noop" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns noop if guest node does not exist", async () => {
    mockGet.mockResolvedValue({ exists: () => false });
    const result: MergeResult = await migrateGuestData("guest-abc", "target-123");
    expect(result).toEqual({ kind: "noop" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not crash on missing wallet in guest data (regression for old line 176)", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: { nickname: "GuestPlayer" },
          inventory: { ships: {}, music: {}, exoplanets: {} },
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          wallet: { credits: 100 },
          profile: {},
        }),
      });

    await expect(
      migrateGuestData("guest-abc", "target-123"),
    ).resolves.not.toThrow();
  });

  it("does not crash on missing profile in guest data", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          inventory: { ships: { s1: true } },
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          wallet: { credits: 100 },
          profile: {},
        }),
      });

    await expect(
      migrateGuestData("guest-abc", "target-123"),
    ).resolves.not.toThrow();
  });

  it("calls root update with guestMergeClaimed mark (not migratedFrom)", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 50 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ profile: {}, wallet: { credits: 100 }, inventory: {} }),
      });

    await migrateGuestData("guest-abc", "target-123");

    const updates = getRootUpdates();
    expect(updates).not.toBeNull();
    // NEW: uses guestMergeClaimed instead of migratedFrom
    expect(updates!["users/target-123/profile/guestMergeClaimed"]).toBe(
      true,
    );
  });

  it("adds credits on first merge (target + guest)", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 2000 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ profile: {}, wallet: { credits: 500 }, inventory: {} }),
      });

    const result: MergeResult = await migrateGuestData("guest-abc", "target-123");

    expect(result).toEqual({ kind: "merged", addedCredits: 2000 });
    const updates = getRootUpdates();
    expect(updates!["users/target-123/wallet/credits"]).toBe(2500); // 500 + 2000
  });

  it("unions inventory", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          inventory: { ships: { s1: true } },
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: {},
          wallet: { credits: 0 },
          inventory: { ships: { s2: true } },
        }),
      });

    await migrateGuestData("guest-abc", "target-123");

    const updates = getRootUpdates();
    expect(updates).not.toBeNull();
    expect(updates!["users/target-123/inventory/ships/s1"]).toBe(true);
  });

  it("does not contain undefined values in updates", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 100 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: {},
          wallet: { credits: 200 },
          inventory: {},
        }),
      });

    await migrateGuestData("guest-abc", "target-123");

    const updates = getRootUpdates();
    expect(updates).not.toBeNull();
    const values = Object.values(updates!);
    expect(values.every((v) => v !== undefined)).toBe(true);
  });

  it("returns blocked when guestMergeClaimed is already set", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 2000 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: { guestMergeClaimed: true },
          wallet: { credits: 500 },
          inventory: {},
        }),
      });

    const result: MergeResult = await migrateGuestData("guest-abc", "target-123");
    expect(result).toEqual({ kind: "blocked" });
  });

  it("returns blocked when legacy migratedFrom has entries", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 2000 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: { migratedFrom: { x: true } },
          wallet: { credits: 500 },
          inventory: {},
        }),
      });

    const result: MergeResult = await migrateGuestData("guest-abc", "target-123");
    expect(result).toEqual({ kind: "blocked" });
  });

  it("cleans up device_map in blocked branch", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 100 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: { guestMergeClaimed: true },
          wallet: { credits: 0 },
          inventory: {},
        }),
      });

    await migrateGuestData("guest-abc", "target-123");

    const updates = getRootUpdates();
    expect(updates).not.toBeNull();
    expect(updates!["device_map/guest-abc"]).toBeNull();
  });

  it("cleans up device_map in merged branch", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 100 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ profile: {}, wallet: { credits: 0 }, inventory: {} }),
      });

    await migrateGuestData("guest-abc", "target-123");

    const updates = getRootUpdates();
    expect(updates).not.toBeNull();
    expect(updates!["device_map/guest-abc"]).toBeNull();
  });

  it("audits orphanDiscardedCredits in blocked branch", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({ wallet: { credits: 2000 }, inventory: {} }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        val: () => ({
          profile: { guestMergeClaimed: true },
          wallet: { credits: 0 },
          inventory: {},
        }),
      });

    await migrateGuestData("guest-abc", "target-123");

    const updates = getRootUpdates();
    expect(updates).not.toBeNull();
    expect(updates!["users/target-123/profile/orphanDiscardedCredits/guest-abc"]).toBe(2000);
  });
});

describe("incrementUserWallet", () => {
  it("adds delta to existing credits", async () => {
    // runTransaction updater: 2000 + 2000 = 4000
    const { runTransaction } = await import("firebase/database");
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (_ref: unknown, updater: (current: number) => number) => {
        const result = updater(2000);
        return { snapshot: { val: () => result } };
      },
    );

    const result = await incrementUserWallet("test-uid", 2000);
    expect(result).toBe(4000);
  });

  it("handles null/undefined by treating as 0", async () => {
    const { runTransaction } = await import("firebase/database");
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (_ref: unknown, updater: (current: number) => number) => {
        const result = updater(null as unknown as number);
        return { snapshot: { val: () => result } };
      },
    );

    const result = await incrementUserWallet("test-uid", 300);
    expect(result).toBe(300);
  });

  it("adds to zero balance", async () => {
    const { runTransaction } = await import("firebase/database");
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (_ref: unknown, updater: (current: number) => number) => {
        const result = updater(0);
        return { snapshot: { val: () => result } };
      },
    );

    const result = await incrementUserWallet("test-uid", 2000);
    expect(result).toBe(2000);
  });
});

describe("ensureUserNode", () => {
  it("writes createdAt when missing on exists branch", async () => {
    const mockUser = createMockUser();
    mockGet.mockResolvedValue({
      exists: () => true,
      val: () => ({
        profile: {
          displayName: "Old",
          provider: "google",
          isAnonymous: false,
          lastLoginAt: 1000,
        },
      }),
    });

    await ensureUserNode(mockUser, "google", "test-uid");

    const updates = getUserUpdates("test-uid");
    expect(updates).not.toBeNull();
    expect(updates!["profile/createdAt"]).toBeDefined();
  });

  it("does not overwrite existing createdAt", async () => {
    const mockUser = createMockUser();
    mockGet.mockResolvedValue({
      exists: () => true,
      val: () => ({
        profile: {
          displayName: "Old",
          provider: "google",
          isAnonymous: false,
          createdAt: 123456789,
          lastLoginAt: 1000,
        },
      }),
    });

    await ensureUserNode(mockUser, "google", "test-uid");

    const updates = getUserUpdates("test-uid");
    expect(updates).not.toBeNull();
    expect(updates!["profile/createdAt"]).toBeUndefined();
  });

  it("skips wallet seed when seedWallet=false", async () => {
    const mockUser = createMockUser();
    mockGet.mockResolvedValue({
      exists: () => false,
      val: () => null,
    });

    await ensureUserNode(mockUser, "google", "test-uid", {
      seedWallet: false,
    });

    const updates = getUserUpdates("test-uid");
    expect(updates).not.toBeNull();
    expect(updates!.wallet).toBeUndefined();
  });

  it("writes wallet when seedWallet=true (default)", async () => {
    const mockUser = createMockUser();
    mockGet.mockResolvedValue({
      exists: () => false,
      val: () => null,
    });

    await ensureUserNode(mockUser, "google", "test-uid");

    const updates = getUserUpdates("test-uid");
    expect(updates).not.toBeNull();
    expect(updates!.wallet).toBeDefined();
    expect((updates!.wallet as { credits: number }).credits).toBeTypeOf(
      "number",
    );
  });
});
