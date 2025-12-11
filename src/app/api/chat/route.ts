import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

const CELLAR_AWARE_INSTRUCTIONS = `
IMPORTANT: You have access to the user's wine cellar collection. When making recommendations:
- ALWAYS check if the user has a suitable wine in their collection before suggesting they buy something
- Reference specific wines by name, winery, and vintage when recommending from their cellar
- Include storage location if available so they can find the bottle
- If they ask what wines they have from a region/country/grape, list the relevant wines from their cellar
- If asked about food pairings, recommend wines FROM THEIR COLLECTION that would pair well
- If they don't have a suitable wine, acknowledge this and suggest what to look for
- When suggesting wines to drink soon, consider vintage age and typical aging potential for the grape variety
- You can reference the total collection size and estimated value when relevant`;

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

interface CellarWineSummary {
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  price?: number;
  rating?: number;
  quantity?: number;
  storageLocation?: string;
}

interface CellarData {
  wines: CellarWineSummary[];
  totalBottles: number;
  totalValue: number;
}

function formatCellarSummary(cellarData: CellarData): string {
  if (!cellarData.wines || cellarData.wines.length === 0) {
    return "";
  }

  let summary = `\n\nUSER'S WINE CELLAR (${cellarData.wines.length} wines, ${cellarData.totalBottles} total bottles, ~${cellarData.totalValue.toLocaleString()} kr estimated value):\n`;

  // Format each wine efficiently to minimize tokens
  cellarData.wines.forEach((wine, index) => {
    const parts = [
      `${index + 1}. ${wine.name}`,
      wine.winery,
      wine.vintage,
      wine.grapeVariety,
      `${wine.region}, ${wine.country}`,
    ];

    if (wine.price) parts.push(`${wine.price} kr`);
    if (wine.rating) parts.push(`${wine.rating}/5 stars`);
    if (wine.quantity && wine.quantity > 1) parts.push(`${wine.quantity} bottles`);
    if (wine.storageLocation) parts.push(`Location: ${wine.storageLocation}`);

    summary += parts.join(" | ") + "\n";
  });

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured in environment variables");
      return NextResponse.json(
        { error: "Sommelier service is not configured. Please set GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

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

    const { message, wineContext, conversationHistory, cellarData } = requestBody;

    console.log("[Chat API] Received request:", {
      message: message?.substring(0, 50) + (message?.length > 50 ? "..." : ""),
      hasWineContext: !!wineContext,
      hasCellarData: !!cellarData,
      cellarWineCount: cellarData?.wines?.length || 0,
    });

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build the full system prompt with all context
    let fullSystemPrompt = SOMMELIER_SYSTEM_PROMPT;

    // Add cellar data if available
    let cellarSummary = "";
    if (cellarData) {
      const typedCellarData = cellarData as CellarData;
      cellarSummary = formatCellarSummary(typedCellarData);
      console.log("[Chat API] Cellar summary generated:", {
        hasSummary: !!cellarSummary,
        summaryLength: cellarSummary?.length || 0,
        wineCount: typedCellarData.wines?.length || 0,
      });
      if (cellarSummary) {
        fullSystemPrompt += CELLAR_AWARE_INSTRUCTIONS + cellarSummary;
      }
    } else {
      console.log("[Chat API] No cellar data provided to API");
    }

    // Add specific wine context if viewing a particular wine
    let contextMessage = "";
    if (wineContext) {
      const wine = wineContext as WineContext;
      contextMessage = `\n\nThe user is currently viewing this specific wine from their collection:
- Name: ${wine.name}
- Winery: ${wine.winery}
- Vintage: ${wine.vintage}
- Grape: ${wine.grapeVariety}
- Region: ${wine.region}, ${wine.country}
- Price: ${wine.price} kr
${wine.rating ? `- User's Rating: ${wine.rating}/5 stars` : ""}
${wine.tastingNotes ? `- User's Tasting Notes: ${wine.tastingNotes}` : ""}

Focus your response on this specific wine when answering their question.`;
    }

    const history = (conversationHistory as ChatMessage[] | undefined)?.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })) || [];

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: fullSystemPrompt + contextMessage }],
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

    const errorObj = error as { message?: string; status?: number; statusText?: string };

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
