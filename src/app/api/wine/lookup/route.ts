import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import { applyRateLimitHeaders, consumeAIRateLimit } from "@/lib/ai-rate-limit";
import {
  isAIConfigurationError,
  isAIRateLimitError,
  lookupWineDetails,
} from "@/lib/ai-service";
import { createAIRouteMonitor } from "@/lib/observability";

interface RequestBody {
  query: string;
  vintage?: string;
  winery?: string;
}

export async function POST(request: NextRequest) {
  const monitor = createAIRouteMonitor({
    endpoint: "lookup",
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

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      await monitor.badRequest({ reason: "invalid_json" });
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { query, vintage, winery } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      await monitor.badRequest({ reason: "missing_query" });
      return NextResponse.json(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();
    const rateLimit = await consumeAIRateLimit({
      endpoint: "lookup",
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
            success: false,
            error: `You've looked up a lot of wines in a short burst. Please wait about ${rateLimit.retryAfterSeconds} seconds and try again.`,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    await monitor.start({
      query_length: trimmedQuery.length,
      has_vintage: Boolean(vintage),
      has_winery: Boolean(winery),
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    const result = await lookupWineDetails(trimmedQuery, {
      vintage,
      winery,
      userId: auth.uid,
    });

    await monitor.success({
      provider: result.provider,
      source_count: result.sources.length,
      found: result.data.found,
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: result.data,
        meta: {
          provider: result.provider,
          sources: result.sources,
        },
      }),
      rateLimit
    );
  } catch (error) {
    if (isAIConfigurationError(error)) {
      await monitor.configurationError(error);
      return NextResponse.json(
        { success: false, error: ENV_PUBLIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    if (isAIRateLimitError(error)) {
      await monitor.providerRateLimited(error);
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    await monitor.unavailable(error);
    return NextResponse.json(
      { success: false, error: "Failed to lookup wine. Please try again." },
      { status: 503 }
    );
  }
}
