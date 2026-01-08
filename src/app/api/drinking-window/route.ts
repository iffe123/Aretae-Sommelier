import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV_PUBLIC_ERROR_MESSAGE, getServerEnv } from "@/lib/env";

const DRINKING_WINDOW_PROMPT = `You are an expert sommelier with deep knowledge of wine aging potential. Analyze the following wine and provide a precise drinking window recommendation.

Consider these factors:
1. **Grape variety aging potential** - Nebbiolo, Cabernet Sauvignon age longer than Gamay, Pinot Grigio
2. **Region and appellation** - Bordeaux Grand Cru ages longer than generic Bordeaux
3. **Quality classification** - Reserva, Gran Reserva, Grand Cru age longer
4. **Vintage quality** - Exceptional vintages age better
5. **Wine type** - Reds generally age longer than whites (except fine white Burgundy, Riesling)
6. **Producer reputation** - Top producers make more age-worthy wines
7. **Alcohol and structure** - Higher alcohol and tannin = longer aging potential

Return ONLY a valid JSON object:
{
  "drinkingWindowStart": year to start drinking (number),
  "drinkingWindowEnd": year to drink by (number),
  "peakYear": optimal drinking year (number),
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of the recommendation (1-2 sentences)"
}

Important:
- Return ONLY the JSON object, no markdown or other text
- Be realistic - most wines should be drunk within 5-10 years
- Only suggest 20+ year aging for truly exceptional wines (top Bordeaux, Barolo, etc.)
- Consider the current year for context`;

interface WineData {
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  wineType?: string;
  classification?: string;
  vivinoRating?: number;
  body?: string;
  price?: number;
}

interface DrinkingWindowResult {
  drinkingWindowStart: number;
  drinkingWindowEnd: number;
  peakYear: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
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

    const wine: WineData = requestBody.wine;

    if (!wine || !wine.vintage || !wine.grapeVariety) {
      return NextResponse.json(
        { error: "Wine data with vintage and grape variety is required" },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();

    // Build wine description for AI
    const wineDescription = [
      `Wine: ${wine.name || 'Unknown'}`,
      `Winery: ${wine.winery || 'Unknown'}`,
      `Vintage: ${wine.vintage}`,
      `Grape Variety: ${wine.grapeVariety}`,
      `Region: ${wine.region || 'Unknown'}, ${wine.country || 'Unknown'}`,
      wine.wineType ? `Type: ${wine.wineType}` : null,
      wine.classification ? `Classification: ${wine.classification}` : null,
      wine.vivinoRating ? `Vivino Rating: ${wine.vivinoRating}/5` : null,
      wine.body ? `Body: ${wine.body}` : null,
      wine.price ? `Price: ${wine.price} kr` : null,
      `Current Year: ${currentYear}`,
    ].filter(Boolean).join('\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      { text: DRINKING_WINDOW_PROMPT },
      { text: `\n\nWine to analyze:\n${wineDescription}` },
    ]);

    const response = await result.response;
    const text = response.text();

    let drinkingWindow: DrinkingWindowResult;
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
      drinkingWindow = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse drinking window response:", text, parseError);
      return NextResponse.json(
        { error: "Could not analyze drinking window. Please try again.", rawResponse: text },
        { status: 422 }
      );
    }

    // Validate the response
    if (
      typeof drinkingWindow.drinkingWindowStart !== 'number' ||
      typeof drinkingWindow.drinkingWindowEnd !== 'number' ||
      typeof drinkingWindow.peakYear !== 'number'
    ) {
      console.error("Invalid drinking window data:", drinkingWindow);
      return NextResponse.json(
        { error: "Invalid drinking window response from AI" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: drinkingWindow,
    });
  } catch (error: unknown) {
    console.error("Drinking window API error:", error);

    const errorObj = error as { message?: string };

    if (errorObj.message?.includes('API key')) {
      return NextResponse.json(
        { error: "Invalid Gemini API key." },
        { status: 401 }
      );
    }

    if (errorObj.message?.includes('quota') || errorObj.message?.includes('rate')) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze drinking window. Please try again." },
      { status: 500 }
    );
  }
}
