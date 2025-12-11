import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

const WINE_LABEL_PROMPT = `Analyze this wine bottle label image and extract the following information. Return ONLY a valid JSON object with these fields (use null for any field you cannot determine):
{
  "name": "wine name",
  "winery": "producer/winery name",
  "vintage": year as number or null,
  "grapeVariety": "grape type(s)",
  "region": "wine region",
  "country": "country of origin"
}

Important:
- Return ONLY the JSON object, no other text
- If you can't read the label clearly, still try to extract what you can
- The vintage should be a 4-digit year number, not a string
- Be as accurate as possible with wine terminology`;

interface WineLabelData {
  name: string | null;
  winery: string | null;
  vintage: number | null;
  grapeVariety: string | null;
  region: string | null;
  country: string | null;
}

export async function POST(request: NextRequest) {
  // Check rate limit
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`analyze:${clientIP}`);

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

    // Remove data URL prefix if present
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    // Parse the JSON response
    let wineData: WineLabelData;
    try {
      // Try to extract JSON from the response (handle potential markdown code blocks)
      let jsonString = text;

      // Remove markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }

      // Try to find JSON object in the response
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
