import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

async function loadGatewayClient() {
  vi.resetModules();
  return import("../ai-gateway-client");
}

function createGatewayResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("ai-gateway-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    vi.resetModules();
  });

  it("parses structured JSON responses wrapped in code fences", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";

    fetchMock.mockResolvedValueOnce(
      createGatewayResponse({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: [
                  "```json",
                  JSON.stringify({
                    result: { name: "Barolo", found: true },
                    sources: [
                      { title: "Example", url: "https://example.com/barolo" },
                      { title: "Duplicate", url: "https://example.com/barolo" },
                    ],
                  }),
                  "```",
                ].join("\n"),
              },
            ],
          },
        ],
      })
    );

    const { requestGatewayStructuredTask } = await loadGatewayClient();
    const result = await requestGatewayStructuredTask({
      model: "openai/gpt-5.4-mini",
      task: "lookup",
      tags: ["wine-lookup"],
      schema: z.object({
        name: z.string(),
        found: z.boolean(),
      }),
      schemaName: "wine_lookup",
      instructions: "Research the wine",
      prompt: "Find Barolo",
      userId: "user-123",
      requireSearchTool: true,
      useWebSearch: true,
      includeSources: true,
    });

    expect(result).toEqual({
      data: { name: "Barolo", found: true },
      sources: [
        {
          id: "source-1",
          title: "Example",
          url: "https://example.com/barolo",
        },
      ],
    });

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(options.body));
    expect(payload.user).toBe("user-123");
    expect(payload.metadata).toEqual({
      app: "aretae-sommelier",
      task: "lookup",
      tags: "aretae,wine-lookup",
    });
    expect(payload.tool_choice).toBe("required");
    expect(payload.tools).toEqual([{ type: "web_search" }]);
  });

  it("extracts markdown links as text-task sources", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";

    fetchMock.mockResolvedValueOnce(
      createGatewayResponse({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Try this Barolo from [Producer](https://example.com/barolo) and compare it with [Review](https://example.com/review).",
              },
            ],
          },
        ],
      })
    );

    const { requestGatewayTextTask } = await loadGatewayClient();
    const result = await requestGatewayTextTask({
      model: "openai/gpt-5.4-mini",
      task: "chat",
      tags: ["sommelier-chat"],
      prompt: "What should I drink?",
    });

    expect(result.data).toContain("Try this Barolo");
    expect(result.sources).toEqual([
      {
        id: "source-1",
        title: "Producer",
        url: "https://example.com/barolo",
      },
      {
        id: "source-2",
        title: "Review",
        url: "https://example.com/review",
      },
    ]);
  });

  it("sends image content as data URLs when building gateway input", async () => {
    const { createGatewayInput } = await loadGatewayClient();
    const input = createGatewayInput(undefined, [
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this label." },
          { type: "image", image: "abc123", mediaType: "image/png" },
        ],
      },
    ]);

    expect(input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "Analyze this label." },
          { type: "input_image", image_url: "data:image/png;base64,abc123" },
        ],
      },
    ]);
  });

  it("throws a GatewayRequestError when the gateway responds with an error", async () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";

    fetchMock.mockResolvedValueOnce(
      createGatewayResponse(
        {
          error: {
            message: "Upstream rate limit",
          },
        },
        429
      )
    );

    const { requestGatewayTextTask } = await loadGatewayClient();

    await expect(
      requestGatewayTextTask({
        model: "openai/gpt-5.4-mini",
        task: "chat",
        tags: ["sommelier-chat"],
        prompt: "Hello",
      })
    ).rejects.toEqual(
      expect.objectContaining({
        name: "GatewayRequestError",
        message: "Upstream rate limit",
        status: 429,
      })
    );
  });
});
