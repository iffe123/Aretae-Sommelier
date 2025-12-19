import { NextRequest, NextResponse } from "next/server";
import {
  searchWines,
  getWineByName,
  getWineDetails,
  isVivinoError,
  type VivinoWine,
  type VivinoSearchResult,
} from "@/lib/vivino";

/**
 * Vivino Wine Lookup API Route
 *
 * POST /api/wine/vivino
 *
 * Actions:
 * - "search": Search for wines by query string
 * - "lookup": Find best match for a specific wine name + optional vintage
 * - "details": Get full details for a specific Vivino wine ID
 *
 * Request body:
 * {
 *   action: "search" | "lookup" | "details",
 *   query?: string,      // For search/lookup: wine name or search term
 *   vintage?: string,    // For lookup: optional vintage year
 *   wineId?: string,     // For details: Vivino wine ID
 *   limit?: number       // For search: max results (default: 10)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data?: VivinoWine | VivinoSearchResult,
 *   error?: string
 * }
 */

interface RequestBody {
  action: "search" | "lookup" | "details";
  query?: string;
  vintage?: string;
  wineId?: string;
  limit?: number;
}

interface SuccessResponse {
  success: true;
  data: VivinoWine | VivinoSearchResult;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: RequestBody = await request.json();
    const { action, query, vintage, wineId, limit = 10 } = body;

    // Validate action
    if (!action || !["search", "lookup", "details"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action. Use 'search', 'lookup', or 'details'.",
        },
        { status: 400 }
      );
    }

    // Handle search action
    if (action === "search") {
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Query parameter is required for search" },
          { status: 400 }
        );
      }

      const result = await searchWines(query.trim(), Math.min(limit, 50));

      if (isVivinoError(result)) {
        console.warn(`[Vivino API] Search error: ${result.code} - ${result.message}`);
        return NextResponse.json(
          { success: false, error: result.message, code: result.code },
          { status: result.code === "RATE_LIMITED" ? 429 : 500 }
        );
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Handle lookup action (search + return best match)
    if (action === "lookup") {
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Query parameter is required for lookup" },
          { status: 400 }
        );
      }

      const result = await getWineByName(query.trim(), vintage?.toString());

      if (isVivinoError(result)) {
        console.warn(`[Vivino API] Lookup error: ${result.code} - ${result.message}`);

        // NOT_FOUND is not really an error state - just return empty
        if (result.code === "NOT_FOUND") {
          return NextResponse.json(
            { success: false, error: result.message, code: result.code },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { success: false, error: result.message, code: result.code },
          { status: result.code === "RATE_LIMITED" ? 429 : 500 }
        );
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Handle details action
    if (action === "details") {
      if (!wineId || typeof wineId !== "string" || wineId.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "wineId parameter is required for details" },
          { status: 400 }
        );
      }

      const result = await getWineDetails(wineId.trim());

      if (isVivinoError(result)) {
        console.warn(`[Vivino API] Details error: ${result.code} - ${result.message}`);
        return NextResponse.json(
          { success: false, error: result.message, code: result.code },
          { status: result.code === "NOT_FOUND" ? 404 : result.code === "RATE_LIMITED" ? 429 : 500 }
        );
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Should never reach here due to validation above
    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Vivino API] Unexpected error:", error);

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
