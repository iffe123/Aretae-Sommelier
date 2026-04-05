import { NextRequest, NextResponse } from "next/server";
import { ENV_PUBLIC_ERROR_MESSAGE } from "@/lib/env";
import { authenticateRequest } from "@/lib/api-auth";
import {
  type CellarData,
  type ChatMessage,
  generateSommelierReply,
  isAIConfigurationError,
  isAIRateLimitError,
} from "@/lib/ai-service";
import type { Wine } from "@/types/wine";

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
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const result = await generateSommelierReply(message, {
      wineContext,
      conversationHistory,
      cellarData,
      userId: auth.uid,
    });

    return NextResponse.json({
      response: result.data,
      meta: {
        provider: result.provider,
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);

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
      { error: "Failed to get response from sommelier. Please try again." },
      { status: 503 }
    );
  }
}
