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

// Vivino search page URL (for fallback when API search doesn't work)
export const VIVINO_SEARCH_URL = "https://www.vivino.com/search/wines";

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
function parseSearchResponse(data: Record<string, unknown>): VivinoWine[] {
  const wines: VivinoWine[] = [];

  try {
    // The search endpoint returns matches in wine_matches or vintage_matches
    // The explore endpoint returns matches in explore_vintage.matches
    // Try search format first, then fall back to explore format
    let matches: Array<Record<string, unknown>> = [];

    // Search endpoint format: wine_matches array
    const wineMatches = data.wine_matches as Array<Record<string, unknown>> | undefined;
    if (wineMatches && wineMatches.length > 0) {
      matches = wineMatches;
    } else {
      // Explore endpoint format: explore_vintage.matches
      const exploreVintage = data.explore_vintage as Record<string, unknown> | undefined;
      matches = (exploreVintage?.matches as Array<Record<string, unknown>>) || [];
    }

    for (const match of matches) {
      // Search endpoint: wine directly in match.wine
      // Explore endpoint: wine nested in match.vintage.wine
      const vintage = match.vintage as Record<string, unknown> | undefined;
      const wine = (match.wine as Record<string, unknown> | undefined) ||
                   (vintage?.wine as Record<string, unknown> | undefined);

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
    console.error("[Vivino] Error parsing search response:", error);
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
 * Search for wines using Vivino's explore endpoint
 *
 * Note: Vivino's text search API (/search/search) has been deprecated.
 * This function uses the explore endpoint which provides wine browsing
 * with filters but limited text search capability.
 *
 * @param query - Wine name or search term (used for client-side filtering)
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
    console.log(`[Vivino] Searching for: "${query}"`);

    // Use the explore endpoint - the search endpoint (/search/search) was deprecated by Vivino
    // The explore endpoint returns top-rated wines; we'll filter client-side by query terms
    const url = `${VIVINO_API_BASE}/explore/explore?country_code=global&currency_code=USD&min_rating=1&order_by=ratings_count&order=desc&page=1&per_page=${Math.min(limit * 5, 100)}`;

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
        message: `Vivino API returned ${response.status}. The search feature may be temporarily unavailable.`,
        code: "API_ERROR",
      };
    }

    const data = await response.json();
    let wines = parseSearchResponse(data);

    // Client-side filtering since explore endpoint doesn't support text search
    if (query && wines.length > 0) {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      wines = wines.filter(wine => {
        const searchableText = `${wine.name} ${wine.winery} ${wine.region} ${wine.country} ${wine.grapeVariety || ''}`.toLowerCase();
        return queryTerms.some(term => searchableText.includes(term));
      });
    }

    // If no matches found with filtering, return a helpful error
    if (wines.length === 0) {
      console.log(`[Vivino] No matches found for "${query}" - Vivino search API is limited`);
      return {
        message: `No wines found matching "${query}". Vivino's search API is limited - try searching directly on Vivino.`,
        code: "NOT_FOUND",
      };
    }

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
 * Get detailed wine information by Vivino vintage ID
 *
 * Note: Uses the vintages endpoint as the wines endpoint was deprecated.
 *
 * @param vintageId - Vivino vintage ID (from explore results)
 * @returns Wine details or error
 */
export async function getWineDetails(vintageId: string): Promise<VivinoWine | VivinoError> {
  const cacheKey = `vintage:${vintageId}`;
  const cached = getCached<VivinoWine>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use vintages endpoint - the wines endpoint was deprecated by Vivino
    const url = `${VIVINO_API_BASE}/vintages/${vintageId}`;

    console.log(`[Vivino] Fetching vintage details: ${vintageId}`);

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
    const wine = parseVintageDetailsResponse(data);

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
 * Parse Vivino's wine details response (legacy - kept for compatibility)
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
 * Parse Vivino's vintage details response (from /api/vintages/{id} endpoint)
 */
function parseVintageDetailsResponse(data: Record<string, unknown>): VivinoWine | null {
  try {
    const vintage = data.vintage as Record<string, unknown> | undefined;
    if (!vintage) return null;

    const wine = vintage.wine as Record<string, unknown> | undefined;
    if (!wine) return null;

    const winery = wine.winery as Record<string, unknown> | undefined;
    const region = wine.region as Record<string, unknown> | undefined;
    const country = region?.country as Record<string, unknown> | undefined;
    const style = wine.style as Record<string, unknown> | undefined;
    const statistics = vintage.statistics as Record<string, unknown> | undefined;

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

    // Get vintage year
    const year = vintage.year as number | undefined;

    return {
      id: String(vintage.id || ""),
      name: (wine.name as string) || "",
      winery: (winery?.name as string) || "",
      region: (region?.name as string) || "",
      country: (country?.name as string) || "",
      grapeVariety: grapeNames,
      vintage: year ? String(year) : undefined,
      averageRating: (statistics?.ratings_average as number) || (statistics?.wine_ratings_average as number) || 0,
      ratingsCount: (statistics?.ratings_count as number) || (statistics?.wine_ratings_count as number) || 0,
      imageUrl: ((vintage.image as Record<string, unknown>)?.location as string) ||
                ((wine.image as Record<string, unknown>)?.location as string) || undefined,
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
    console.error("[Vivino] Error parsing vintage details:", error);
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

/**
 * Generate a Vivino search URL for manual lookup
 *
 * Since Vivino's search API is limited, this provides a direct link
 * to search on Vivino's website.
 *
 * @param query - Wine name or search term
 * @returns URL to Vivino search page
 */
export function getVivinoSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `${VIVINO_SEARCH_URL}?q=${encodedQuery}`;
}
