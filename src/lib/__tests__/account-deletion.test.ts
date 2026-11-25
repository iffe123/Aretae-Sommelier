import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: vi.fn(() => null),
  getAdminFirestore: vi.fn(() => null),
  getAdminStorageBucket: vi.fn(() => null),
}));

import {
  AccountDeletionConfigError,
  createFirebaseAccountDeletionDeps,
  deleteAccount,
  type AccountDeletionDeps,
} from "../account-deletion";

function makeDeps(overrides: Partial<AccountDeletionDeps> = {}) {
  const calls: string[] = [];
  const deps: AccountDeletionDeps = {
    deleteWines: vi.fn(async () => {
      calls.push("wines");
      return 3;
    }),
    deletePhotos: vi.fn(async () => {
      calls.push("photos");
    }),
    deleteRateLimitRecords: vi.fn(async () => {
      calls.push("rateLimits");
    }),
    deleteAuthUser: vi.fn(async () => {
      calls.push("auth");
    }),
    ...overrides,
  };
  return { deps, calls };
}

describe("deleteAccount", () => {
  it("deletes all user data and the auth user last", async () => {
    const { deps, calls } = makeDeps();
    const result = await deleteAccount("user-1", deps);

    expect(result).toEqual({ winesDeleted: 3 });
    expect(calls).toEqual(["wines", "photos", "rateLimits", "auth"]);
    expect(deps.deleteWines).toHaveBeenCalledWith("user-1");
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("user-1");
  });

  it("does not delete the auth user if a data step fails", async () => {
    const { deps } = makeDeps({
      deletePhotos: vi.fn(async () => {
        throw new Error("storage down");
      }),
    });

    await expect(deleteAccount("user-1", deps)).rejects.toThrow("storage down");
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("rejects an empty user id", async () => {
    const { deps } = makeDeps();
    await expect(deleteAccount("", deps)).rejects.toThrow();
    expect(deps.deleteWines).not.toHaveBeenCalled();
  });
});

describe("createFirebaseAccountDeletionDeps", () => {
  it("throws a config error when Firebase Admin is not configured", () => {
    expect(() => createFirebaseAccountDeletionDeps()).toThrow(AccountDeletionConfigError);
  });
});
