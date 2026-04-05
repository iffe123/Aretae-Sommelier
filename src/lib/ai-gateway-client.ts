import type { ModelMessage } from "ai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

const AI_GATEWAY_RESPONSES_URL = "https://ai-gateway.vercel.sh/v1/responses";
const GATEWAY_TIMEOUT_MS = 45_000;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

const gatewaySourceSchema = z.object({
  title: z.string().trim().nullable().default(null),
  url: z.string().trim().min(1),
});

type GatewayInputContent =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
    };

type GatewayInputMessage = {
  role: "assistant" | "user";
  content: GatewayInputContent[];
};

type GatewayResponseBody = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export interface GatewaySourceSummary {
  id: string;
  title?: string;
  url: string;
}

export class GatewayRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GatewayRequestError";
    this.status = status;
  }
}

export function getGatewayAuthToken(): string | undefined {
  const env = getServerEnv();
  return env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toDataUrl(imageValue: string, mimeType: string): string {
  if (imageValue.startsWith("data:")) {
    return imageValue;
  }

  const base64Data = imageValue.includes(",")
    ? imageValue.split(",")[1]
    : imageValue;

  return `data:${mimeType || "image/jpeg"};base64,${base64Data}`;
}

function bufferToBase64(value: ArrayBuffer | Uint8Array): string {
  return Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value))
    .toString("base64");
}

function toGatewayContentPart(part: unknown): GatewayInputContent[] {
  if (!isRecord(part) || typeof part.type !== "string") {
    return [];
  }

  if (part.type === "text" && typeof part.text === "string") {
    return [{ type: "input_text", text: part.text }];
  }

  if (part.type === "image") {
    const mediaType =
      typeof part.mediaType === "string" && part.mediaType.length > 0
        ? part.mediaType
        : "image/jpeg";

    if (typeof part.image === "string") {
      return [
        {
          type: "input_image",
          image_url: toDataUrl(part.image, mediaType),
        },
      ];
    }

    if (part.image instanceof Uint8Array || part.image instanceof ArrayBuffer) {
      return [
        {
          type: "input_image",
          image_url: toDataUrl(bufferToBase64(part.image), mediaType),
        },
      ];
    }
  }

  return [];
}

function toGatewayRole(role: ModelMessage["role"]): "assistant" | "user" {
  return role === "assistant" ? "assistant" : "user";
}

export function createGatewayInput(
  prompt?: string,
  messages?: ModelMessage[]
): string | GatewayInputMessage[] {
  if (!messages || messages.length === 0) {
    return prompt || "";
  }

  return messages
    .map((message) => {
      if (typeof message.content === "string") {
        return {
          role: toGatewayRole(message.role),
          content: [{ type: "input_text", text: message.content }],
        } satisfies GatewayInputMessage;
      }

      return {
        role: toGatewayRole(message.role),
        content: message.content.flatMap((part) => toGatewayContentPart(part)),
      } satisfies GatewayInputMessage;
    })
    .filter((message) => message.content.length > 0);
}

function createGatewayMetadata(task: string, tags: string[]) {
  return {
    app: "aretae-sommelier",
    task,
    tags: ["aretae", ...tags].join(","),
  };
}

function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

function extractGatewayErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }

  return typeof payload.error.message === "string"
    ? payload.error.message
    : undefined;
}

async function requestGateway(
  model: string,
  body: Record<string, unknown>
): Promise<GatewayResponseBody> {
  const authToken = getGatewayAuthToken();
  if (!authToken) {
    throw new GatewayRequestError(
      "AI Gateway authentication failed: missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN.",
      401
    );
  }

  const response = await fetch(AI_GATEWAY_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...body,
    }),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });

  const payload = await response
    .json()
    .catch(() => ({ error: { message: "AI Gateway returned invalid JSON." } }));

  if (!response.ok) {
    throw new GatewayRequestError(
      extractGatewayErrorMessage(payload) ||
        `AI Gateway request failed with status ${response.status}.`,
      response.status
    );
  }

  return payload as GatewayResponseBody;
}

function extractGatewayOutputText(response: GatewayResponseBody): string {
  const text = response.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter(
      (content): content is { type: "output_text"; text: string } =>
        content.type === "output_text" && typeof content.text === "string"
    )
    .map((content) => content.text.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!text) {
    throw new GatewayRequestError("AI Gateway returned no assistant text.", 502);
  }

  return text;
}

function parseStructuredJson<T>(text: string, schema: z.ZodType<T>): T {
  const trimmed = text.trim();
  const withoutCodeFences = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  return schema.parse(JSON.parse(withoutCodeFences));
}

function normalizeGatewaySources(
  sources: z.infer<typeof gatewaySourceSchema>[] = []
): GatewaySourceSummary[] {
  return sources
    .filter(
      (source, index, allSources) =>
        allSources.findIndex((candidate) => candidate.url === source.url) ===
        index
    )
    .map((source, index) => ({
      id: `source-${index + 1}`,
      title: source.title || undefined,
      url: source.url,
    }));
}

function extractMarkdownSources(text: string): GatewaySourceSummary[] {
  const sources = new Map<string, GatewaySourceSummary>();

  for (const match of text.matchAll(MARKDOWN_LINK_REGEX)) {
    const title = match[1]?.trim();
    const url = match[2]?.trim();

    if (!url || sources.has(url)) {
      continue;
    }

    sources.set(url, {
      id: `source-${sources.size + 1}`,
      title: title || undefined,
      url,
    });
  }

  return Array.from(sources.values());
}

export async function requestGatewayStructuredTask<T>(options: {
  model: string;
  task: string;
  tags: string[];
  schema: z.ZodType<T>;
  schemaName: string;
  instructions?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  userId?: string;
  requireSearchTool?: boolean;
  useWebSearch?: boolean;
  includeSources?: boolean;
}): Promise<{ data: T; sources: GatewaySourceSummary[] }> {
  const responseSchema = options.includeSources
    ? z.object({
        result: options.schema,
        sources: z.array(gatewaySourceSchema).max(6).default([]),
      })
    : z.object({
        result: options.schema,
      });

  const response = await requestGateway(options.model, {
    instructions: options.instructions,
    input: createGatewayInput(options.prompt, options.messages),
    temperature: options.temperature ?? 0,
    metadata: createGatewayMetadata(options.task, options.tags),
    user: options.userId,
    tool_choice: options.requireSearchTool ? "required" : undefined,
    tools: options.useWebSearch ? [{ type: "web_search" }] : undefined,
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        strict: true,
        schema: toJsonSchema(responseSchema),
      },
    },
  });
  const parsed = parseStructuredJson(
    extractGatewayOutputText(response),
    responseSchema
  ) as {
    result: T;
    sources?: z.infer<typeof gatewaySourceSchema>[];
  };

  return {
    data: parsed.result,
    sources: normalizeGatewaySources(parsed.sources),
  };
}

export async function requestGatewayTextTask(options: {
  model: string;
  task: string;
  tags: string[];
  instructions?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  userId?: string;
}): Promise<{ data: string; sources: GatewaySourceSummary[] }> {
  const response = await requestGateway(options.model, {
    instructions: options.instructions,
    input: createGatewayInput(options.prompt, options.messages),
    temperature: options.temperature ?? 0.7,
    metadata: createGatewayMetadata(options.task, options.tags),
    user: options.userId,
  });
  const text = extractGatewayOutputText(response);

  return {
    data: text,
    sources: extractMarkdownSources(text),
  };
}
