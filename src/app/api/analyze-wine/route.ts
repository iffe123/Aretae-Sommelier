import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import {
  analyzeWineLabelImage,
  isAIConfigurationError,
  isAIRateLimitError,
} from "@/lib/ai-service";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { imageBase64, mimeType } = requestBody;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    const result = await analyzeWineLabelImage(
      imageBase64,
      mimeType || "image/jpeg",
      auth.uid
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        provider: result.provider,
      },
    });
  } catch (error: unknown) {
    console.error("Wine analysis API error:", error);

    if (isAIConfigurationError(error)) {
      return NextResponse.json(
        { error: ENV_PUBLIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    if (isAIRateLimitError(error)) {
      return NextResponse.json(
        { error: "AI rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze wine label. Please fill in details manually." },
      { status: 503 }
    );
  }
}
