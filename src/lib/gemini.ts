import { Wine } from "@/types/wine";

export interface CellarWineSummary {
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

export interface CellarData {
  wines: CellarWineSummary[];
  totalBottles: number;
  totalValue: number;
}

export async function chatWithSommelier(
  message: string,
  wineContext?: Wine,
  conversationHistory?: { role: "user" | "model"; content: string }[],
  cellarData?: CellarData,
  idToken?: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      wineContext,
      conversationHistory,
      cellarData,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to get response from sommelier");
  }

  const data = await response.json();
  return data.response;
}
