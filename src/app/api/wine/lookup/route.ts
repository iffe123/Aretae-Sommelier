import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import {
  isAIConfigurationError,
  isAIRateLimitError,
  lookupWineDetails,
} from "@/lib/ai-service";

interface RequestBody {
  query: string;
  vintage?: string;
  winery?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { query, vintage, winery } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    const result = await lookupWineDetails(query.trim(), {
      vintage,
      winery,
      userId: auth.uid,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        provider: result.provider,
        sources: result.sources,
      },
    });
  } catch (error) {
    console.error("[Wine Lookup] Error:", error);

    if (isAIConfigurationError(error)) {
      return NextResponse.json(
        { success: false, error: ENV_PUBLIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    if (isAIRateLimitError(error)) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to lookup wine. Please try again." },
      { status: 503 }
    );
  }
}
