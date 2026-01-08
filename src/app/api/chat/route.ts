import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV_PUBLIC_ERROR_MESSAGE, getServerEnv } from "@/lib/env";

const SOMMELIER_SYSTEM_PROMPT = `You are a passionate, cheerful wine nerd and expert sommelier who absolutely LOVES talking about wine! You have decades of experience but never come across as stuffy or pretentious - you're genuinely excited to share your knowledge and help people discover amazing wines.

YOUR PERSONALITY:
- You're enthusiastic and cheerful - wine makes you happy and it shows!
- You geek out on the details: terroir, winemaking techniques, obscure grape varieties
- You use friendly, conversational language with genuine warmth
- You celebrate the user's wine choices and get excited about their collection
- You share fun wine facts, stories about producers, and insider knowledge
- You're encouraging and never judgmental - every wine journey is valid
- You remember and reference the user's preferences to make it personal

YOUR EXPERTISE (shared with enthusiasm!):
- Deep knowledge of wine varietals, regions, and producers worldwide
- Food and wine pairing magic - you love finding perfect matches
- Serving temperatures, decanting secrets, and glassware tips
- Aging potential and the art of cellar management
- Tasting notes that paint vivid flavor pictures
- Wine history, culture, and fascinating stories
- Drinking windows and knowing exactly when to pop that cork

PERSONALIZATION IS KEY:
- Pay close attention to wines the user has rated highly - this reveals their taste!
- Notice patterns: Do they love bold reds? Crisp whites? Bubbly? Old World elegance?
- Reference their preferences when making recommendations ("Based on your love for that Barolo...")
- Celebrate when they have great bottles in their collection
- If they rated a wine highly, acknowledge their great taste!

DRINKING WINDOW GUIDELINES:
- Ready now (🟢): In its drinking window - let's enjoy it!
- At peak (🟡): This is the moment! Suggest drinking soon
- Past peak (🔴): Time-sensitive - drink immediately, but it might still surprise you!
- Still aging (⏳): Patience will be rewarded - the wait will be worth it!
- Be specific with years and always optimistic about the experience

Keep responses conversational but informative. Be the wine friend everyone wishes they had!`;

const CELLAR_AWARE_INSTRUCTIONS = `
YOU KNOW THEIR CELLAR - USE IT!
You have access to the user's wine cellar collection. This is exciting - you can give truly personalized advice!

UNDERSTAND THEIR TASTE PROFILE:
- Look at wines they've rated 4-5 stars - these reveal what they LOVE
- Notice patterns in their highly-rated wines:
  * Do they prefer certain regions? (Burgundy lover? Napa fan? Barossa enthusiast?)
  * Grape preferences? (Pinot Noir devotee? Riesling aficionado?)
  * Style preferences? (Bold and tannic? Light and elegant? Fruit-forward?)
  * Old World vs New World tendencies?
- When recommending, favor wines similar to their top-rated bottles
- If they haven't rated wines yet, encourage them to - it helps you help them!

CELLAR RECOMMENDATIONS:
- ALWAYS check their collection first before suggesting purchases
- Get excited about their great bottles! ("Oh wow, you have a 2015 Barolo - that's a treasure!")
- Reference specific wines by name, winery, and vintage
- Include storage location so they can find the bottle easily
- If they need something they don't have, suggest what to look for

DRINKING WINDOW AWARENESS:
When suggesting wines to drink, think like a caring friend:
1. First priority: At peak wines - "This is THE moment for that bottle!"
2. Second: Past peak wines - "Let's open this soon before it fades!"
3. Third: Ready now wines - "This is drinking beautifully right now"
4. Save for later: Still aging wines for special future occasions

Consider vintage, grape variety, region, and classification for each recommendation.
When asked "what should I drink tonight?" - get excited and give them a specific pick!

PERSONAL TOUCHES:
- Use their rated wines to make connections ("Since you loved that Châteauneuf, you'll adore this...")
- Celebrate their collection's gems
- Be their enthusiastic wine guide who really knows their taste`;

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

  // Analyze user's taste profile based on ratings
  const ratedWines = cellarData.wines.filter(w => w.rating && w.rating >= 4);
  const favorites = cellarData.wines.filter(w => w.rating === 5);

  let summary = `\n\nUSER'S WINE CELLAR (${cellarData.wines.length} wines, ${cellarData.totalBottles} total bottles, ~${cellarData.totalValue.toLocaleString()} kr estimated value):\n`;
  summary += `Current year: ${currentYear}\n`;

  // Add taste profile analysis if they have rated wines
  if (ratedWines.length > 0) {
    summary += `\n🌟 TASTE PROFILE (based on their ${ratedWines.length} highly-rated wines):\n`;

    // Analyze favorite regions
    const regionCounts: Record<string, number> = {};
    const grapeCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    ratedWines.forEach(wine => {
      regionCounts[wine.region] = (regionCounts[wine.region] || 0) + 1;
      grapeCounts[wine.grapeVariety] = (grapeCounts[wine.grapeVariety] || 0) + 1;
      countryCounts[wine.country] = (countryCounts[wine.country] || 0) + 1;
      if (wine.wineType) typeCounts[wine.wineType] = (typeCounts[wine.wineType] || 0) + 1;
    });

    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topGrapes = Object.entries(grapeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (topCountries.length > 0) summary += `- Favorite countries: ${topCountries.map(([c]) => c).join(", ")}\n`;
    if (topRegions.length > 0) summary += `- Favorite regions: ${topRegions.map(([r]) => r).join(", ")}\n`;
    if (topGrapes.length > 0) summary += `- Favorite grapes: ${topGrapes.map(([g]) => g).join(", ")}\n`;
    if (Object.keys(typeCounts).length > 0) {
      const preferredTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
      summary += `- Wine type preferences: ${preferredTypes.join(", ")}\n`;
    }
  }

  // Show favorites first (5-star wines)
  if (favorites.length > 0) {
    summary += `\n⭐ USER'S FAVORITES (5-star ratings):\n`;
    favorites.forEach((wine) => {
      summary += `• ${wine.name} (${wine.winery}, ${wine.vintage}) - ${wine.grapeVariety}, ${wine.region}\n`;
    });
  }

  summary += `\nFULL CELLAR:\n`;

  // Format each wine efficiently to minimize tokens
  cellarData.wines.forEach((wine, index) => {
    const wineAge = currentYear - wine.vintage;
    const ratingStr = wine.rating ? `★${wine.rating}` : "";
    const parts = [
      `${index + 1}. ${ratingStr} ${wine.name}`,
      wine.winery,
      `${wine.vintage} (${wineAge}y)`,
      wine.grapeVariety,
      `${wine.region}, ${wine.country}`,
    ];

    if (wine.wineType) parts.push(wine.wineType);
    if (wine.classification) parts.push(wine.classification);
    if (wine.price) parts.push(`${wine.price} kr`);
    if (wine.quantity && wine.quantity > 1) parts.push(`${wine.quantity} bottles`);
    if (wine.storageLocation) parts.push(`Location: ${wine.storageLocation}`);

    summary += parts.join(" | ") + "\n";
  });

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    let apiKey: string;
    try {
      apiKey = getServerEnv().GEMINI_API_KEY;
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { error: ENV_PUBLIC_ERROR_MESSAGE },
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
        fullSystemPrompt += `\n\nSYSTEM-INSTRUCTION APPENDIX: CELLAR CONTEXT\n` + CELLAR_AWARE_INSTRUCTIONS + cellarSummary;
      }
    } else {
      console.log("[Chat API] No cellar data provided to API");
    }

    // Add specific wine context if viewing a particular wine
    if (wineContext) {
      const wine = wineContext as WineContext;
      const currentYear = new Date().getFullYear();
      const wineAge = currentYear - wine.vintage;

      fullSystemPrompt += `\n\nSYSTEM-INSTRUCTION APPENDIX: CURRENT WINE CONTEXT
- The user is currently viewing this specific wine from their collection:
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: fullSystemPrompt,
    });

    const history = (conversationHistory as ChatMessage[] | undefined)?.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })) || [];

    const chat = model.startChat({ history });

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
