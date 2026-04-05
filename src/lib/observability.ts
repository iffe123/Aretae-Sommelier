import { track } from "@vercel/analytics/server";

type Primitive = string | number | boolean | null | undefined;

export type AIEndpoint = "chat" | "lookup" | "analyze-wine" | "drinking-window";

type LogLevel = "info" | "warn" | "error";

interface AIRouteMonitorOptions {
  endpoint: AIEndpoint;
  request: Request;
  context?: Record<string, Primitive>;
}

function sanitizeProperties(
  properties: Record<string, Primitive>
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean | null>;
}

function getLogMethod(level: LogLevel) {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  return console.log;
}

async function safeTrack(
  eventName: string,
  properties: Record<string, Primitive>
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  try {
    await track(eventName, sanitizeProperties(properties));
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        domain: "observability",
        event: "analytics_track_failed",
        event_name: eventName,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function emitLog({
  level,
  endpoint,
  request,
  startedAt,
  baseContext,
  event,
  properties,
  analyticsEventName,
}: {
  level: LogLevel;
  endpoint: AIEndpoint;
  request: Request;
  startedAt: number;
  baseContext: Record<string, Primitive>;
  event: string;
  properties?: Record<string, Primitive>;
  analyticsEventName?: string;
}) {
  const payload = sanitizeProperties({
    domain: "ai",
    endpoint,
    event,
    method: request.method,
    request_id: request.headers.get("x-vercel-id") ?? undefined,
    duration_ms: Date.now() - startedAt,
    ...baseContext,
    ...(properties || {}),
  });

  getLogMethod(level)(JSON.stringify({ level, ...payload }));

  if (analyticsEventName) {
    await safeTrack(analyticsEventName, payload);
  }
}

export function createAIRouteMonitor({
  endpoint,
  request,
  context = {},
}: AIRouteMonitorOptions) {
  const startedAt = Date.now();

  return {
    async start(properties?: Record<string, Primitive>) {
      await emitLog({
        level: "info",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "started",
        properties,
      });
    },
    async success(properties?: Record<string, Primitive>) {
      await emitLog({
        level: "info",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "succeeded",
        properties,
        analyticsEventName: "AI request succeeded",
      });
    },
    async badRequest(properties?: Record<string, Primitive>) {
      await emitLog({
        level: "warn",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "bad_request",
        properties,
        analyticsEventName: "AI request rejected",
      });
    },
    async authFailure(properties?: Record<string, Primitive>) {
      await emitLog({
        level: "warn",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "auth_failed",
        properties,
        analyticsEventName: "AI auth failed",
      });
    },
    async rateLimited(properties?: Record<string, Primitive>) {
      await emitLog({
        level: "warn",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "rate_limited",
        properties,
        analyticsEventName: "AI request rate limited",
      });
    },
    async providerRateLimited(
      error: unknown,
      properties?: Record<string, Primitive>
    ) {
      await emitLog({
        level: "warn",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "provider_rate_limited",
        properties: {
          error:
            error instanceof Error ? error.message : String(error),
          ...(properties || {}),
        },
        analyticsEventName: "AI provider rate limited",
      });
    },
    async configurationError(
      error: unknown,
      properties?: Record<string, Primitive>
    ) {
      await emitLog({
        level: "error",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "configuration_error",
        properties: {
          error:
            error instanceof Error ? error.message : String(error),
          ...(properties || {}),
        },
        analyticsEventName: "AI configuration error",
      });
    },
    async unavailable(error: unknown, properties?: Record<string, Primitive>) {
      await emitLog({
        level: "error",
        endpoint,
        request,
        startedAt,
        baseContext: context,
        event: "unavailable",
        properties: {
          error:
            error instanceof Error ? error.message : String(error),
          ...(properties || {}),
        },
        analyticsEventName: "AI request failed",
      });
    },
  };
}
