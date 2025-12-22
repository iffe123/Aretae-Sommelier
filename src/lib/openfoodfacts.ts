/**
 * Open Food Facts Wine Lookup Service
 *
 * Uses the free, open-source Open Food Facts database to look up wines by barcode.
 * This is particularly useful for retail wines that have UPC/EAN barcodes.
 *
 * API Documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

import { WineType } from "@/types/wine";

// Open Food Facts product interface (wine-relevant fields)
export interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  origins?: string;
  countries?: string;
  manufacturing_places?: string;
  categories_tags?: string[];
  alcohol_value?: number;
  image_url?: string;
  image_front_url?: string;
  generic_name?: string;
  quantity?: string;
}

export interface OFFResponse {
  status: 0 | 1; // 0 = not found, 1 = found
  status_verbose: string;
  product?: OFFProduct;
}

export interface OFFSearchResponse {
  count: number;
  page: number;
  page_size: number;
  products: OFFProduct[];
}

export interface OFFWineData {
  name: string;
  winery: string;
  country: string;
  region: string;
  wineType?: WineType;
  alcoholContent?: number;
  imageUrl?: string;
}

/**
 * Look up a product by barcode (UPC/EAN)
 */
export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    // Clean barcode (remove any non-numeric characters)
    const cleanBarcode = barcode.replace(/\D/g, "");

    if (!cleanBarcode || cleanBarcode.length < 8) {
      console.warn("[OFF] Invalid barcode format:", barcode);
      return null;
    }

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`,
      {
        headers: {
          "User-Agent": "AretaeSommelier/1.0 (https://github.com/aretae-sommelier)",
        },
      }
    );

    if (!response.ok) {
      console.error(`[OFF] API error: ${response.status}`);
      return null;
    }

    const data: OFFResponse = await response.json();

    if (data.status !== 1 || !data.product) {
      console.log(`[OFF] Product not found: ${cleanBarcode}`);
      return null;
    }

    return data.product;
  } catch (error) {
    console.error("[OFF] Lookup error:", error);
    return null;
  }
}

/**
 * Search for wines by name
 */
export async function searchWines(query: string, limit: number = 10): Promise<OFFProduct[]> {
  try {
    const params = new URLSearchParams({
      search_terms: query,
      categories_tags: "wines",
      json: "1",
      page_size: String(limit),
      fields: "code,product_name,brands,origins,countries,categories_tags,alcohol_value,image_url,image_front_url",
    });

    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?${params}`,
      {
        headers: {
          "User-Agent": "AretaeSommelier/1.0 (https://github.com/aretae-sommelier)",
        },
      }
    );

    if (!response.ok) {
      console.error(`[OFF] Search error: ${response.status}`);
      return [];
    }

    const data: OFFSearchResponse = await response.json();
    return data.products || [];
  } catch (error) {
    console.error("[OFF] Search error:", error);
    return [];
  }
}

/**
 * Determine wine type from Open Food Facts categories
 */
function inferWineType(categories: string[]): WineType | undefined {
  if (!categories || categories.length === 0) return undefined;

  const categoryString = categories.join(" ").toLowerCase();

  // Check for specific wine types
  if (categoryString.includes("sparkling") || categoryString.includes("champagne") || categoryString.includes("prosecco") || categoryString.includes("cava")) {
    return "sparkling";
  }
  if (categoryString.includes("rose") || categoryString.includes("rosé") || categoryString.includes("rosado")) {
    return "rosé";
  }
  if (categoryString.includes("white-wine") || categoryString.includes("vin-blanc") || categoryString.includes("vino-bianco")) {
    return "white";
  }
  if (categoryString.includes("red-wine") || categoryString.includes("vin-rouge") || categoryString.includes("vino-rosso") || categoryString.includes("tinto")) {
    return "red";
  }
  if (categoryString.includes("dessert") || categoryString.includes("sweet-wine") || categoryString.includes("sauternes") || categoryString.includes("ice-wine")) {
    return "dessert";
  }
  if (categoryString.includes("fortified") || categoryString.includes("port") || categoryString.includes("sherry") || categoryString.includes("madeira")) {
    return "fortified";
  }
  if (categoryString.includes("orange-wine")) {
    return "orange";
  }

  return undefined;
}

/**
 * Extract country from Open Food Facts origins/countries fields
 */
function extractCountry(product: OFFProduct): string {
  // Try countries field first
  if (product.countries) {
    // Often contains comma-separated list, take first
    const countries = product.countries.split(",")[0].trim();
    // Remove language prefix (e.g., "en:France" -> "France")
    return countries.replace(/^[a-z]{2}:/, "");
  }

  // Fall back to origins
  if (product.origins) {
    const origin = product.origins.split(",")[0].trim();
    return origin.replace(/^[a-z]{2}:/, "");
  }

  // Try manufacturing places
  if (product.manufacturing_places) {
    return product.manufacturing_places.split(",")[0].trim();
  }

  return "";
}

/**
 * Map Open Food Facts product to our wine data format
 */
export function mapOFFToWineData(product: OFFProduct): OFFWineData {
  return {
    name: product.product_name || product.generic_name || "",
    winery: product.brands || "",
    country: extractCountry(product),
    region: product.origins || product.manufacturing_places || "",
    wineType: inferWineType(product.categories_tags || []),
    alcoholContent: product.alcohol_value,
    imageUrl: product.image_front_url || product.image_url,
  };
}

/**
 * Check if a product is a wine (vs other alcoholic beverages)
 */
export function isWineProduct(product: OFFProduct): boolean {
  const categories = product.categories_tags || [];
  const categoryString = categories.join(" ").toLowerCase();

  // Must contain wine-related categories
  if (categoryString.includes("wine") || categoryString.includes("vin") || categoryString.includes("vino")) {
    return true;
  }

  // Check for specific wine types
  const wineTerms = ["champagne", "prosecco", "cava", "bordeaux", "burgundy", "chianti", "rioja", "barolo"];
  return wineTerms.some((term) => categoryString.includes(term));
}
