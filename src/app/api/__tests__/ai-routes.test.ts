import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";

const authMock = vi.hoisted(() => vi.fn());
const generateSommelierReplyMock = vi.hoisted(() => vi.fn());
const lookupWineDetailsMock = vi.hoisted(() => vi.fn());
const analyzeWineLabelImageMock = vi.hoisted(() => vi.fn());
const estimateDrinkingWindowMock = vi.hoisted(() => vi.fn());
const isAIConfigurationErrorMock = vi.hoisted(() => vi.fn());
const isAIRateLimitErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: authMock,
}));

vi.mock("@/lib/ai-service", () => ({
  generateSommelierReply: generateSommelierReplyMock,
  lookupWineDetails: lookupWineDetailsMock,
  analyzeWineLabelImage: analyzeWineLabelImageMock,
  estimateDrinkingWindow: estimateDrinkingWindowMock,
  isAIConfigurationError: isAIConfigurationErrorMock,
  isAIRateLimitError: isAIRateLimitErrorMock,
}));

function createJsonRequest(url: string, body: string | object) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json();
}

describe("AI API routes", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    authMock.mockResolvedValue({ uid: "user-123" });
    isAIConfigurationErrorMock.mockReturnValue(false);
    isAIRateLimitErrorMock.mockReturnValue(false);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.resetModules();
  });

  describe("/api/chat", () => {
    it("passes through auth failures unchanged", async () => {
      const authResponse = NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
      authMock.mockResolvedValueOnce(authResponse);

      const { POST } = await import("@/app/api/chat/route");
      const response = await POST(
        createJsonRequest("/api/chat", { message: "Hello" })
      );

      expect(response.status).toBe(401);
      expect(await readJson(response)).toEqual({
        error: "Invalid or expired token",
      });
      expect(generateSommelierReplyMock).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON", async () => {
      const { POST } = await import("@/app/api/chat/route");
      const response = await POST(createJsonRequest("/api/chat", "{"));

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({
        error: "Invalid request body",
      });
    });

    it("returns 400 when message is missing", async () => {
      const { POST } = await import("@/app/api/chat/route");
      const response = await POST(createJsonRequest("/api/chat", {}));

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({
        error: "Message is required",
      });
    });

    it("returns the chat response and provider metadata", async () => {
      generateSommelierReplyMock.mockResolvedValueOnce({
        data: "Open the Barolo tonight.",
        provider: "gateway",
      });

      const { POST } = await import("@/app/api/chat/route");
      const requestBody = {
        message: "What should I open tonight?",
        wineContext: { name: "Ocello", vintage: 2021 },
        conversationHistory: [{ role: "user", content: "I like Nebbiolo." }],
        cellarData: { wines: [], totalBottles: 0, totalValue: 0 },
      };
      const response = await POST(createJsonRequest("/api/chat", requestBody));

      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({
        response: "Open the Barolo tonight.",
        meta: {
          provider: "gateway",
        },
      });
      expect(generateSommelierReplyMock).toHaveBeenCalledWith(
        "What should I open tonight?",
        {
          wineContext: requestBody.wineContext,
          conversationHistory: requestBody.conversationHistory,
          cellarData: requestBody.cellarData,
          userId: "user-123",
        }
      );
    });

    it("maps AI configuration errors to 500", async () => {
      const error = new Error("missing gateway auth");
      generateSommelierReplyMock.mockRejectedValueOnce(error);
      isAIConfigurationErrorMock.mockReturnValueOnce(true);

      const { POST } = await import("@/app/api/chat/route");
      const response = await POST(
        createJsonRequest("/api/chat", { message: "Hello" })
      );

      expect(response.status).toBe(500);
      expect(await readJson(response)).toEqual({
        error: ENV_PUBLIC_ERROR_MESSAGE,
      });
    });

    it("maps AI rate limits to 429", async () => {
      const error = new Error("quota exceeded");
      generateSommelierReplyMock.mockRejectedValueOnce(error);
      isAIRateLimitErrorMock.mockReturnValueOnce(true);

      const { POST } = await import("@/app/api/chat/route");
      const response = await POST(
        createJsonRequest("/api/chat", { message: "Hello" })
      );

      expect(response.status).toBe(429);
      expect(await readJson(response)).toEqual({
        error: "AI rate limit exceeded. Please try again later.",
      });
    });

    it("maps unknown AI failures to 503", async () => {
      generateSommelierReplyMock.mockRejectedValueOnce(
        new Error("gateway timeout")
      );

      const { POST } = await import("@/app/api/chat/route");
      const response = await POST(
        createJsonRequest("/api/chat", { message: "Hello" })
      );

      expect(response.status).toBe(503);
      expect(await readJson(response)).toEqual({
        error: "Failed to get response from sommelier. Please try again.",
      });
    });
  });

  describe("/api/wine/lookup", () => {
    it("returns 400 for invalid JSON", async () => {
      const { POST } = await import("@/app/api/wine/lookup/route");
      const response = await POST(createJsonRequest("/api/wine/lookup", "{"));

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({
        success: false,
        error: "Invalid request body",
      });
    });

    it("returns 400 when query is empty", async () => {
      const { POST } = await import("@/app/api/wine/lookup/route");
      const response = await POST(
        createJsonRequest("/api/wine/lookup", { query: "   " })
      );

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({
        success: false,
        error: "Query is required",
      });
    });

    it("returns lookup data, provider and sources", async () => {
      lookupWineDetailsMock.mockResolvedValueOnce({
        data: {
          found: true,
          name: "Barolo",
        },
        provider: "gateway",
        sources: [{ id: "source-1", url: "https://example.com/barolo" }],
      });

      const { POST } = await import("@/app/api/wine/lookup/route");
      const response = await POST(
        createJsonRequest("/api/wine/lookup", {
          query: "  Barolo  ",
          vintage: "2019",
          winery: "Example Estate",
        })
      );

      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({
        success: true,
        data: {
          found: true,
          name: "Barolo",
        },
        meta: {
          provider: "gateway",
          sources: [{ id: "source-1", url: "https://example.com/barolo" }],
        },
      });
      expect(lookupWineDetailsMock).toHaveBeenCalledWith("Barolo", {
        vintage: "2019",
        winery: "Example Estate",
        userId: "user-123",
      });
    });

    it("maps configuration, rate-limit and generic failures", async () => {
      const { POST } = await import("@/app/api/wine/lookup/route");

      lookupWineDetailsMock.mockRejectedValueOnce(new Error("config"));
      isAIConfigurationErrorMock.mockReturnValueOnce(true);
      const configResponse = await POST(
        createJsonRequest("/api/wine/lookup", { query: "Barolo" })
      );
      expect(configResponse.status).toBe(500);

      lookupWineDetailsMock.mockRejectedValueOnce(new Error("quota"));
      isAIRateLimitErrorMock.mockReturnValueOnce(true);
      const rateResponse = await POST(
        createJsonRequest("/api/wine/lookup", { query: "Barolo" })
      );
      expect(rateResponse.status).toBe(429);

      lookupWineDetailsMock.mockRejectedValueOnce(new Error("down"));
      const genericResponse = await POST(
        createJsonRequest("/api/wine/lookup", { query: "Barolo" })
      );
      expect(genericResponse.status).toBe(503);
    });
  });

  describe("/api/analyze-wine", () => {
    it("returns 400 for invalid JSON or missing image data", async () => {
      const { POST } = await import("@/app/api/analyze-wine/route");

      const invalidJson = await POST(createJsonRequest("/api/analyze-wine", "{"));
      expect(invalidJson.status).toBe(400);

      const missingImage = await POST(
        createJsonRequest("/api/analyze-wine", { mimeType: "image/png" })
      );
      expect(missingImage.status).toBe(400);
      expect(await readJson(missingImage)).toEqual({
        error: "Image data is required",
      });
    });

    it("defaults mime type and returns analyzed data", async () => {
      analyzeWineLabelImageMock.mockResolvedValueOnce({
        data: { name: "Ocello", wineType: "red" },
        provider: "gateway",
      });

      const { POST } = await import("@/app/api/analyze-wine/route");
      const response = await POST(
        createJsonRequest("/api/analyze-wine", {
          imageBase64: "abc123",
        })
      );

      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({
        success: true,
        data: { name: "Ocello", wineType: "red" },
        meta: {
          provider: "gateway",
        },
      });
      expect(analyzeWineLabelImageMock).toHaveBeenCalledWith(
        "abc123",
        "image/jpeg",
        "user-123"
      );
    });

    it("maps configuration, rate-limit and generic failures", async () => {
      const { POST } = await import("@/app/api/analyze-wine/route");

      analyzeWineLabelImageMock.mockRejectedValueOnce(new Error("config"));
      isAIConfigurationErrorMock.mockReturnValueOnce(true);
      const configResponse = await POST(
        createJsonRequest("/api/analyze-wine", { imageBase64: "abc123" })
      );
      expect(configResponse.status).toBe(500);

      analyzeWineLabelImageMock.mockRejectedValueOnce(new Error("quota"));
      isAIRateLimitErrorMock.mockReturnValueOnce(true);
      const rateResponse = await POST(
        createJsonRequest("/api/analyze-wine", { imageBase64: "abc123" })
      );
      expect(rateResponse.status).toBe(429);

      analyzeWineLabelImageMock.mockRejectedValueOnce(new Error("down"));
      const genericResponse = await POST(
        createJsonRequest("/api/analyze-wine", { imageBase64: "abc123" })
      );
      expect(genericResponse.status).toBe(503);
    });
  });

  describe("/api/drinking-window", () => {
    it("returns 400 for invalid JSON or incomplete wine data", async () => {
      const { POST } = await import("@/app/api/drinking-window/route");

      const invalidJson = await POST(
        createJsonRequest("/api/drinking-window", "{")
      );
      expect(invalidJson.status).toBe(400);

      const missingWine = await POST(
        createJsonRequest("/api/drinking-window", { wine: { vintage: 2020 } })
      );
      expect(missingWine.status).toBe(400);
      expect(await readJson(missingWine)).toEqual({
        error: "Wine data with vintage and grape variety is required",
      });
    });

    it("returns the estimated drinking window", async () => {
      estimateDrinkingWindowMock.mockResolvedValueOnce({
        data: {
          drinkingWindowStart: 2026,
          drinkingWindowEnd: 2034,
          peakYear: 2029,
          confidence: "medium",
          reasoning: "Nebbiolo typically improves with time.",
        },
        provider: "gateway",
      });

      const wine = {
        vintage: 2021,
        grapeVariety: "Nebbiolo",
        region: "Barolo",
      };

      const { POST } = await import("@/app/api/drinking-window/route");
      const response = await POST(
        createJsonRequest("/api/drinking-window", { wine })
      );

      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({
        success: true,
        data: {
          drinkingWindowStart: 2026,
          drinkingWindowEnd: 2034,
          peakYear: 2029,
          confidence: "medium",
          reasoning: "Nebbiolo typically improves with time.",
        },
        meta: {
          provider: "gateway",
        },
      });
      expect(estimateDrinkingWindowMock).toHaveBeenCalledWith(wine, "user-123");
    });

    it("maps configuration, rate-limit and generic failures", async () => {
      const { POST } = await import("@/app/api/drinking-window/route");
      const body = {
        wine: {
          vintage: 2021,
          grapeVariety: "Nebbiolo",
        },
      };

      estimateDrinkingWindowMock.mockRejectedValueOnce(new Error("config"));
      isAIConfigurationErrorMock.mockReturnValueOnce(true);
      const configResponse = await POST(
        createJsonRequest("/api/drinking-window", body)
      );
      expect(configResponse.status).toBe(500);

      estimateDrinkingWindowMock.mockRejectedValueOnce(new Error("quota"));
      isAIRateLimitErrorMock.mockReturnValueOnce(true);
      const rateResponse = await POST(
        createJsonRequest("/api/drinking-window", body)
      );
      expect(rateResponse.status).toBe(429);

      estimateDrinkingWindowMock.mockRejectedValueOnce(new Error("down"));
      const genericResponse = await POST(
        createJsonRequest("/api/drinking-window", body)
      );
      expect(genericResponse.status).toBe(503);
    });
  });
});
