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

export async function uploadWinePhoto(
  userId: string,
  file: File
): Promise<string> {
  const fileExtension = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}.${fileExtension}`;
  const storageRef = ref(storage, `wine-photos/${fileName}`);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteWinePhoto(photoUrl: string): Promise<void> {
  try {
    const storageRef = ref(storage, photoUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting photo:", error);
  }
}

export async function addWine(
  userId: string,
  data: WineFormData
): Promise<string> {
  let photoUrl: string | undefined;

  if (data.photo) {
    photoUrl = await uploadWinePhoto(userId, data.photo);
  }

  const wineData = {
    userId,
    name: data.name,
    winery: data.winery,
    vintage: data.vintage,
    grapeVariety: data.grapeVariety,
    region: data.region,
    country: data.country,
    price: data.price,
    photoUrl: photoUrl || '',
    rating: data.rating,
    tastingNotes: data.tastingNotes,
    bottlesOwned: data.bottlesOwned,
    storageLocation: data.storageLocation,
    isWishlist: data.isWishlist,
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

  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  if (photoUrl !== undefined) {
    updateData.photoUrl = photoUrl;
  }

  delete updateData.photo;

  await updateDoc(doc(db, WINES_COLLECTION, wineId), updateData);
}

export async function deleteWine(wineId: string): Promise<void> {
  const wine = await getWine(wineId);
  if (wine?.photoUrl) {
    await deleteWinePhoto(wine.photoUrl);
  }
  await deleteDoc(doc(db, WINES_COLLECTION, wineId));
}

export async function getWine(wineId: string): Promise<Wine | null> {
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
  let q = query(
    collection(db, WINES_COLLECTION),
    where("userId", "==", userId)
  );

  if (filters?.isWishlist !== undefined) {
    q = query(q, where("isWishlist", "==", filters.isWishlist));
  }

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

  return wines;
}

export async function getUniqueValues(
  userId: string,
  field: "grapeVariety" | "country" | "region"
): Promise<string[]> {
  const wines = await getUserWines(userId);
  const values = new Set(wines.map((wine) => wine[field]).filter(Boolean));
  return Array.from(values).sort();
}
