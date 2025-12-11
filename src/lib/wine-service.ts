import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { Wine, WineFormData, WineFilterOptions } from "@/types/wine";

const WINES_COLLECTION = "wines";

/**
 * Sanitize a string input by stripping HTML tags and trimming whitespace.
 * Preserves special characters that are legitimate in wine names (accents, &, etc.)
 */
function sanitizeString(value: string | undefined | null): string {
  if (!value) return '';
  // Strip HTML tags while preserving text content
  const withoutTags = value.replace(/<[^>]*>/g, '');
  // Trim whitespace and normalize internal whitespace
  return withoutTags.trim().replace(/\s+/g, ' ');
}

export async function uploadWinePhoto(
  userId: string,
  file: File
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase storage is not initialized");
  }
  const fileExtension = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}.${fileExtension}`;
  const storageRef = ref(storage, `wine-photos/${fileName}`);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteWinePhoto(photoUrl: string): Promise<void> {
  if (!storage) {
    throw new Error("Firebase storage is not initialized");
  }
  if (!photoUrl) {
    return; // No photo to delete
  }
  try {
    // Extract the storage path from the full Firebase Storage URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?token=...
    // The path is URL-encoded, so we need to decode it
    let storagePath = photoUrl;

    if (photoUrl.includes('firebasestorage.googleapis.com')) {
      const match = photoUrl.match(/\/o\/(.+?)\?/);
      if (match) {
        storagePath = decodeURIComponent(match[1]);
      }
    }

    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    // Log error but don't throw - photo deletion failure shouldn't block wine deletion
    console.error("Error deleting photo:", error);
  }
}

export async function addWine(
  userId: string,
  data: WineFormData
): Promise<string> {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized");
  }
  let photoUrl: string | undefined;

  if (data.photo) {
    photoUrl = await uploadWinePhoto(userId, data.photo);
  }

  // Sanitize all string fields and prevent undefined values in Firestore
  const wineData = {
    userId,
    name: sanitizeString(data.name),
    winery: sanitizeString(data.winery),
    vintage: data.vintage || null,
    grapeVariety: sanitizeString(data.grapeVariety),
    region: sanitizeString(data.region),
    country: sanitizeString(data.country),
    price: data.price || 0,
    photoUrl: photoUrl || '',  // Never undefined!
    rating: data.rating || 0,
    tastingNotes: sanitizeString(data.tastingNotes),
    bottlesOwned: data.bottlesOwned ?? 1,
    storageLocation: sanitizeString(data.storageLocation),
    isWishlist: data.isWishlist || false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, WINES_COLLECTION), wineData);
  return docRef.id;
}

export async function updateWine(
  wineId: string,
  data: Partial<WineFormData>,
  existingPhotoUrl?: string
): Promise<void> {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized");
  }
  let photoUrl = existingPhotoUrl;

  if (data.photo) {
    if (existingPhotoUrl) {
      await deleteWinePhoto(existingPhotoUrl);
    }
    const userId = (await getWine(wineId))?.userId;
    if (userId) {
      photoUrl = await uploadWinePhoto(userId, data.photo);
    }
  }

  // Sanitize string fields before update
  const sanitizedData: Record<string, unknown> = {};
  const stringFields = ['name', 'winery', 'grapeVariety', 'region', 'country', 'tastingNotes', 'storageLocation'];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'photo') continue; // Skip photo field
    if (stringFields.includes(key) && typeof value === 'string') {
      sanitizedData[key] = sanitizeString(value);
    } else {
      sanitizedData[key] = value;
    }
  }

  const updateData: Record<string, unknown> = {
    ...sanitizedData,
    updatedAt: Timestamp.now(),
  };

  if (photoUrl !== undefined) {
    updateData.photoUrl = photoUrl;
  }

  await updateDoc(doc(db, WINES_COLLECTION, wineId), updateData);
}

export async function deleteWine(wineId: string): Promise<void> {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized");
  }
  const wine = await getWine(wineId);
  if (wine?.photoUrl) {
    await deleteWinePhoto(wine.photoUrl);
  }
  await deleteDoc(doc(db, WINES_COLLECTION, wineId));
}

export async function getWine(wineId: string): Promise<Wine | null> {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized");
  }
  const docSnap = await getDoc(doc(db, WINES_COLLECTION, wineId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate(),
    updatedAt: data.updatedAt?.toDate(),
  } as Wine;
}

export async function getUserWines(
  userId: string,
  filters?: WineFilterOptions
): Promise<Wine[]> {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized");
  }
  let q = query(
    collection(db, WINES_COLLECTION),
    where("userId", "==", userId)
  );

  // Note: isWishlist filter moved to client-side to handle missing/undefined fields
  // Firestore's where("isWishlist", "==", false) doesn't match documents where field is missing

  if (filters?.minRating) {
    q = query(q, where("rating", ">=", filters.minRating));
  }

  const sortField = filters?.sortBy || "createdAt";
  const sortOrder = filters?.sortOrder || "desc";
  q = query(q, orderBy(sortField, sortOrder));

  const querySnapshot = await getDocs(q);
  let wines = querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    } as Wine;
  });

  // Client-side filtering for text search
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    wines = wines.filter(
      (wine) =>
        wine.name.toLowerCase().includes(searchLower) ||
        wine.winery.toLowerCase().includes(searchLower) ||
        wine.grapeVariety.toLowerCase().includes(searchLower) ||
        wine.region.toLowerCase().includes(searchLower) ||
        wine.country.toLowerCase().includes(searchLower)
    );
  }

  if (filters?.grapeVariety) {
    wines = wines.filter((wine) =>
      wine.grapeVariety.toLowerCase().includes(filters.grapeVariety!.toLowerCase())
    );
  }

  if (filters?.country) {
    wines = wines.filter((wine) =>
      wine.country.toLowerCase().includes(filters.country!.toLowerCase())
    );
  }

  if (filters?.region) {
    wines = wines.filter((wine) =>
      wine.region.toLowerCase().includes(filters.region!.toLowerCase())
    );
  }

  if (filters?.storageLocation) {
    wines = wines.filter((wine) =>
      wine.storageLocation?.toLowerCase().includes(filters.storageLocation!.toLowerCase())
    );
  }

  // Client-side isWishlist filter to handle missing/undefined fields correctly
  // When filtering for cellar wines (isWishlist: false), include wines where:
  // - isWishlist is explicitly false
  // - isWishlist is undefined, null, or missing (legacy wines)
  if (filters?.isWishlist !== undefined) {
    if (filters.isWishlist === true) {
      // Only include explicit wishlist items
      wines = wines.filter((wine) => wine.isWishlist === true);
    } else {
      // Include non-wishlist items (false, undefined, null, missing)
      wines = wines.filter((wine) => wine.isWishlist !== true);
    }
  }

  return wines;
}

export async function getUniqueValues(
  userId: string,
  field: "grapeVariety" | "country" | "region" | "storageLocation"
): Promise<string[]> {
  const wines = await getUserWines(userId);
  const values = new Set(
    wines.map((wine) => wine[field]).filter((v): v is string => Boolean(v))
  );
  return Array.from(values).sort();
}
