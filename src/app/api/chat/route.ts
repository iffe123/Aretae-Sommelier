import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import { applyRateLimitHeaders, consumeAIRateLimit } from "@/lib/ai-rate-limit";
import {
  type CellarData,
  type ChatMessage,
  generateSommelierReply,
  isAIConfigurationError,
  isAIRateLimitError,
} from "@/lib/ai-service";
import { createAIRouteMonitor } from "@/lib/observability";
import type { Wine } from "@/types/wine";

export async function POST(request: NextRequest) {
  const monitor = createAIRouteMonitor({
    endpoint: "chat",
    request,
    context: {
      has_authorization_header: Boolean(request.headers.get("Authorization")),
    },
  });

  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) {
      await monitor.authFailure({ status: auth.status });
      return auth;
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      await monitor.badRequest({ reason: "invalid_json" });
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      message,
      wineContext,
      conversationHistory,
      cellarData,
    }: {
      message: string;
      wineContext?: Wine;
      conversationHistory?: ChatMessage[];
      cellarData?: CellarData;
    } = requestBody;

    if (!message || typeof message !== "string") {
      await monitor.badRequest({ reason: "missing_message" });
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    const rateLimit = await consumeAIRateLimit({
      endpoint: "chat",
      userId: auth.uid,
    });

    if (!rateLimit.allowed) {
      await monitor.rateLimited({
        limit: rateLimit.limit,
        retry_after_s: rateLimit.retryAfterSeconds,
        store: rateLimit.store,
      });

      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: `You've asked the sommelier a lot in a short burst. Please wait about ${rateLimit.retryAfterSeconds} seconds and try again.`,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    await monitor.start({
      history_count: conversationHistory?.length ?? 0,
      cellar_wine_count: cellarData?.wines?.length ?? 0,
      has_wine_context: Boolean(wineContext),
      message_length: trimmedMessage.length,
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    const result = await generateSommelierReply(trimmedMessage, {
      wineContext,
      conversationHistory,
      cellarData,
      userId: auth.uid,
    });

    await monitor.success({
      provider: result.provider,
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    return applyRateLimitHeaders(
      NextResponse.json({
        response: result.data,
        meta: {
          provider: result.provider,
        },
      }),
      rateLimit
    );
  } catch (error: unknown) {
    if (isAIConfigurationError(error)) {
      await monitor.configurationError(error);
      return NextResponse.json(
        { error: ENV_PUBLIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    if (isAIRateLimitError(error)) {
      await monitor.providerRateLimited(error);
      return NextResponse.json(
        { error: "AI rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    await monitor.unavailable(error);
    return NextResponse.json(
      { error: "Failed to get response from sommelier. Please try again." },
      { status: 503 }
    );
  }
}
