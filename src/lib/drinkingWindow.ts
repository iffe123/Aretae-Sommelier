import { Wine } from "@/types/wine";

export interface DrinkingWindow {
  start: number;
  peak: number;
  end: number;
}

export type DrinkingStatus = "ready" | "approaching-peak" | "past-peak" | "aging";

export interface DrinkingWindowInfo extends DrinkingWindow {
  status: DrinkingStatus;
  statusLabel: string;
  statusEmoji: string;
}

export function getDrinkingWindow(wine: Wine): DrinkingWindow {
  const vintage = wine.vintage;
  const grape = wine.grapeVariety?.toLowerCase() || "";
  const region = wine.region?.toLowerCase() || "";

  // Default: drink within 5 years
  let yearsToStart = 0;
  let yearsToPeak = 2;
  let yearsToEnd = 5;

  // Age-worthy reds
  if (
    grape.includes("cabernet") ||
    grape.includes("nebbiolo") ||
    grape.includes("syrah")
  ) {
    yearsToStart = 3;
    yearsToPeak = 8;
    yearsToEnd = 20;
  }
  // Burgundy / Pinot Noir
  else if (
    grape.includes("pinot noir") ||
    region.includes("burgundy") ||
    region.includes("bourgogne")
  ) {
    yearsToStart = 3;
    yearsToPeak = 7;
    yearsToEnd = 15;
  }
  // Bordeaux
  else if (
    region.includes("bordeaux") ||
    region.includes("médoc") ||
    region.includes("medoc") ||
    region.includes("saint-émilion") ||
    region.includes("saint-emilion")
  ) {
    yearsToStart = 5;
    yearsToPeak = 10;
    yearsToEnd = 25;
  }
  // Barolo/Barbaresco
  else if (region.includes("barolo") || region.includes("barbaresco")) {
    yearsToStart = 5;
    yearsToPeak = 12;
    yearsToEnd = 30;
  }
  // White wines (most drink young)
  else if (
    grape.includes("chardonnay") ||
    grape.includes("sauvignon") ||
    grape.includes("riesling")
  ) {
    yearsToStart = 0;
    yearsToPeak = 2;
    yearsToEnd = 7;
  }
  // Champagne/Sparkling
  else if (grape.includes("champagne") || region.includes("champagne")) {
    yearsToStart = 0;
    yearsToPeak = 5;
    yearsToEnd = 15;
  }

  return {
    start: vintage + yearsToStart,
    peak: vintage + yearsToPeak,
    end: vintage + yearsToEnd,
  };
}

export function getDrinkingWindowInfo(wine: Wine): DrinkingWindowInfo {
  const window = getDrinkingWindow(wine);
  const currentYear = new Date().getFullYear();

  let status: DrinkingStatus;
  let statusLabel: string;
  let statusEmoji: string;

  if (currentYear < window.start) {
    status = "aging";
    statusLabel = "Still Aging";
    statusEmoji = "⏳";
  } else if (currentYear > window.end) {
    status = "past-peak";
    statusLabel = "Past Peak";
    statusEmoji = "🔴";
  } else if (currentYear >= window.peak - 1 && currentYear <= window.peak + 1) {
    status = "approaching-peak";
    statusLabel = "At Peak";
    statusEmoji = "🟡";
  } else {
    // currentYear is within window but not at peak
    status = "ready";
    statusLabel = "Ready Now";
    statusEmoji = "🟢";
  }

  return {
    ...window,
    status,
    statusLabel,
    statusEmoji,
  };
}

export function formatDrinkingWindow(window: DrinkingWindow): string {
  return `${window.start} - ${window.end}`;
}

export function getWinesByDrinkingStatus(
  wines: Wine[]
): Record<DrinkingStatus, Wine[]> {
  const result: Record<DrinkingStatus, Wine[]> = {
    ready: [],
    "approaching-peak": [],
    "past-peak": [],
    aging: [],
  };

  for (const wine of wines) {
    const info = getDrinkingWindowInfo(wine);
    result[info.status].push(wine);
  }

  return result;
}
