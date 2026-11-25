import { AI_RATE_LIMIT_POLICIES, RATE_LIMIT_COLLECTION, createRateLimitDocId } from "@/lib/ai-rate-limit";
import { getAdminAuth, getAdminFirestore, getAdminStorageBucket } from "@/lib/firebase-admin";
import type { AIEndpoint } from "@/lib/observability";

/**
 * In-app account deletion (required by App Store Review Guideline 5.1.1(v) and GDPR art. 17).
 *
 * Order matters: user data is removed first and the Auth user last. If any data step
 * fails we stop before deleting the Auth user, so the person can sign in and retry
 * instead of leaving orphaned data behind an account that no longer exists.
 */

export const WINES_COLLECTION = "wines";
export const WINE_PHOTOS_PREFIX = "wine-photos";
const FIRESTORE_BATCH_LIMIT = 400;

export interface AccountDeletionDeps {
  deleteWines(uid: string): Promise<number>;
  deleteRateLimitRecords(uid: string): Promise<void>;
  deletePhotos(uid: string): Promise<void>;
  deleteAuthUser(uid: string): Promise<void>;
}

export interface AccountDeletionResult {
  winesDeleted: number;
}

export class AccountDeletionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountDeletionConfigError";
  }
}

export async function deleteAccount(
  uid: string,
  deps: AccountDeletionDeps
): Promise<AccountDeletionResult> {
  if (!uid || typeof uid !== "string") {
    throw new Error("A user id is required to delete an account.");
  }

  const winesDeleted = await deps.deleteWines(uid);
  await deps.deletePhotos(uid);
  await deps.deleteRateLimitRecords(uid);
  await deps.deleteAuthUser(uid);

  return { winesDeleted };
}

/** Wires the deletion steps to Firebase Admin. Throws AccountDeletionConfigError if Admin is not configured. */
export function createFirebaseAccountDeletionDeps(): AccountDeletionDeps {
  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const bucket = getAdminStorageBucket();

  if (!db || !auth || !bucket) {
    throw new AccountDeletionConfigError(
      "Account deletion requires FIREBASE_SERVICE_ACCOUNT_KEY and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  return {
    async deleteWines(uid) {
      let deleted = 0;
      // Query in pages so large cellars stay within Firestore batch limits.
      for (;;) {
        const snapshot = await db
          .collection(WINES_COLLECTION)
          .where("userId", "==", uid)
          .limit(FIRESTORE_BATCH_LIMIT)
          .get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deleted += snapshot.size;
      }
      return deleted;
    },

    async deleteRateLimitRecords(uid) {
      const batch = db.batch();
      (Object.keys(AI_RATE_LIMIT_POLICIES) as AIEndpoint[]).forEach((endpoint) => {
        batch.delete(db.collection(RATE_LIMIT_COLLECTION).doc(createRateLimitDocId(endpoint, uid)));
      });
      await batch.commit();
    },

    async deletePhotos(uid) {
      await bucket.deleteFiles({ prefix: `${WINE_PHOTOS_PREFIX}/${uid}/` });
    },

    async deleteAuthUser(uid) {
      try {
        await auth.deleteUser(uid);
      } catch (error) {
        // Already gone counts as success, so a retry after a partial failure completes cleanly.
        if ((error as { code?: string }).code === "auth/user-not-found") return;
        throw error;
      }
    },
  };
}
