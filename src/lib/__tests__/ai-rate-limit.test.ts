import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase-admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

describe("consumeAIRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T17:00:00.000Z"));
    getAdminFirestoreMock.mockReset();
    getAdminFirestoreMock.mockReturnValue(null);
  });

  afterEach(async () => {
    const { resetAIRateLimitMemoryStore } = await import("../ai-rate-limit");
    resetAIRateLimitMemoryStore();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("allows requests until the chat limit is reached", async () => {
    const { consumeAIRateLimit } = await import("../ai-rate-limit");

    let latestResult;
    for (let requestNumber = 0; requestNumber < 12; requestNumber += 1) {
      latestResult = await consumeAIRateLimit({
        endpoint: "chat",
        userId: "user-123",
      });
      expect(latestResult.allowed).toBe(true);
    }

    expect(latestResult?.remaining).toBe(0);

    const blockedResult = await consumeAIRateLimit({
      endpoint: "chat",
      userId: "user-123",
    });

    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0);
    expect(blockedResult.store).toBe("memory");
  });

  it("resets the window after enough time has passed", async () => {
    const { consumeAIRateLimit } = await import("../ai-rate-limit");

    for (let requestNumber = 0; requestNumber < 12; requestNumber += 1) {
      await consumeAIRateLimit({
        endpoint: "chat",
        userId: "user-456",
      });
    }

    const blockedResult = await consumeAIRateLimit({
      endpoint: "chat",
      userId: "user-456",
    });
    expect(blockedResult.allowed).toBe(false);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const resetResult = await consumeAIRateLimit({
      endpoint: "chat",
      userId: "user-456",
    });

    expect(resetResult.allowed).toBe(true);
    expect(resetResult.remaining).toBe(11);
  });

  it("falls back to memory if Firestore consumption fails", async () => {
    getAdminFirestoreMock.mockReturnValue({
      collection: () => ({
        doc: () => ({ id: "rate-limit-doc" }),
      }),
      runTransaction: vi.fn().mockRejectedValue(new Error("Firestore unavailable")),
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { consumeAIRateLimit } = await import("../ai-rate-limit");
    const result = await consumeAIRateLimit({
      endpoint: "lookup",
      userId: "user-789",
    });

    expect(result.allowed).toBe(true);
    expect(result.store).toBe("memory");
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
