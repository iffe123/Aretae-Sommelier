// Wine type classification
export type WineType = "red" | "white" | "rosé" | "sparkling" | "dessert" | "fortified" | "orange";

export const WINE_TYPES: { value: WineType; label: string; emoji: string }[] = [
  { value: "red", label: "Red", emoji: "🍷" },
  { value: "white", label: "White", emoji: "🥂" },
  { value: "rosé", label: "Rosé", emoji: "🌸" },
  { value: "sparkling", label: "Sparkling", emoji: "🍾" },
  { value: "dessert", label: "Dessert", emoji: "🍯" },
  { value: "fortified", label: "Fortified", emoji: "🥃" },
  { value: "orange", label: "Orange", emoji: "🍊" },
];

export interface Wine {
  id: string;
  userId: string;
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  price: number;
  photoUrl?: string;
  rating?: number;
  tastingNotes?: string;
  bottlesOwned: number;
  storageLocation?: string;
  isWishlist: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Wine classification
  wineType?: WineType; // red, white, rosé, sparkling, dessert, fortified, orange
  classification?: string; // e.g., Grand Cru, Reserva, Premier Cru
  alcoholContent?: number; // Alcohol percentage (e.g., 13.5)
  // AI-suggested drinking window (can override heuristic calculation)
  drinkingWindowStart?: number; // Year to start drinking
  drinkingWindowEnd?: number; // Year to stop drinking
  // Vivino-populated fields
  vivinoRating?: number; // Vivino average rating (1-5 scale)
  vivinoRatingsCount?: number; // Number of ratings on Vivino
  vivinoUrl?: string; // Link to wine on Vivino
  body?: string; // Light-bodied, Medium-bodied, Full-bodied
  acidity?: string; // Low, Medium, High
  foodPairings?: string[]; // Array of food pairing suggestions
}

export interface WineFormData {
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  price?: number;
  photo?: File;
  rating?: number;
  tastingNotes?: string;
  bottlesOwned?: number;
  storageLocation?: string;
  isWishlist: boolean;
  // Wine classification
  wineType?: WineType;
  classification?: string;
  alcoholContent?: number;
  // AI-suggested drinking window
  drinkingWindowStart?: number;
  drinkingWindowEnd?: number;
  // Vivino-populated fields
  vivinoRating?: number;
  vivinoRatingsCount?: number;
  vivinoUrl?: string;
  body?: string;
  acidity?: string;
  foodPairings?: string[];
}

export type WineFilterOptions = {
  search?: string;
  wineType?: WineType;
  grapeVariety?: string;
  country?: string;
  region?: string;
  storageLocation?: string;
  minRating?: number;
  isWishlist?: boolean;
  sortBy?: "name" | "vintage" | "rating" | "price" | "createdAt";
  sortOrder?: "asc" | "desc";
};
