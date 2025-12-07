import { GoogleGenerativeAI } from "@google/generative-ai";
import { Wine } from "@/types/wine";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

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

export async function chatWithSommelier(
  message: string,
  wineContext?: Wine,
  conversationHistory?: { role: "user" | "model"; content: string }[]
) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let contextMessage = "";
  if (wineContext) {
    contextMessage = `\n\nThe user is currently viewing this wine from their collection:
- Name: ${wineContext.name}
- Winery: ${wineContext.winery}
- Vintage: ${wineContext.vintage}
- Grape: ${wineContext.grapeVariety}
- Region: ${wineContext.region}, ${wineContext.country}
- Price: $${wineContext.price}
${wineContext.rating ? `- User's Rating: ${wineContext.rating}/5 stars` : ""}
${wineContext.tastingNotes ? `- User's Tasting Notes: ${wineContext.tastingNotes}` : ""}

Consider this wine when answering their question.`;
  }

  const history = conversationHistory?.map((msg) => ({
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
  return response.text();
}
