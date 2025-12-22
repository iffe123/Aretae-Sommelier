# Design Document: Wine Data Import Options

## Overview

This document analyzes alternative ways to extract wine information from databases and APIs to make it easier for users to add wines to their cellar. The goal is to minimize manual data entry while providing accurate wine details.

---

## Current Implementation

### 1. Gemini Vision AI (Label Analysis)
**Status**: ✅ Working well

When users upload a photo of a wine label, Gemini AI extracts:
- Wine name, winery, vintage
- Grape variety, region, country
- Wine type (red, white, rosé, etc.)
- Classification (Grand Cru, Reserva, etc.)
- Alcohol content
- AI-estimated drinking window

**Pros:**
- Works with any wine (doesn't need database entry)
- Extracts classification and drinking window intelligently
- No external API dependencies
- Privacy-friendly (image processed, not stored externally)

**Cons:**
- Requires good photo quality
- May struggle with damaged or artistic labels
- No community ratings or price data

### 2. Vivino API (Unofficial Scraping)
**Status**: ⚠️ Unreliable (blocked by WAF)

The current implementation scrapes Vivino's internal API endpoints, which are frequently blocked.

**Data available** (when working):
- Wine ratings and review counts
- Wine characteristics (body, acidity, tannins)
- Food pairings
- Price information
- Wine images

**Cons:**
- Blocked by Vivino's WAF (Web Application Firewall)
- No official API support
- May violate Terms of Service
- Unreliable for production use

---

## Alternative Data Sources

### Option 1: Barcode/UPC Scanning 📱
**Effort**: Medium (4-6 hours) | **Reliability**: High

Many wine bottles have UPC/EAN barcodes. We can:
1. Add barcode scanner using device camera
2. Look up wine data from barcode databases

**Implementation:**
```typescript
// Use a library like quagga2 or html5-qrcode
import { Html5QrcodeScanner } from "html5-qrcode";

// Barcode lookup via Open Food Facts API (free, open-source)
const lookupBarcode = async (barcode: string) => {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
  );
  const data = await response.json();
  return {
    name: data.product?.product_name,
    brand: data.product?.brands,
    origin: data.product?.origins,
    categories: data.product?.categories,
  };
};
```

**APIs for barcode lookup:**

| Service | Cost | Wine Coverage | Notes |
|---------|------|---------------|-------|
| Open Food Facts | Free | Medium | Open-source, community-driven |
| UPCitemdb | Free tier | Low | General products, few wines |
| Barcode Lookup API | $29/mo | Medium | Commercial service |
| Open Wine Database | Free | High (wine-specific) | Uses barcodes + crowdsourced |

**Pros:**
- Very fast data entry (just scan)
- High accuracy when product exists
- Works offline with cached database

**Cons:**
- Not all wines have barcodes
- Older/boutique wines often missing
- Requires camera access

---

### Option 2: Open Food Facts Integration 🥫
**Effort**: Low (2-3 hours) | **Reliability**: Medium-High

Open Food Facts has a dedicated wine section with community-contributed data.

**API Example:**
```typescript
// Search wines by name
const searchWines = async (query: string) => {
  const response = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&categories_tags=wines&json=1`
  );
  return response.json();
};

// Response includes:
// - product_name, brands
// - origins, manufacturing_places
// - categories (wine type)
// - alcohol_value
// - image_url
```

**Pros:**
- Completely free and open-source
- No rate limits
- Good wine coverage in Europe
- Includes barcode data

**Cons:**
- Coverage varies by region
- Data quality depends on community
- No ratings or reviews

---

### Option 3: Wine-Searcher API 🔍
**Effort**: Low (2-3 hours) | **Reliability**: High

Wine-Searcher is the largest wine price comparison database.

**API Access:**
- Requires commercial license ($)
- Contact: api@wine-searcher.com

**Data available:**
- Wine name, producer, region, vintage
- Current prices from multiple retailers
- Professional critic scores
- Grape varieties
- Production details

**Pros:**
- Most comprehensive wine database
- Professional-grade data
- Includes prices from multiple markets

**Cons:**
- Commercial/expensive
- May be overkill for personal use

---

### Option 4: Enhanced AI with Web Search 🤖
**Effort**: Low (1-2 hours) | **Reliability**: High

Use Gemini's web search capabilities to find wine information.

**Implementation:**
```typescript
// Enhanced prompt that instructs Gemini to search the web
const WINE_LOOKUP_PROMPT = `You are a wine expert. Search the web and find comprehensive information about this wine:

Wine: "${wineName}"
${vintage ? `Vintage: ${vintage}` : ''}
${winery ? `Winery: ${winery}` : ''}

Return a JSON object with:
{
  "name": "full wine name",
  "winery": "producer name",
  "region": "wine region",
  "country": "country",
  "grapeVariety": "grape varieties",
  "vivinoRating": rating from 1-5 if available,
  "criticScore": professional critic score if available,
  "price": estimated price in USD,
  "body": "light/medium/full",
  "drinkingWindow": "2024-2030",
  "foodPairings": ["pairing1", "pairing2"],
  "description": "brief description"
}
`;

// Use Gemini with grounding (web search)
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  tools: [{ googleSearch: {} }]  // Enable web search
});
```

**Pros:**
- Accesses multiple sources (Vivino, Wine-Searcher, etc.)
- Works with any wine
- Gets current ratings and prices
- No additional APIs needed

**Cons:**
- Slightly slower (web search overhead)
- Results may vary
- Requires internet access

---

### Option 5: CellarTracker Integration 🍷
**Effort**: Medium (3-4 hours) | **Reliability**: High

CellarTracker is the largest community wine cellar database with 8M+ wines.

**Access Methods:**
1. **Public API** (limited): Basic wine search
2. **User Export**: Users can import their existing CellarTracker data

**CSV Import Feature:**
```typescript
// Allow users to import from CellarTracker CSV export
interface CellarTrackerWine {
  Wine: string;
  Vintage: string;
  Producer: string;
  Country: string;
  Region: string;
  Varietal: string;
  Score: string;  // CT rating
  Quantity: string;
  Location: string;
}

const importCellarTracker = (csvData: string): WineFormData[] => {
  // Parse CSV and map to our wine format
};
```

**Pros:**
- Huge community database
- Users may already have data there
- Good ratings from community

**Cons:**
- No official public API
- Requires user to export manually
- Ratings are community-based (not professional)

---

### Option 6: Vivino via Proxy/Alternative Endpoints 🔄
**Effort**: Medium (3-4 hours) | **Reliability**: Medium

Since direct Vivino access is blocked, alternatives:

**A. Use a CORS proxy service:**
```typescript
const PROXY_URL = "https://api.allorigins.win/raw?url=";
const vivinoSearch = async (query: string) => {
  const targetUrl = `https://www.vivino.com/api/search/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(PROXY_URL + encodeURIComponent(targetUrl));
  return response.json();
};
```

**B. Mobile app API endpoints:**
Vivino's mobile app uses different endpoints that may be less restricted.

**C. Scraping service:**
Use services like ScraperAPI or Bright Data for reliable access.

**Pros:**
- Access to Vivino's rich data
- Community ratings and reviews
- Food pairings

**Cons:**
- May still be blocked
- Proxy services may have costs
- Ethically questionable

---

### Option 7: Build Community Wine Database 👥
**Effort**: High (ongoing) | **Reliability**: Grows over time

Create a shared wine database from user submissions.

**Implementation:**
```typescript
// When user adds a wine, optionally contribute to shared database
interface SharedWineEntry {
  name: string;
  winery: string;
  vintage: number;
  region: string;
  country: string;
  grapeVariety: string;
  wineType: WineType;
  // Aggregate data from multiple users
  avgRating: number;
  ratingCount: number;
  avgPrice: number;
  priceCount: number;
  lastUpdated: Date;
}

// Search shared database before external APIs
const searchSharedDatabase = async (query: string) => {
  const wines = await db.collection("sharedWines")
    .where("searchTerms", "array-contains", query.toLowerCase())
    .limit(10)
    .get();
  return wines;
};
```

**Pros:**
- No external dependencies
- Grows with user base
- Complete control over data

**Cons:**
- Empty at start
- Requires user opt-in
- Moderation needed

---

## Recommended Implementation Strategy

### Phase 1: Quick Wins (Immediate)
1. **✅ Keep Gemini Vision AI** - Already working well
2. **Add Gemini Web Search** - Easy enhancement for text-based lookup
3. **Graceful Vivino fallback** - Keep trying but don't depend on it

### Phase 2: Enhanced Data Entry (1-2 weeks)
4. **Add Barcode Scanner** - Great for store-bought wines
5. **Integrate Open Food Facts** - Free backup data source
6. **CSV Import from CellarTracker** - For users with existing collections

### Phase 3: Long-term (1+ month)
7. **Build shared wine database** - Crowdsource from users
8. **Explore commercial APIs** - If usage grows

---

## Implementation: Gemini Web Search Enhancement

The quickest improvement is to enhance the existing Gemini integration with web search capabilities.

### API Route: `/api/wine/lookup`

```typescript
// src/app/api/wine/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const WINE_LOOKUP_PROMPT = `You are an expert sommelier with access to comprehensive wine databases. 
Find information about this wine and return ONLY a valid JSON object.

Wine Query: "{query}"
{vintage ? "Vintage: {vintage}" : ""}

Search for this wine online and return:
{
  "found": true/false,
  "confidence": "high"/"medium"/"low",
  "name": "official wine name",
  "winery": "producer/château name",
  "region": "wine region",
  "country": "country of origin",
  "grapeVariety": "grape varieties",
  "wineType": "red"/"white"/"rosé"/"sparkling"/"dessert"/"fortified"/"orange",
  "vintage": year as number or null,
  "rating": community rating (1-5 scale) or null,
  "ratingsCount": number of ratings or null,
  "price": {
    "amount": estimated price in local currency,
    "currency": "USD"/"EUR"/"SEK"
  },
  "style": {
    "body": "Light-bodied"/"Medium-bodied"/"Full-bodied",
    "acidity": "Low"/"Medium"/"High",
    "tannins": "Low"/"Medium"/"High" (for reds)
  },
  "foodPairings": ["food1", "food2", "food3"],
  "drinkingWindow": {
    "start": year,
    "end": year
  },
  "description": "brief tasting description (1-2 sentences)"
}

Important:
- Use web search to find accurate, current information
- If wine is not found, set found: false and provide partial data if possible
- For ratings, prefer Vivino or Wine-Searcher averages
- Prices should reflect current market value
- Return ONLY the JSON, no markdown or explanations`;

export async function POST(request: NextRequest) {
  try {
    const { query, vintage } = await request.json();
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      // Enable Google Search grounding for accurate wine data
      tools: [{ googleSearch: {} }]
    });

    const prompt = WINE_LOOKUP_PROMPT
      .replace("{query}", query)
      .replace("{vintage}", vintage || "");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse wine data" },
        { status: 422 }
      );
    }

    const wineData = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, data: wineData });

  } catch (error) {
    console.error("Wine lookup error:", error);
    return NextResponse.json(
      { error: "Failed to lookup wine" },
      { status: 500 }
    );
  }
}
```

---

## Implementation: Barcode Scanner

### Install Dependencies
```bash
npm install html5-qrcode
```

### Barcode Scanner Component

```typescript
// src/components/wine/BarcodeScanner.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "barcode-reader",
      { fps: 10, qrbox: { width: 250, height: 100 } },
      false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Success - barcode scanned
        onScan(decodedText);
        scannerRef.current?.clear();
      },
      (errorMessage) => {
        // Scan error - ignore continuous errors
        if (!errorMessage.includes("No barcode")) {
          setError(errorMessage);
        }
      }
    );

    return () => {
      scannerRef.current?.clear();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-wine-600" />
            <span className="font-medium">Scan Wine Barcode</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div id="barcode-reader" className="w-full" />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
          <p className="mt-4 text-sm text-gray-500 text-center">
            Point your camera at the barcode on the wine bottle
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Open Food Facts Lookup

```typescript
// src/lib/openfoodfacts.ts

export interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  origins?: string;
  categories_tags?: string[];
  alcohol_value?: number;
  image_url?: string;
}

export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    );
    const data = await response.json();
    
    if (data.status !== 1) {
      return null;
    }
    
    return data.product;
  } catch (error) {
    console.error("Open Food Facts lookup error:", error);
    return null;
  }
}

export function mapOFFToWineData(product: OFFProduct): Partial<WineFormData> {
  // Determine wine type from categories
  const categories = product.categories_tags || [];
  let wineType: WineType | undefined;
  
  if (categories.some(c => c.includes("red-wine"))) wineType = "red";
  else if (categories.some(c => c.includes("white-wine"))) wineType = "white";
  else if (categories.some(c => c.includes("rose-wine"))) wineType = "rosé";
  else if (categories.some(c => c.includes("sparkling"))) wineType = "sparkling";
  
  return {
    name: product.product_name || "",
    winery: product.brands || "",
    country: product.origins || "",
    wineType,
    alcoholContent: product.alcohol_value,
  };
}
```

---

## User Interface Updates

### Add Import Options to WineForm

```typescript
// In WineForm.tsx, add these import options before the form fields:

{/* Quick Import Options */}
<div className="grid grid-cols-3 gap-3 mb-6">
  {/* Photo Analysis */}
  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-wine-400 hover:bg-wine-50 transition-colors"
  >
    <Camera className="w-6 h-6 text-gray-400" />
    <span className="text-xs text-gray-600">Photo</span>
  </button>

  {/* Barcode Scanner */}
  <button
    type="button"
    onClick={() => setShowBarcodeScanner(true)}
    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-wine-400 hover:bg-wine-50 transition-colors"
  >
    <Barcode className="w-6 h-6 text-gray-400" />
    <span className="text-xs text-gray-600">Barcode</span>
  </button>

  {/* Text Search */}
  <button
    type="button"
    onClick={() => setShowVivinoSearch(true)}
    className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-wine-400 hover:bg-wine-50 transition-colors"
  >
    <Search className="w-6 h-6 text-gray-400" />
    <span className="text-xs text-gray-600">Search</span>
  </button>
</div>
```

---

## Comparison Matrix

| Feature | Photo (Gemini) | Vivino | Gemini+Search | Barcode | Open Food Facts |
|---------|----------------|--------|---------------|---------|-----------------|
| **Effort to Implement** | ✅ Done | ⚠️ Done (unreliable) | 🟡 Low | 🟡 Medium | 🟡 Low |
| **Reliability** | ✅ High | ❌ Low | ✅ High | ✅ High | 🟡 Medium |
| **Coverage** | ✅ Any wine | ✅ Most wines | ✅ Any wine | 🟡 Retail wines | 🟡 Some wines |
| **Speed** | 🟡 2-3s | ✅ <1s | 🟡 3-4s | ✅ Instant | ✅ <1s |
| **User Experience** | ✅ Great | 🟡 OK | 🟡 OK | ✅ Great | 🟡 OK |
| **Ratings** | ❌ No | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Food Pairings** | ❌ No | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Cost** | Gemini API | Free | Gemini API | Free | Free |

---

## Recommendation Summary

### Best for Most Users:
1. **Keep Photo Analysis (Gemini)** - Works great for any wine
2. **Add Gemini Web Search** - Gets ratings, pairings from multiple sources  
3. **Add Barcode Scanner** - Super fast for retail wines

### Implementation Priority:
1. ⭐ Gemini Web Search (lowest effort, high value)
2. ⭐ Barcode + Open Food Facts (great UX for store-bought wines)
3. Keep Vivino as fallback (may work sometimes)
4. Consider CellarTracker import for power users

This approach gives users **three easy ways** to add wines:
- 📸 **Snap a photo** of the label
- 📱 **Scan the barcode** (for retail wines)
- 🔍 **Search by name** (AI-powered web search)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/wine/lookup/route.ts` | New: AI web search endpoint |
| `src/components/wine/BarcodeScanner.tsx` | New: Barcode scanner component |
| `src/lib/openfoodfacts.ts` | New: Open Food Facts API client |
| `src/components/wine/WineForm.tsx` | Add import options UI |
| `package.json` | Add html5-qrcode dependency |

**Estimated Total Effort**: 6-10 hours for Phase 1+2
