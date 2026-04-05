import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import { applyRateLimitHeaders, consumeAIRateLimit } from "@/lib/ai-rate-limit";
import {
  estimateDrinkingWindow,
  isAIConfigurationError,
  isAIRateLimitError,
} from "@/lib/ai-service";
import { createAIRouteMonitor } from "@/lib/observability";

interface WineData {
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
}

export async function POST(request: NextRequest) {
  const monitor = createAIRouteMonitor({
    endpoint: "drinking-window",
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

    const wine: WineData = requestBody.wine;

    if (!wine || !wine.vintage || !wine.grapeVariety) {
      await monitor.badRequest({ reason: "missing_wine_context" });
      return NextResponse.json(
        { error: "Wine data with vintage and grape variety is required" },
        { status: 400 }
      );
    }

    const rateLimit = await consumeAIRateLimit({
      endpoint: "drinking-window",
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
            error: `You've requested a lot of drinking-window estimates in a short burst. Please wait about ${rateLimit.retryAfterSeconds} seconds and try again.`,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    await monitor.start({
      vintage: wine.vintage,
      has_region: Boolean(wine.region),
      has_classification: Boolean(wine.classification),
      has_market_rating: Boolean(wine.vivinoRating),
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    const result = await estimateDrinkingWindow(wine, auth.uid);

    await monitor.success({
      provider: result.provider,
      confidence: result.data.confidence,
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: result.data,
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
      { error: "Failed to analyze drinking window. Please try again." },
      { status: 503 }
    );
  }
}
