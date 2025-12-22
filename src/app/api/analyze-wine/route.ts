import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const WINE_LABEL_PROMPT = `You are an expert sommelier and wine label analyst. Analyze this wine bottle label image and extract comprehensive information.

Return ONLY a valid JSON object with these fields (use null for any field you cannot determine):
{
  "name": "wine name (cuvée name if applicable)",
  "winery": "producer/winery/château/domaine name",
  "vintage": year as number or null,
  "grapeVariety": "grape variety or blend (e.g., 'Cabernet Sauvignon', 'Grenache, Syrah, Mourvèdre')",
  "region": "wine region (e.g., 'Napa Valley', 'Côtes du Rhône', 'Barossa Valley')",
  "country": "country of origin",
  "wineType": "red" | "white" | "rosé" | "sparkling" | "dessert" | "fortified" | "orange" or null,
  "classification": "quality classification if visible (e.g., 'Grand Cru', 'Reserva', 'Premier Cru', 'DOC', 'DOCG')" or null,
  "alcoholContent": alcohol percentage as number (e.g., 13.5) or null,
  "drinkingWindowStart": suggested year to start drinking (based on vintage and wine style) or null,
  "drinkingWindowEnd": suggested year by which to drink (based on aging potential) or null
}

Important guidelines:
- Return ONLY the JSON object, no other text or markdown
- The vintage must be a 4-digit year number, not a string
- For wineType, infer from:
  - Label color/design cues
  - Grape varieties (e.g., Chardonnay → white, Pinot Noir → typically red)
  - Region conventions (e.g., Champagne → sparkling, Sauternes → dessert)
  - Terms like "Brut", "Rosé", "Blanc", "Rouge", "Tinto", "Bianco"
- For drinkingWindow, estimate based on:
  - Wine type (whites typically drink younger than reds)
  - Quality level (Grand Cru ages longer)
  - Region (Bordeaux ages longer than Beaujolais)
  - Grape variety (Nebbiolo ages longer than Gamay)
- Be precise with wine terminology and regional naming conventions
- If the label shows multiple potential names, prefer the cuvée/wine name over the winery name`;

interface WineLabelData {
  name: string | null;
  winery: string | null;
  vintage: number | null;
  grapeVariety: string | null;
  region: string | null;
  country: string | null;
  wineType: "red" | "white" | "rosé" | "sparkling" | "dessert" | "fortified" | "orange" | null;
  classification: string | null;
  alcoholContent: number | null;
  drinkingWindowStart: number | null;
  drinkingWindowEnd: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured in environment variables");
      return NextResponse.json(
        { error: "Wine analysis service is not configured. Please set GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    if (typeof apiKey !== 'string' || apiKey.trim().length === 0 || apiKey === 'your_gemini_api_key_here') {
      console.error("GEMINI_API_KEY appears to be invalid or placeholder value");
      return NextResponse.json(
        { error: "Wine analysis service is misconfigured. Please check your GEMINI_API_KEY." },
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

    const { imageBase64, mimeType } = requestBody;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Data,
        },
      },
      { text: WINE_LABEL_PROMPT },
    ]);

    const response = await result.response;
    const text = response.text();

    let wineData: WineLabelData;
    try {
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
      console.error("Failed to parse Gemini response as JSON:", text, parseError);
      return NextResponse.json(
        { error: "Could not parse wine label data. Please fill in details manually.", rawResponse: text },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: wineData
    });
  } catch (error: unknown) {
    console.error("Wine analysis API error:", error);

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
      { error: "Failed to analyze wine label. Please fill in details manually." },
      { status: 500 }
    );
  }
}
