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
}

export interface WineFormData {
  name: string;
  winery: string;
  vintage: number;
  grapeVariety: string;
  region: string;
  country: string;
  price: number | undefined;
  photo?: File;
  rating?: number;
  tastingNotes?: string;
  bottlesOwned: number;
  storageLocation?: string;
  isWishlist: boolean;
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
