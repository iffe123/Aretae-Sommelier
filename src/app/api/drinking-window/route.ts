import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import {
  estimateDrinkingWindow,
  isAIConfigurationError,
  isAIRateLimitError,
} from "@/lib/ai-service";

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

    const wine: WineData = requestBody.wine;

    if (!wine || !wine.vintage || !wine.grapeVariety) {
      return NextResponse.json(
        { error: "Wine data with vintage and grape variety is required" },
        { status: 400 }
      );
    }

    const result = await estimateDrinkingWindow(wine, auth.uid);

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        provider: result.provider,
      },
    });
  } catch (error: unknown) {
    console.error("Drinking window API error:", error);

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
      { error: "Failed to analyze drinking window. Please try again." },
      { status: 503 }
    );
  }
}
