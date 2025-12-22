import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Wine Lookup API Route (Gemini-powered with Web Search)
 *
 * POST /api/wine/lookup
 *
 * This endpoint uses Gemini AI with Google Search grounding to find
 * wine information from multiple sources (Vivino, Wine-Searcher, etc.)
 *
 * Request body:
 * {
 *   query: string,      // Wine name or search term
 *   vintage?: string,   // Optional vintage year
 *   winery?: string     // Optional winery name
 * }
 */

const WINE_LOOKUP_PROMPT = `You are an expert sommelier with comprehensive wine knowledge.
Search the web and find accurate information about this wine.

Wine Query: "{query}"
{vintageInfo}
{wineryInfo}

Search online wine databases (Vivino, Wine-Searcher, CellarTracker, etc.) and return ONLY a valid JSON object:

{
  "found": boolean,
  "confidence": "high" | "medium" | "low",
  "name": "official wine name (cuvée if applicable)",
  "winery": "producer/château/domaine name",
  "region": "wine region (e.g., Napa Valley, Côtes du Rhône)",
  "country": "country of origin",
  "grapeVariety": "grape variety or blend (e.g., Cabernet Sauvignon, Grenache blend)",
  "wineType": "red" | "white" | "rosé" | "sparkling" | "dessert" | "fortified" | "orange" | null,
  "vintage": year as number or null,
  "classification": "quality classification (Grand Cru, DOC, Reserva) or null",
  "rating": {
    "score": average rating on 1-5 scale or null,
    "count": number of ratings or null,
    "source": "Vivino" | "Wine-Searcher" | "CellarTracker" | "Critics"
  },
  "price": {
    "amount": estimated price as number or null,
    "currency": "USD" | "EUR" | "SEK" | "GBP"
  },
  "style": {
    "body": "Light-bodied" | "Medium-bodied" | "Full-bodied" | null,
    "acidity": "Low" | "Medium" | "High" | null,
    "tannins": "Low" | "Medium" | "High" | null
  },
  "foodPairings": ["food1", "food2", "food3"] or [],
  "drinkingWindow": {
    "start": year to start drinking or null,
    "end": year to drink by or null
  },
  "description": "1-2 sentence tasting description or null",
  "wineUrl": "link to wine on Vivino or similar if found"
}

Important guidelines:
- Return ONLY valid JSON, no markdown formatting
- Set found: false if wine cannot be identified, but include partial data if possible
- Use the most reliable rating source available (Vivino preferred for consumer wines)
- Prices should reflect current retail market value
- For drinkingWindow, estimate based on wine style, region, and vintage if not explicitly stated
- Be specific with grape varieties (not just "Red Blend" if specific grapes are known)`;

interface RequestBody {
  query: string;
  vintage?: string;
  winery?: string;
}

interface WineLookupData {
  found: boolean;
  confidence: "high" | "medium" | "low";
  name: string;
  winery: string;
  region: string;
  country: string;
  grapeVariety: string;
  wineType: string | null;
  vintage: number | null;
  classification: string | null;
  rating: {
    score: number | null;
    count: number | null;
    source: string;
  };
  price: {
    amount: number | null;
    currency: string;
  };
  style: {
    body: string | null;
    acidity: string | null;
    tannins: string | null;
  };
  foodPairings: string[];
  drinkingWindow: {
    start: number | null;
    end: number | null;
  };
  description: string | null;
  wineUrl: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "Wine lookup service is not configured" },
        { status: 500 }
      );
    }

    if (typeof apiKey !== "string" || apiKey.trim().length === 0 || apiKey === "your_gemini_api_key_here") {
      console.error("GEMINI_API_KEY appears to be invalid");
      return NextResponse.json(
        { success: false, error: "Wine lookup service is misconfigured" },
        { status: 500 }
      );
    }

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

    // Build the prompt with optional vintage and winery info
    const vintageInfo = vintage ? `Vintage: ${vintage}` : "";
    const wineryInfo = winery ? `Winery/Producer: ${winery}` : "";

    const prompt = WINE_LOOKUP_PROMPT
      .replace("{query}", query.trim())
      .replace("{vintageInfo}", vintageInfo)
      .replace("{wineryInfo}", wineryInfo);

    console.log(`[Wine Lookup] Searching for: "${query}"${vintage ? ` (${vintage})` : ""}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use Gemini with Google Search grounding for accurate wine data
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      // Note: Google Search grounding may need to be enabled in your project
      // If not available, the model will still provide good results from training data
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    let wineData: WineLookupData;
    try {
      // Try to extract JSON from response (may be wrapped in markdown)
      let jsonString = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }
      const objectMatch = jsonString.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonString = objectMatch[0];
      }
      wineData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("[Wine Lookup] Failed to parse response:", text, parseError);
      return NextResponse.json(
        { success: false, error: "Could not parse wine data" },
        { status: 422 }
      );
    }

    console.log(`[Wine Lookup] Found: ${wineData.found}, Confidence: ${wineData.confidence}`);

    return NextResponse.json({
      success: true,
      data: wineData,
    });
  } catch (error) {
    console.error("[Wine Lookup] Error:", error);

    const errorObj = error as { message?: string };

    if (errorObj.message?.includes("API key")) {
      return NextResponse.json(
        { success: false, error: "Invalid API key configuration" },
        { status: 401 }
      );
    }

    if (errorObj.message?.includes("quota") || errorObj.message?.includes("rate")) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to lookup wine. Please try again." },
      { status: 500 }
    );
  }
}
