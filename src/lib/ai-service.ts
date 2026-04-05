import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV3Source } from "@ai-sdk/provider";
import {
  type ModelMessage,
  Output,
  generateText,
  stepCountIs,
} from "ai";
import { z } from "zod";
import {
  GatewayRequestError,
  getGatewayAuthToken,
  requestGatewayStructuredTask,
  requestGatewayTextTask,
} from "@/lib/ai-gateway-client";
import { getServerEnv } from "@/lib/env";
import { WINE_TYPES, type Wine, type WineType } from "@/types/wine";

const DEFAULT_TEXT_MODEL = "openai/gpt-5.4-mini";
const DEFAULT_VISION_MODEL = "openai/gpt-5.4-mini";
const DEFAULT_DIRECT_GOOGLE_MODEL = "gemini-2.5-flash";
const DEFAULT_GATEWAY_FALLBACK_MODELS = [
  "anthropic/claude-sonnet-4.6",
  "google/gemini-2.5-flash",
];

const WINE_RESEARCH_DOMAINS_TO_EXCLUDE = [
  "facebook.com",
  "instagram.com",
  "pinterest.com",
  "reddit.com",
];

const wineTypeValues = WINE_TYPES.map(({ value }) => value) as [
  WineType,
  ...WineType[],
];

const wineLabelSchema = z.object({
  name: z.string().trim().nullable().default(null),
  winery: z.string().trim().nullable().default(null),
  vintage: z.number().int().nullable().default(null),
  grapeVariety: z.string().trim().nullable().default(null),
  region: z.string().trim().nullable().default(null),
  country: z.string().trim().nullable().default(null),
  wineType: z.enum(wineTypeValues).nullable().default(null),
  classification: z.string().trim().nullable().default(null),
  alcoholContent: z.number().nullable().default(null),
  drinkingWindowStart: z.number().int().nullable().default(null),
  drinkingWindowEnd: z.number().int().nullable().default(null),
});

const wineLookupSchema = z.object({
  found: z.boolean().default(true),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  name: z.string().trim().default(""),
  winery: z.string().trim().default(""),
  region: z.string().trim().default(""),
  country: z.string().trim().default(""),
  grapeVariety: z.string().trim().default(""),
  wineType: z.enum(wineTypeValues).nullable().default(null),
  vintage: z.number().int().nullable().default(null),
  classification: z.string().trim().nullable().default(null),
  rating: z.object({
    score: z.number().nullable().default(null),
    count: z.number().nullable().default(null),
    source: z.string().trim().nullable().default(null),
  }),
  price: z.object({
    amount: z.number().nullable().default(null),
    currency: z.string().trim().default("SEK"),
  }),
  style: z.object({
    body: z.string().trim().nullable().default(null),
    acidity: z.string().trim().nullable().default(null),
    tannins: z.string().trim().nullable().default(null),
  }),
  foodPairings: z.array(z.string().trim()).default([]),
  drinkingWindow: z.object({
    start: z.number().int().nullable().default(null),
    end: z.number().int().nullable().default(null),
  }),
  description: z.string().trim().nullable().default(null),
  wineUrl: z.string().trim().nullable().default(null),
});

const drinkingWindowSchema = z.object({
  drinkingWindowStart: z.number().int(),
  drinkingWindowEnd: z.number().int(),
  peakYear: z.number().int(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  reasoning: z.string().trim(),
});

export type WineLabelResult = z.infer<typeof wineLabelSchema>;
export type WineLookupResult = z.infer<typeof wineLookupSchema>;
export type DrinkingWindowResult = z.infer<typeof drinkingWindowSchema>;

export interface SourceSummary {
  id: string;
  title?: string;
  url: string;
}

export interface AIResult<T> {
  data: T;
  provider: "gateway" | "google";
  sources: SourceSummary[];
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface CellarWineSummary {
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  price?: number;
  rating?: number;
  quantity?: number;
  storageLocation?: string;
  wineType?: string;
  classification?: string;
}

export interface CellarData {
  wines: CellarWineSummary[];
  totalBottles: number;
  totalValue: number;
}

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export class AIRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIRateLimitError";
  }
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

type TaskKind = "chat" | "lookup" | "vision" | "drinking-window";

type StructuredTaskOptions<T> = {
  kind: TaskKind;
  schema: z.ZodType<T>;
  schemaName: string;
  schemaDescription: string;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  userId?: string;
  tags: string[];
  requireSearchTool?: boolean;
  useGroundedSearch?: boolean;
  includeGatewaySources?: boolean;
};

type TextTaskOptions = {
  kind: TaskKind;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  userId?: string;
  tags: string[];
};

const WINE_LABEL_INSTRUCTIONS = `
You are an expert sommelier and wine-label analyst.
Inspect the uploaded bottle label carefully and extract only the details that are visibly supported by the image.

Rules:
- Return JSON that matches the provided schema exactly.
- If a field is not visible or you are unsure, return null.
- Prefer the cuvee or wine name over the producer name when both appear.
- Use the exact wine type enum provided by the schema.
- Estimate the drinking window only when the label gives enough evidence through style, region, classification, or vintage.
- Never invent a producer, appellation, or grape variety.
`;

const WINE_LOOKUP_SYSTEM_PROMPT = `
You are a precise wine-research assistant.
Use the available web-search tool before answering whenever live wine facts are needed.

Research rules:
- Prefer official producer pages, Vivino, Wine-Searcher, CellarTracker, Decanter, Wine Enthusiast, and other reputable wine sources.
- Never rely on ${WINE_RESEARCH_DOMAINS_TO_EXCLUDE.join(", ")}.
- Ratings and prices should come from the most trustworthy consumer-facing source available.
- If multiple sources disagree, choose the most reliable source and lower the confidence level.
- If you cannot verify a field, leave it blank or null rather than guessing.
- Keep pairings practical and specific to the wine style.
- Populate the sources array with 2 to 4 URLs you relied on.
`;

const DRINKING_WINDOW_SYSTEM_PROMPT = `
You are an expert sommelier focused on drinking windows and aging potential.

Be realistic:
- Most wines should be drunk within 5 to 10 years of vintage.
- Reserve 20+ year windows for truly age-worthy wines.
- Use grape, region, classification, structure, and price as clues.
- If certainty is low, choose a conservative window and mark confidence as low.
`;

const SOMMELIER_SYSTEM_PROMPT = `You are a passionate, cheerful wine nerd and expert sommelier who loves helping people enjoy wine without ever sounding snobbish.

Your style:
- warm, conversational, and encouraging
- excited about the user's collection
- specific, practical, and easy to follow
- deeply knowledgeable about regions, grapes, producers, pairings, serving, and aging

Always:
- anchor your advice in the user's cellar and ratings when available
- suggest a clear recommendation when asked what to drink
- mention serving tips or pairings when they add value
- avoid making up facts about wines that are not in the provided context`;

const CELLAR_AWARE_INSTRUCTIONS = `
You know the user's cellar. Use it.

When cellar data is provided:
- identify their taste from 4-5 star wines
- prefer bottles they already own before suggesting purchases
- mention exact wines, vintages, and storage locations when recommending
- prioritize bottles that are ready or at peak
- if they have no ratings yet, gently encourage them to rate wines`;

function getGoogleProvider() {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  return createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
}

function getPrimaryModelId(kind: TaskKind): string {
  const env = getServerEnv();
  if (kind === "vision") {
    return env.AI_VISION_MODEL || DEFAULT_VISION_MODEL;
  }

  return env.AI_PRIMARY_MODEL || DEFAULT_TEXT_MODEL;
}

function getGatewayModelChain(kind: TaskKind): string[] {
  const env = getServerEnv();
  const primaryModelId = getPrimaryModelId(kind);
  const configuredFallbacks = env.AI_FALLBACK_MODELS
    ?.split(",")
    .map((modelId) => modelId.trim())
    .filter(Boolean);

  const fallbackModels = configuredFallbacks?.length
    ? configuredFallbacks
    : DEFAULT_GATEWAY_FALLBACK_MODELS;

  return [primaryModelId, ...fallbackModels].filter(
    (modelId, index, allModelIds) =>
      modelId.length > 0 && allModelIds.indexOf(modelId) === index
  );
}

function createGoogleLanguageModel(kind: TaskKind) {
  const google = getGoogleProvider();
  if (!google) {
    return null;
  }

  const modelId = kind === "vision" ? DEFAULT_DIRECT_GOOGLE_MODEL : DEFAULT_DIRECT_GOOGLE_MODEL;

  return {
    google,
    model: google(modelId),
  };
}

function normalizeSourceSummaries(sources: LanguageModelV3Source[]): SourceSummary[] {
  return sources
    .filter((source): source is LanguageModelV3Source & { type: "source"; sourceType: "url"; id: string; url: string } => {
      return source.type === "source" && source.sourceType === "url" && typeof source.url === "string";
    })
    .map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
    }));
}

function createGoogleSearchTools(
  google: NonNullable<ReturnType<typeof getGoogleProvider>>
) {
  return {
    google_search: google.tools.googleSearch({}),
  };
}

function classifyAIError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof GatewayRequestError) {
    if (error.status === 401 || error.status === 403) {
      return new AIConfigurationError(error.message);
    }

    if (error.status === 429) {
      return new AIRateLimitError(error.message);
    }

    if (error.status >= 500) {
      return new AIUnavailableError(fallbackMessage);
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("missing or invalid environment variables") ||
    normalized.includes("service is not configured") ||
    normalized.includes("authentication failed") ||
    normalized.includes("invalid api key") ||
    normalized.includes("invalid api-key") ||
    normalized.includes("no authentication provided") ||
    normalized.includes("unauthenticated request") ||
    normalized.includes("api gateway authentication failed")
  ) {
    return new AIConfigurationError(message);
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("quota") ||
    normalized.includes("429")
  ) {
    return new AIRateLimitError(message);
  }

  return new AIUnavailableError(fallbackMessage);
}

function createPromptInput(
  prompt?: string,
  messages?: ModelMessage[]
): { prompt: string; messages?: never } | { messages: ModelMessage[]; prompt?: never } {
  if (messages && messages.length > 0) {
    return { messages };
  }

  return { prompt: prompt || "" };
}

async function runStructuredTask<T>({
  kind,
  schema,
  schemaName,
  schemaDescription,
  system,
  prompt,
  messages,
  temperature = 0,
  userId,
  tags,
  requireSearchTool = false,
  useGroundedSearch = false,
  includeGatewaySources = false,
}: StructuredTaskOptions<T>): Promise<AIResult<T>> {
  let lastError: unknown;

  if (getGatewayAuthToken()) {
    for (const modelId of getGatewayModelChain(kind)) {
      try {
        const result = await requestGatewayStructuredTask({
          model: modelId,
          task: kind,
          tags,
          schema,
          schemaName,
          instructions: system,
          prompt,
          messages,
          temperature,
          userId,
          requireSearchTool,
          useWebSearch: useGroundedSearch,
          includeSources: includeGatewaySources,
        });

        return {
          data: result.data,
          provider: "gateway",
          sources: result.sources,
        };
      } catch (error) {
        lastError = error;
        console.warn(
          `[AI] Gateway ${kind} task failed for model ${modelId}, trying next fallback.`,
          error
        );
      }
    }
  }

  const googleSetup = createGoogleLanguageModel(kind);
  if (!googleSetup) {
    throw classifyAIError(
      lastError,
      "AI is not configured. Add AI Gateway auth or GEMINI_API_KEY."
    );
  }

  try {
    const tools = useGroundedSearch
      ? createGoogleSearchTools(googleSetup.google)
      : undefined;

    const result = await generateText({
      model: googleSetup.model,
      system,
      ...createPromptInput(prompt, messages),
      temperature,
      maxRetries: 1,
      stopWhen: tools ? stepCountIs(4) : undefined,
      toolChoice: requireSearchTool ? "required" : undefined,
      tools,
      output: Output.object({
        schema,
        name: schemaName,
        description: schemaDescription,
      }),
    });

    return {
      data: result.output,
      provider: "google",
      sources: normalizeSourceSummaries(result.sources),
    };
  } catch (error) {
    throw classifyAIError(error, "The AI service is temporarily unavailable.");
  }
}

async function runTextTask({
  kind,
  system,
  prompt,
  messages,
  temperature = 0.7,
  userId,
  tags,
}: TextTaskOptions): Promise<AIResult<string>> {
  let lastError: unknown;

  if (getGatewayAuthToken()) {
    for (const modelId of getGatewayModelChain(kind)) {
      try {
        const result = await requestGatewayTextTask({
          model: modelId,
          task: kind,
          tags,
          instructions: system,
          prompt,
          messages,
          temperature,
          userId,
        });

        return {
          data: result.data,
          provider: "gateway",
          sources: result.sources,
        };
      } catch (error) {
        lastError = error;
        console.warn(
          `[AI] Gateway ${kind} task failed for model ${modelId}, trying next fallback.`,
          error
        );
      }
    }
  }

  const googleSetup = createGoogleLanguageModel(kind);
  if (!googleSetup) {
    throw classifyAIError(
      lastError,
      "AI is not configured. Add AI Gateway auth or GEMINI_API_KEY."
    );
  }

  try {
    const result = await generateText({
      model: googleSetup.model,
      system,
      ...createPromptInput(prompt, messages),
      temperature,
      maxRetries: 1,
    });

    return {
      data: result.text,
      provider: "google",
      sources: normalizeSourceSummaries(result.sources),
    };
  } catch (error) {
    throw classifyAIError(error, "The AI service is temporarily unavailable.");
  }
}

function toAssistantRole(role: ChatMessage["role"]): "assistant" | "user" {
  return role === "model" ? "assistant" : "user";
}

function buildChatHistory(
  conversationHistory?: ChatMessage[],
  latestMessage?: string
): ModelMessage[] {
  const history: ModelMessage[] =
    conversationHistory?.map((message) => ({
      role: toAssistantRole(message.role),
      content: [{ type: "text", text: message.content }],
    })) || [];

  if (latestMessage) {
    history.push({
      role: "user",
      content: [{ type: "text", text: latestMessage }],
    });
  }

  return history;
}

function formatCellarSummary(cellarData: CellarData): string {
  if (!cellarData.wines || cellarData.wines.length === 0) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const ratedWines = cellarData.wines.filter((wine) => wine.rating && wine.rating >= 4);
  const favorites = cellarData.wines.filter((wine) => wine.rating === 5);

  let summary = `\nUSER CELLAR (${cellarData.wines.length} wines, ${cellarData.totalBottles} bottles, ~${cellarData.totalValue.toLocaleString()} kr):\n`;
  summary += `Current year: ${currentYear}\n`;

  if (ratedWines.length > 0) {
    const regionCounts: Record<string, number> = {};
    const grapeCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    ratedWines.forEach((wine) => {
      if (wine.region) {
        regionCounts[wine.region] = (regionCounts[wine.region] || 0) + 1;
      }
      if (wine.grapeVariety) {
        grapeCounts[wine.grapeVariety] = (grapeCounts[wine.grapeVariety] || 0) + 1;
      }
      if (wine.wineType) {
        typeCounts[wine.wineType] = (typeCounts[wine.wineType] || 0) + 1;
      }
    });

    const topRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([region]) => region);
    const topGrapes = Object.entries(grapeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([grape]) => grape);
    const topTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([wineType]) => wineType);

    summary += `Favorite regions: ${topRegions.join(", ") || "Unknown"}\n`;
    summary += `Favorite grapes: ${topGrapes.join(", ") || "Unknown"}\n`;
    summary += `Preferred wine types: ${topTypes.join(", ") || "Unknown"}\n`;
  }

  if (favorites.length > 0) {
    summary += "Top-rated bottles:\n";
    favorites.forEach((wine) => {
      summary += `- ${wine.name} (${wine.winery}, ${wine.vintage})\n`;
    });
  }

  summary += "Full cellar:\n";
  cellarData.wines.forEach((wine, index) => {
    const parts = [
      `${index + 1}. ${wine.name}`,
      wine.winery,
      wine.vintage ? String(wine.vintage) : "",
      wine.grapeVariety,
      wine.region ? `${wine.region}, ${wine.country}` : wine.country,
      wine.rating ? `${wine.rating}/5` : "",
      wine.storageLocation ? `Location: ${wine.storageLocation}` : "",
    ].filter(Boolean);

    summary += `${parts.join(" | ")}\n`;
  });

  return summary;
}

function buildWineContextSummary(wineContext?: Wine): string {
  if (!wineContext) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const wineAge = currentYear - wineContext.vintage;

  return `
CURRENT WINE
- Name: ${wineContext.name}
- Winery: ${wineContext.winery}
- Vintage: ${wineContext.vintage} (${wineAge} years old)
- Grape: ${wineContext.grapeVariety}
- Region: ${wineContext.region}, ${wineContext.country}
- Price: ${wineContext.price} kr
${wineContext.wineType ? `- Type: ${wineContext.wineType}` : ""}
${wineContext.classification ? `- Classification: ${wineContext.classification}` : ""}
${wineContext.alcoholContent ? `- Alcohol: ${wineContext.alcoholContent}%` : ""}
${wineContext.rating ? `- User rating: ${wineContext.rating}/5` : ""}
${wineContext.vivinoRating ? `- Market rating: ${wineContext.vivinoRating}/5` : ""}
${wineContext.body ? `- Body: ${wineContext.body}` : ""}
${wineContext.acidity ? `- Acidity: ${wineContext.acidity}` : ""}
${wineContext.drinkingWindowStart && wineContext.drinkingWindowEnd ? `- Drinking window: ${wineContext.drinkingWindowStart}-${wineContext.drinkingWindowEnd}` : ""}
${wineContext.tastingNotes ? `- Tasting notes: ${wineContext.tastingNotes}` : ""}
`;
}

export function isAIConfigurationError(error: unknown): error is AIConfigurationError {
  return error instanceof AIConfigurationError;
}

export function isAIRateLimitError(error: unknown): error is AIRateLimitError {
  return error instanceof AIRateLimitError;
}

export async function analyzeWineLabelImage(
  imageBase64: string,
  mimeType: string,
  userId?: string
): Promise<AIResult<WineLabelResult>> {
  const base64Data = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  return runStructuredTask({
    kind: "vision",
    schema: wineLabelSchema,
    schemaName: "wine_label_analysis",
    schemaDescription: "Structured wine label facts extracted from a bottle image.",
    system: WINE_LABEL_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the wine facts from this bottle label image.",
          },
          {
            type: "image",
            image: base64Data,
            mediaType: mimeType || "image/jpeg",
          },
        ],
      },
    ],
    temperature: 0,
    userId,
    tags: ["wine-label-analysis"],
  });
}

export async function lookupWineDetails(
  query: string,
  options?: {
    vintage?: string;
    winery?: string;
    userId?: string;
  }
): Promise<AIResult<WineLookupResult>> {
  const vintageInfo = options?.vintage ? `Vintage: ${options.vintage}` : "Vintage: unknown";
  const wineryInfo = options?.winery ? `Producer: ${options.winery}` : "Producer: unknown";

  return runStructuredTask({
    kind: "lookup",
    schema: wineLookupSchema,
    schemaName: "wine_lookup",
    schemaDescription: "Verified wine facts gathered from current web sources.",
    system: WINE_LOOKUP_SYSTEM_PROMPT,
    prompt: [
      `Wine query: ${query}`,
      vintageInfo,
      wineryInfo,
      "",
      "Research this exact wine and return the best verified match.",
      "Lower confidence if the match is ambiguous.",
      "Return found=false if you cannot confidently identify the wine.",
      "Use the web_search tool before answering.",
      "Populate the sources array with the URLs you relied on.",
    ].join("\n"),
    temperature: 0,
    userId: options?.userId,
    tags: ["wine-lookup"],
    requireSearchTool: true,
    useGroundedSearch: true,
    includeGatewaySources: true,
  });
}

export async function estimateDrinkingWindow(
  wine: {
    name?: string;
    winery?: string;
    vintage: number;
    grapeVariety: string;
    region?: string;
    country?: string;
    wineType?: string;
    classification?: string;
    vivinoRating?: number;
    body?: string;
    price?: number;
  },
  userId?: string
): Promise<AIResult<DrinkingWindowResult>> {
  const currentYear = new Date().getFullYear();

  return runStructuredTask({
    kind: "drinking-window",
    schema: drinkingWindowSchema,
    schemaName: "drinking_window_estimate",
    schemaDescription: "A realistic drinking window estimate for a wine bottle.",
    system: DRINKING_WINDOW_SYSTEM_PROMPT,
    prompt: [
      "Estimate the drinking window for this wine:",
      `Name: ${wine.name || "Unknown"}`,
      `Winery: ${wine.winery || "Unknown"}`,
      `Vintage: ${wine.vintage}`,
      `Grape variety: ${wine.grapeVariety}`,
      `Region: ${wine.region || "Unknown"}, ${wine.country || "Unknown"}`,
      wine.wineType ? `Type: ${wine.wineType}` : "",
      wine.classification ? `Classification: ${wine.classification}` : "",
      wine.vivinoRating ? `Market rating: ${wine.vivinoRating}/5` : "",
      wine.body ? `Body: ${wine.body}` : "",
      wine.price ? `Price: ${wine.price} kr` : "",
      `Current year: ${currentYear}`,
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.2,
    userId,
    tags: ["drinking-window"],
  });
}

export async function generateSommelierReply(
  message: string,
  options?: {
    wineContext?: Wine;
    conversationHistory?: ChatMessage[];
    cellarData?: CellarData;
    userId?: string;
  }
): Promise<AIResult<string>> {
  const cellarSummary = options?.cellarData
    ? `\n\nCELLAR CONTEXT\n${CELLAR_AWARE_INSTRUCTIONS}\n${formatCellarSummary(options.cellarData)}`
    : "";

  const currentWineSummary = buildWineContextSummary(options?.wineContext);

  const systemPrompt = [
    SOMMELIER_SYSTEM_PROMPT,
    cellarSummary,
    currentWineSummary ? `\n${currentWineSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return runTextTask({
    kind: "chat",
    system: systemPrompt,
    messages: buildChatHistory(options?.conversationHistory, message),
    temperature: 0.7,
    userId: options?.userId,
    tags: ["sommelier-chat"],
  });
}
