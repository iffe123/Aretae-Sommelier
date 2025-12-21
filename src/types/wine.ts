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
  grapeVariety?: string;
  country?: string;
  region?: string;
  storageLocation?: string;
  minRating?: number;
  isWishlist?: boolean;
  sortBy?: "name" | "vintage" | "rating" | "price" | "createdAt";
  sortOrder?: "asc" | "desc";
};
