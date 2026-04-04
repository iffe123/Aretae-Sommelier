import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const getAppsMock = vi.fn();
const initializeAppMock = vi.fn();
const certMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const getAuthMock = vi.fn();
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

vi.mock("firebase-admin/app", () => ({
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
  cert: certMock,
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: getAuthMock,
}));

async function loadFirebaseAdminModule() {
  vi.resetModules();
  return import("../firebase-admin");
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  getAppsMock.mockReset();
  initializeAppMock.mockReset();
  certMock.mockReset();
  verifyIdTokenMock.mockReset();
  getAuthMock.mockReset();

  getAppsMock.mockReturnValue([]);
  initializeAppMock.mockReturnValue({ name: "mock-admin-app" });
  certMock.mockImplementation((value) => value);
  getAuthMock.mockReturnValue({
    verifyIdToken: verifyIdTokenMock,
  });
  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  consoleWarnSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("verifyIdToken", () => {
  it("uses Firebase Auth REST fallback when no service account key is configured", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-web-api-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [{ localId: "rest-user-123" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { verifyIdToken } = await loadFirebaseAdminModule();

    await expect(verifyIdToken("fresh-id-token")).resolves.toEqual({
      uid: "rest-user-123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-web-api-key",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
      })
    );
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it("falls back to Firebase Auth REST lookup when admin verification fails", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      project_id: "demo-project",
      private_key: "fake-key",
      client_email: "demo@example.com",
    });
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-web-api-key";

    verifyIdTokenMock.mockRejectedValueOnce(
      new Error("Firebase ID token has incorrect \"aud\" claim.")
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [{ localId: "rest-user-456" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { verifyIdToken } = await loadFirebaseAdminModule();

    await expect(verifyIdToken("fresh-id-token")).resolves.toEqual({
      uid: "rest-user-456",
    });
    expect(verifyIdTokenMock).toHaveBeenCalledWith("fresh-id-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a configuration error when neither admin nor REST fallback credentials exist", async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const { verifyIdToken } = await loadFirebaseAdminModule();

    await expect(verifyIdToken("fresh-id-token")).rejects.toThrow(
      "NEXT_PUBLIC_FIREBASE_API_KEY"
    );
  });

  it("surfaces invalid token errors from the REST fallback", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-web-api-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "INVALID_ID_TOKEN" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { verifyIdToken } = await loadFirebaseAdminModule();

    await expect(verifyIdToken("bad-token")).rejects.toThrow("INVALID_ID_TOKEN");
  });
});
