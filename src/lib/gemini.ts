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
}

export interface CellarData {
  wines: CellarWineSummary[];
  totalBottles: number;
  totalValue: number;
}

export interface WineLabelData {
  name: string | null;
  winery: string | null;
  vintage: number | null;
  grapeVariety: string | null;
  region: string | null;
  country: string | null;
}

export async function chatWithSommelier(
  message: string,
  wineContext?: Wine,
  conversationHistory?: { role: "user" | "model"; content: string }[],
  cellarData?: CellarData
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

export async function analyzeWineLabel(imageBase64: string, mimeType: string): Promise<WineLabelData> {
  const response = await fetch("/api/analyze-wine", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageBase64,
      mimeType,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to analyze wine label");
  }

  return data.data;
}
