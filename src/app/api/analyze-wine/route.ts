import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import { applyRateLimitHeaders, consumeAIRateLimit } from "@/lib/ai-rate-limit";
import {
  analyzeWineLabelImage,
  isAIConfigurationError,
  isAIRateLimitError,
} from "@/lib/ai-service";
import { createAIRouteMonitor } from "@/lib/observability";

export async function POST(request: NextRequest) {
  const monitor = createAIRouteMonitor({
    endpoint: "analyze-wine",
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

    const { imageBase64, mimeType } = requestBody;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      await monitor.badRequest({ reason: "missing_image_data" });
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    const rateLimit = await consumeAIRateLimit({
      endpoint: "analyze-wine",
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
            error: `You've scanned a lot of labels in a short burst. Please wait about ${rateLimit.retryAfterSeconds} seconds and try again.`,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    await monitor.start({
      image_bytes: imageBase64.length,
      mime_type: mimeType || "image/jpeg",
      remaining: rateLimit.remaining,
      store: rateLimit.store,
    });

    const result = await analyzeWineLabelImage(
      imageBase64,
      mimeType || "image/jpeg",
      auth.uid
    );

    await monitor.success({
      provider: result.provider,
      has_name: Boolean(result.data.name),
      has_winery: Boolean(result.data.winery),
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
      { error: "Failed to analyze wine label. Please fill in details manually." },
      { status: 503 }
    );
  }
}
