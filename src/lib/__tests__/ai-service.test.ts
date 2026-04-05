import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  generateText: vi.fn(),
  stepCountIs: vi.fn((count: number) => ({ count })),
  outputObject: vi.fn((config: unknown) => config),
  createGoogle: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  stepCountIs: mocks.stepCountIs,
  Output: {
    object: mocks.outputObject,
  },
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mocks.createGoogle,
}));

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

async function loadAIService() {
  vi.resetModules();
  return import("../ai-service");
}

function createGatewayResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("ai-service", () => {
  let googleProvider: ReturnType<typeof vi.fn> & {
    tools: { googleSearch: ReturnType<typeof vi.fn> };
  };
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    global.fetch = mocks.fetch as typeof fetch;

    googleProvider = Object.assign(
      vi.fn((modelId: string) => ({ provider: "google", modelId })),
      {
        tools: {
          googleSearch: vi.fn(() => ({ name: "google_search_tool" })),
        },
      }
    );

    mocks.createGoogle.mockReturnValue(googleProvider);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    vi.resetModules();
  });

  it("uses the raw gateway responses API for wine lookup and returns structured sources", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";
    process.env.AI_FALLBACK_MODELS = "openai/gpt-5.4-mini";
    delete process.env.GEMINI_API_KEY;

    const expectedLookup = {
      found: true,
      confidence: "high",
      name: "Barolo",
      winery: "Example Estate",
      region: "Barolo",
      country: "Italy",
      grapeVariety: "Nebbiolo",
      wineType: "red",
      vintage: 2019,
      classification: "DOCG",
      rating: {
        score: 4.3,
        count: 1200,
        source: "Vivino",
      },
      price: {
        amount: 329,
        currency: "SEK",
      },
      style: {
        body: "Full-bodied",
        acidity: "High",
        tannins: "High",
      },
      foodPairings: ["Braised beef", "Mushroom risotto"],
      drinkingWindow: {
        start: 2026,
        end: 2038,
      },
      description: "Rose petals, tar, and red cherry.",
      wineUrl: "https://example.com/barolo",
    };

    mocks.fetch.mockResolvedValueOnce(
      createGatewayResponse({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  result: expectedLookup,
                  sources: [
                    {
                      title: "Example Estate",
                      url: "https://example.com/barolo",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      })
    );

    const { lookupWineDetails } = await loadAIService();
    const result = await lookupWineDetails("Barolo", {
      vintage: "2019",
      userId: "user-123",
    });

    expect(result.provider).toBe("gateway");
    expect(result.data).toEqual(expectedLookup);
    expect(result.sources).toEqual([
      {
        id: "source-1",
        title: "Example Estate",
        url: "https://example.com/barolo",
      },
    ]);

    const [url, options] = mocks.fetch.mock.calls[0];
    const payload = JSON.parse(String(options.body));

    expect(String(url)).toContain("/v1/responses");
    expect(options.headers.Authorization).toBe("Bearer oidc-token");
    expect(payload.model).toBe("openai/gpt-5.4-mini");
    expect(payload.user).toBe("user-123");
    expect(payload.metadata.task).toBe("lookup");
    expect(payload.tool_choice).toBe("required");
    expect(payload.tools).toEqual([{ type: "web_search" }]);
    expect(payload.text.format.type).toBe("json_schema");
  });

  it("falls back to direct Google lookup when the gateway request fails", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.AI_FALLBACK_MODELS = "openai/gpt-5.4-mini";

    const expectedLookup = {
      found: true,
      confidence: "medium",
      name: "Barolo",
      winery: "Fallback Estate",
      region: "Barolo",
      country: "Italy",
      grapeVariety: "Nebbiolo",
      wineType: "red",
      vintage: 2019,
      classification: "DOCG",
      rating: {
        score: 4.2,
        count: 800,
        source: "Vivino",
      },
      price: {
        amount: 289,
        currency: "SEK",
      },
      style: {
        body: "Full-bodied",
        acidity: "High",
        tannins: "High",
      },
      foodPairings: ["Braised beef"],
      drinkingWindow: {
        start: 2026,
        end: 2036,
      },
      description: "Dried rose and cherry.",
      wineUrl: "https://example.com/fallback-barolo",
    };

    mocks.fetch.mockResolvedValueOnce(
      createGatewayResponse(
        {
          error: {
            message: "Gateway unavailable",
          },
        },
        503
      )
    );
    mocks.generateText.mockResolvedValueOnce({
      output: expectedLookup,
      sources: [
        {
          type: "source",
          sourceType: "url",
          id: "source-1",
          title: "Fallback Estate",
          url: "https://example.com/fallback-barolo",
        },
      ],
    });

    const { lookupWineDetails } = await loadAIService();
    const result = await lookupWineDetails("Barolo", {
      vintage: "2019",
      userId: "user-123",
    });

    expect(result.provider).toBe("google");
    expect(result.data).toEqual(expectedLookup);
    expect(result.sources).toEqual([
      {
        id: "source-1",
        title: "Fallback Estate",
        url: "https://example.com/fallback-barolo",
      },
    ]);

    expect(googleProvider).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(mocks.generateText).toHaveBeenCalledTimes(1);

    const googleCall = mocks.generateText.mock.calls[0][0];
    expect(googleCall.toolChoice).toBe("required");
    expect(googleCall.tools).toHaveProperty("google_search");
  });

  it("builds assistant-style chat history for gateway chat requests", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";
    process.env.AI_FALLBACK_MODELS = "openai/gpt-5.4-mini";
    delete process.env.GEMINI_API_KEY;

    mocks.fetch.mockResolvedValueOnce(
      createGatewayResponse({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Open the Barolo tonight.",
              },
            ],
          },
        ],
      })
    );

    const { generateSommelierReply } = await loadAIService();
    const result = await generateSommelierReply("What should I open tonight?", {
      userId: "user-456",
      conversationHistory: [
        { role: "user", content: "I like Nebbiolo." },
        { role: "model", content: "Great taste." },
      ],
    });

    expect(result.provider).toBe("gateway");
    expect(result.data).toBe("Open the Barolo tonight.");

    const payload = JSON.parse(String(mocks.fetch.mock.calls[0][1].body));
    expect(payload.user).toBe("user-456");
    expect(payload.metadata.task).toBe("chat");
    expect(payload.input).toEqual([
      {
        role: "user",
        content: [{ type: "input_text", text: "I like Nebbiolo." }],
      },
      {
        role: "assistant",
        content: [{ type: "input_text", text: "Great taste." }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: "What should I open tonight?" },
        ],
      },
    ]);
  });

  it("sends label-analysis images to the gateway as data URLs", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";
    process.env.AI_FALLBACK_MODELS = "openai/gpt-5.4-mini";
    delete process.env.GEMINI_API_KEY;

    mocks.fetch.mockResolvedValueOnce(
      createGatewayResponse({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  result: {
                    name: "Barolo",
                    winery: "Example Estate",
                    vintage: 2019,
                    grapeVariety: "Nebbiolo",
                    region: "Barolo",
                    country: "Italy",
                    wineType: "red",
                    classification: "DOCG",
                    alcoholContent: null,
                    drinkingWindowStart: null,
                    drinkingWindowEnd: null,
                  },
                }),
              },
            ],
          },
        ],
      })
    );

    const { analyzeWineLabelImage } = await loadAIService();
    await analyzeWineLabelImage("abc123", "image/png", "user-789");

    const payload = JSON.parse(String(mocks.fetch.mock.calls[0][1].body));
    expect(payload.input).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract the wine facts from this bottle label image.",
          },
          {
            type: "input_image",
            image_url: "data:image/png;base64,abc123",
          },
        ],
      },
    ]);
  });
});
