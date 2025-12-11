import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

const SOMMELIER_SYSTEM_PROMPT = `You are an expert sommelier with decades of experience in wine tasting, pairing, and cellar management. You are warm, approachable, and passionate about helping people discover and enjoy wine.

Your expertise includes:
- Wine varietals, regions, and producers from around the world
- Food and wine pairing recommendations
- Serving temperatures and decanting advice
- Aging potential and cellar management
- Tasting notes and flavor profiles
- Wine history and culture

When given context about a specific wine from the user's collection, provide personalized advice about that wine. Otherwise, answer general wine questions with enthusiasm and expertise.

Keep responses concise but informative. Use elegant language befitting a sommelier, but remain accessible to wine enthusiasts of all levels.`;

interface WineContext {
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  price: number;
  rating?: number;
  tastingNotes?: string;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export async function POST(request: NextRequest) {
  // Check rate limit
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`chat:${clientIP}`);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.resetInMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured in environment variables");
      return NextResponse.json(
        { error: "Sommelier service is not configured. Please set GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    // Validate API key format (should be a non-empty string)
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0 || apiKey === 'your_gemini_api_key_here') {
      console.error("GEMINI_API_KEY appears to be invalid or placeholder value");
      return NextResponse.json(
        { error: "Sommelier service is misconfigured. Please check your GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { message, wineContext, conversationHistory } = requestBody;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let contextMessage = "";
    if (wineContext) {
      const wine = wineContext as WineContext;
      contextMessage = `\n\nThe user is currently viewing this wine from their collection:
- Name: ${wine.name}
- Winery: ${wine.winery}
- Vintage: ${wine.vintage}
- Grape: ${wine.grapeVariety}
- Region: ${wine.region}, ${wine.country}
- Price: $${wine.price}
${wine.rating ? `- User's Rating: ${wine.rating}/5 stars` : ""}
${wine.tastingNotes ? `- User's Tasting Notes: ${wine.tastingNotes}` : ""}

Consider this wine when answering their question.`;
    }

    const history = (conversationHistory as ChatMessage[] | undefined)?.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })) || [];

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SOMMELIER_SYSTEM_PROMPT + contextMessage }],
        },
        {
          role: "model",
          parts: [
            {
              text: "I understand. I'm ready to assist as your personal sommelier. How may I help you today?",
            },
          ],
        },
        ...history,
      ],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ response: text });
  } catch (error: unknown) {
    console.error("Chat API error:", error);

    // Provide more specific error messages based on the error type
    const errorObj = error as { message?: string; status?: number; statusText?: string };

    // Check for common Gemini API errors
    if (errorObj.message?.includes('API key')) {
      return NextResponse.json(
        { error: "Invalid Gemini API key. Please check your GEMINI_API_KEY configuration." },
        { status: 401 }
      );
    }

    if (errorObj.message?.includes('quota') || errorObj.message?.includes('rate')) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (errorObj.message?.includes('model') || errorObj.message?.includes('not found')) {
      return NextResponse.json(
        { error: "AI model unavailable. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to get response from sommelier. Please try again." },
      { status: 500 }
    );
  }
}
