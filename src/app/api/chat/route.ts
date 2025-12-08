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
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured");
      return NextResponse.json(
        { error: "Sommelier service is not configured" },
        { status: 500 }
      );
    }

    const { message, wineContext, conversationHistory } = await request.json();

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
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to get response from sommelier" },
      { status: 500 }
    );
  }
}
