import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const deleteAccountMock = vi.hoisted(() => vi.fn());
const createDepsMock = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/lib/api-auth", () => ({ authenticateRequest: authMock }));
vi.mock("@/lib/account-deletion", async () => {
  class AccountDeletionConfigError extends Error {}
  return {
    AccountDeletionConfigError,
    deleteAccount: deleteAccountMock,
    createFirebaseAccountDeletionDeps: createDepsMock,
  };
});

import { DELETE } from "../account/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ uid: "user-1" });
    deleteAccountMock.mockResolvedValue({ winesDeleted: 2 });
  });

  it("returns the auth failure response unchanged", async () => {
    authMock.mockResolvedValue(NextResponse.json({ error: "nope" }, { status: 401 }));
    const response = await DELETE(request({ confirm: "DELETE" }));
    expect(response.status).toBe(401);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation", async () => {
    const response = await DELETE(request({}));
    expect(response.status).toBe(400);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("deletes the signed-in user's account", async () => {
    const response = await DELETE(request({ confirm: "DELETE" }));
    expect(response.status).toBe(200);
    expect(deleteAccountMock).toHaveBeenCalledWith("user-1", {});
    await expect(response.json()).resolves.toEqual({ success: true, data: { winesDeleted: 2 } });
  });

  it("returns 500 without leaking details when deletion fails", async () => {
    deleteAccountMock.mockRejectedValue(new Error("storage exploded"));
    const response = await DELETE(request({ confirm: "DELETE" }));
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).not.toContain("storage exploded");
  });
});
