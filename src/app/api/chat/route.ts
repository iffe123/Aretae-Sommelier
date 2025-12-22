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
- Drinking windows and optimal consumption timing

When given context about a specific wine from the user's collection, provide personalized advice about that wine. Otherwise, answer general wine questions with enthusiasm and expertise.

DRINKING WINDOW GUIDELINES:
- When discussing when to drink a wine, consider: grape variety, region, quality level, vintage age
- Ready now (🟢): Wine is in its drinking window
- At peak (🟡): Wine is at or near optimal drinking time - suggest drinking soon
- Past peak (🔴): Wine may be declining - drink immediately or it may be too late
- Still aging (⏳): Wine needs more time in the cellar
- Be specific with years when recommending drinking windows
- For wines past their peak, be honest but tactful - they may still be enjoyable

Keep responses concise but informative. Use elegant language befitting a sommelier, but remain accessible to wine enthusiasts of all levels.`;

const CELLAR_AWARE_INSTRUCTIONS = `
IMPORTANT: You have access to the user's wine cellar collection. When making recommendations:
- ALWAYS check if the user has a suitable wine in their collection before suggesting they buy something
- Reference specific wines by name, winery, and vintage when recommending from their cellar
- Include storage location if available so they can find the bottle
- If they ask what wines they have from a region/country/grape, list the relevant wines from their cellar
- If asked about food pairings, recommend wines FROM THEIR COLLECTION that would pair well
- If they don't have a suitable wine, acknowledge this and suggest what to look for
- You can reference the total collection size and estimated value when relevant

DRINKING WINDOW AWARENESS:
- When suggesting wines to drink, prioritize wines that are:
  1. At peak (approaching optimal drinking time)
  2. Past peak (should be drunk immediately to avoid further decline)
  3. Ready now (in their drinking window)
- For each wine, mentally calculate drinking window based on: vintage, grape variety, region, classification
- Warn users about wines that may be past their prime
- Suggest cellar-worthy wines for special occasions that are not yet ready
- When asked "what should I drink tonight/this week", prioritize wines at peak or ready now
- Use wine type (red/white/rosé/sparkling) to inform recommendations for specific occasions`;

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
  wineType?: string;
  classification?: string;
  alcoholContent?: number;
  drinkingWindowStart?: number;
  drinkingWindowEnd?: number;
  body?: string;
  acidity?: string;
  vivinoRating?: number;
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
  wineType?: string;
  classification?: string;
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

  const currentYear = new Date().getFullYear();
  let summary = `\n\nUSER'S WINE CELLAR (${cellarData.wines.length} wines, ${cellarData.totalBottles} total bottles, ~${cellarData.totalValue.toLocaleString()} kr estimated value):\n`;
  summary += `Current year: ${currentYear}\n\n`;

  // Format each wine efficiently to minimize tokens
  cellarData.wines.forEach((wine, index) => {
    const wineAge = currentYear - wine.vintage;
    const parts = [
      `${index + 1}. ${wine.name}`,
      wine.winery,
      `${wine.vintage} (${wineAge}y)`,
      wine.grapeVariety,
      `${wine.region}, ${wine.country}`,
    ];

    if (wine.wineType) parts.push(wine.wineType);
    if (wine.classification) parts.push(wine.classification);
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
      const currentYear = new Date().getFullYear();
      const wineAge = currentYear - wine.vintage;
      
      contextMessage = `\n\nThe user is currently viewing this specific wine from their collection:
- Name: ${wine.name}
- Winery: ${wine.winery}
- Vintage: ${wine.vintage} (${wineAge} years old)
- Grape: ${wine.grapeVariety}
- Region: ${wine.region}, ${wine.country}
- Price: ${wine.price} kr
${wine.wineType ? `- Wine Type: ${wine.wineType}` : ""}
${wine.classification ? `- Classification: ${wine.classification}` : ""}
${wine.alcoholContent ? `- Alcohol: ${wine.alcoholContent}%` : ""}
${wine.rating ? `- User's Rating: ${wine.rating}/5 stars` : ""}
${wine.vivinoRating ? `- Vivino Rating: ${wine.vivinoRating}/5` : ""}
${wine.body ? `- Body: ${wine.body}` : ""}
${wine.acidity ? `- Acidity: ${wine.acidity}` : ""}
${wine.drinkingWindowStart && wine.drinkingWindowEnd ? `- Drinking Window: ${wine.drinkingWindowStart} - ${wine.drinkingWindowEnd}` : ""}
${wine.tastingNotes ? `- User's Tasting Notes: ${wine.tastingNotes}` : ""}

Focus your response on this specific wine when answering their question. Consider its current age and likely drinking window.`;
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
