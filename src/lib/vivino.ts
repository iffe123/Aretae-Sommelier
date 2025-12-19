/**
 * Vivino Wine Lookup Service
 *
 * This module provides functions to search and retrieve wine data from Vivino's
 * unofficial API. Note: This is an unofficial API that may change without notice.
 *
 * Important: These API calls must be made server-side as Vivino blocks CORS.
 */

// Types for Vivino API responses
export interface VivinoWine {
  id: string;
  name: string;
  winery: string;
  region: string;
  country: string;
  grapeVariety?: string;
  vintage?: string;
  averageRating: number; // 1-5 scale
  ratingsCount: number;
  price?: {
    amount: number;
    currency: string;
  };
  imageUrl?: string;
  style?: {
    body?: string; // Light, Medium, Full-bodied
    acidity?: string; // Low, Medium, High
    tannins?: string; // Low, Medium, High
  };
  foodPairings?: string[];
  description?: string;
  vivinoUrl?: string;
}

export interface VivinoSearchResult {
  wines: VivinoWine[];
  totalCount: number;
}

export interface VivinoError {
  message: string;
  code: "RATE_LIMITED" | "NOT_FOUND" | "API_ERROR" | "NETWORK_ERROR" | "PARSE_ERROR";
}

// Headers required to access Vivino API
const VIVINO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
};

// Base URL for Vivino API
const VIVINO_API_BASE = "https://www.vivino.com/api";

// Request delay to avoid rate limiting (ms)
const REQUEST_DELAY = 500;

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

/**
 * Add a small delay between requests to avoid rate limiting
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Vivino's explore/search response into our clean interface
 */
function parseExploreResponse(data: Record<string, unknown>): VivinoWine[] {
  const wines: VivinoWine[] = [];

  try {
    // The explore endpoint returns matches in explore_vintage.matches
    const exploreVintage = data.explore_vintage as Record<string, unknown> | undefined;
    const matches = (exploreVintage?.matches as Array<Record<string, unknown>>) || [];

    for (const match of matches) {
      const vintage = match.vintage as Record<string, unknown> | undefined;
      const wine = vintage?.wine as Record<string, unknown> | undefined;

      if (!wine) continue;

      const winery = wine.winery as Record<string, unknown> | undefined;
      const region = wine.region as Record<string, unknown> | undefined;
      const country = region?.country as Record<string, unknown> | undefined;
      const style = wine.style as Record<string, unknown> | undefined;
      const statistics = wine.statistics as Record<string, unknown> | undefined;
      const price = match.price as Record<string, unknown> | undefined;

      // Parse food pairings if available
      const foodPairings: string[] = [];
      const foods = style?.food as Array<Record<string, unknown>> | undefined;
      if (foods) {
        for (const food of foods) {
          const name = food.name as string | undefined;
          if (name) foodPairings.push(name);
        }
      }

      // Parse grape varieties
      const grapes = wine.grapes as Array<Record<string, unknown>> | undefined;
      const grapeNames = grapes
        ?.map((g) => g.name as string)
        .filter(Boolean)
        .join(", ");

      // Build wine URL
      const wineSlug = wine.slug as string | undefined;
      const vivinoUrl = wineSlug ? `https://www.vivino.com/w/${wine.id}` : undefined;

      wines.push({
        id: String(wine.id || ""),
        name: (wine.name as string) || "",
        winery: (winery?.name as string) || "",
        region: (region?.name as string) || "",
        country: (country?.name as string) || "",
        grapeVariety: grapeNames,
        vintage: vintage?.year ? String(vintage.year) : undefined,
        averageRating: (statistics?.wine_ratings_average as number) || 0,
        ratingsCount: (statistics?.wine_ratings_count as number) || 0,
        price: price
          ? {
              amount: (price.amount as number) || 0,
              currency: (price.currency as Record<string, unknown>)?.code as string || "SEK",
            }
          : undefined,
        imageUrl: ((vintage?.image as Record<string, unknown>)?.location as string) || ((wine.image as Record<string, unknown>)?.location as string),
        style: style
          ? {
              body: getBodyDescription(style.body as number | undefined),
              acidity: getAcidityDescription(style.acidity as number | undefined),
              tannins: style.tannin
                ? getTanninDescription(style.tannin as number | undefined)
                : undefined,
            }
          : undefined,
        foodPairings: foodPairings.length > 0 ? foodPairings : undefined,
        description: (style?.description as string) || undefined,
        vivinoUrl,
      });
    }
  } catch (error) {
    console.error("[Vivino] Error parsing explore response:", error);
  }

  return wines;
}

/**
 * Convert body score (1-5) to description
 */
function getBodyDescription(score: number | undefined): string | undefined {
  if (!score) return undefined;
  if (score <= 2) return "Light-bodied";
  if (score <= 3.5) return "Medium-bodied";
  return "Full-bodied";
}

/**
 * Convert acidity score (1-5) to description
 */
function getAcidityDescription(score: number | undefined): string | undefined {
  if (!score) return undefined;
  if (score <= 2) return "Low";
  if (score <= 3.5) return "Medium";
  return "High";
}

/**
 * Convert tannin score (1-5) to description
 */
function getTanninDescription(score: number | undefined): string | undefined {
  if (!score) return undefined;
  if (score <= 2) return "Low";
  if (score <= 3.5) return "Medium";
  return "High";
}

/**
 * Search for wines by name/query
 *
 * @param query - Wine name or search term
 * @param limit - Maximum number of results (default: 10)
 * @returns Search results with matching wines
 */
export async function searchWines(
  query: string,
  limit: number = 10
): Promise<VivinoSearchResult | VivinoError> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = getCached<VivinoSearchResult>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `${VIVINO_API_BASE}/explore/explore?q=${encodedQuery}&limit=${limit}`;

    console.log(`[Vivino] Searching for: "${query}"`);

    const response = await fetch(url, {
      method: "GET",
      headers: VIVINO_HEADERS,
    });

    if (response.status === 429) {
      console.warn("[Vivino] Rate limited");
      return { message: "Rate limited by Vivino. Please try again later.", code: "RATE_LIMITED" };
    }

    if (!response.ok) {
      console.error(`[Vivino] API error: ${response.status} ${response.statusText}`);
      return {
        message: `Vivino API returned ${response.status}`,
        code: "API_ERROR",
      };
    }

    const data = await response.json();
    const wines = parseExploreResponse(data);

    const result: VivinoSearchResult = {
      wines: wines.slice(0, limit),
      totalCount: wines.length,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[Vivino] Network error:", error);
    return {
      message: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    };
  }
}

/**
 * Get detailed wine information by Vivino wine ID
 *
 * @param wineId - Vivino wine ID
 * @returns Wine details or error
 */
export async function getWineDetails(wineId: string): Promise<VivinoWine | VivinoError> {
  const cacheKey = `wine:${wineId}`;
  const cached = getCached<VivinoWine>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `${VIVINO_API_BASE}/wines/${wineId}`;

    console.log(`[Vivino] Fetching wine details: ${wineId}`);

    await delay(REQUEST_DELAY);

    const response = await fetch(url, {
      method: "GET",
      headers: VIVINO_HEADERS,
    });

    if (response.status === 429) {
      return { message: "Rate limited by Vivino. Please try again later.", code: "RATE_LIMITED" };
    }

    if (response.status === 404) {
      return { message: "Wine not found on Vivino", code: "NOT_FOUND" };
    }

    if (!response.ok) {
      return {
        message: `Vivino API returned ${response.status}`,
        code: "API_ERROR",
      };
    }

    const data = await response.json();
    const wine = parseWineDetailsResponse(data);

    if (wine) {
      setCache(cacheKey, wine);
      return wine;
    }

    return { message: "Could not parse wine data", code: "PARSE_ERROR" };
  } catch (error) {
    console.error("[Vivino] Network error:", error);
    return {
      message: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    };
  }
}

/**
 * Parse Vivino's wine details response
 */
function parseWineDetailsResponse(data: Record<string, unknown>): VivinoWine | null {
  try {
    const wine = data.wine as Record<string, unknown> | undefined;
    if (!wine) return null;

    const winery = wine.winery as Record<string, unknown> | undefined;
    const region = wine.region as Record<string, unknown> | undefined;
    const country = region?.country as Record<string, unknown> | undefined;
    const style = wine.style as Record<string, unknown> | undefined;
    const statistics = wine.statistics as Record<string, unknown> | undefined;
    const vintage = data.vintage as Record<string, unknown> | undefined;

    // Parse food pairings
    const foodPairings: string[] = [];
    const foods = style?.food as Array<Record<string, unknown>> | undefined;
    if (foods) {
      for (const food of foods) {
        const name = food.name as string | undefined;
        if (name) foodPairings.push(name);
      }
    }

    // Parse grapes
    const grapes = wine.grapes as Array<Record<string, unknown>> | undefined;
    const grapeNames = grapes
      ?.map((g) => g.name as string)
      .filter(Boolean)
      .join(", ");

    return {
      id: String(wine.id || ""),
      name: (wine.name as string) || "",
      winery: (winery?.name as string) || "",
      region: (region?.name as string) || "",
      country: (country?.name as string) || "",
      grapeVariety: grapeNames,
      vintage: vintage?.year ? String(vintage.year) : undefined,
      averageRating: (statistics?.wine_ratings_average as number) || 0,
      ratingsCount: (statistics?.wine_ratings_count as number) || 0,
      imageUrl: ((wine.image as Record<string, unknown>)?.location as string) || undefined,
      style: style
        ? {
            body: getBodyDescription(style.body as number | undefined),
            acidity: getAcidityDescription(style.acidity as number | undefined),
            tannins: style.tannin
              ? getTanninDescription(style.tannin as number | undefined)
              : undefined,
          }
        : undefined,
      foodPairings: foodPairings.length > 0 ? foodPairings : undefined,
      description: (style?.description as string) || undefined,
      vivinoUrl: `https://www.vivino.com/w/${wine.id}`,
    };
  } catch (error) {
    console.error("[Vivino] Error parsing wine details:", error);
    return null;
  }
}

/**
 * Convenience function to search for a wine by name and return the best match
 *
 * @param name - Wine name
 * @param vintage - Optional vintage year to filter results
 * @returns Best matching wine or error
 */
export async function getWineByName(
  name: string,
  vintage?: string
): Promise<VivinoWine | VivinoError> {
  // Build search query - combine name with vintage if provided
  const query = vintage ? `${name} ${vintage}` : name;

  const searchResult = await searchWines(query, 5);

  if ("code" in searchResult) {
    return searchResult; // Return error
  }

  if (searchResult.wines.length === 0) {
    return { message: `No wines found matching "${name}"`, code: "NOT_FOUND" };
  }

  // If vintage is specified, try to find an exact vintage match
  if (vintage) {
    const vintageMatch = searchResult.wines.find((w) => w.vintage === vintage);
    if (vintageMatch) {
      return vintageMatch;
    }
  }

  // Return the first (best) match
  return searchResult.wines[0];
}

/**
 * Check if a result is an error
 */
export function isVivinoError(
  result: VivinoWine | VivinoSearchResult | VivinoError
): result is VivinoError {
  return "code" in result && "message" in result;
}
