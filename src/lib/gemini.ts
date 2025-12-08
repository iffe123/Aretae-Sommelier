import { Wine } from "@/types/wine";

export async function chatWithSommelier(
  message: string,
  wineContext?: Wine,
  conversationHistory?: { role: "user" | "model"; content: string }[]
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      wineContext,
      conversationHistory,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to get response from sommelier");
  }

  const data = await response.json();
  return data.response;
}
