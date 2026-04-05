import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { isPlaceholderValue } from "@/lib/env";

let adminApp: App | undefined;
const FIREBASE_AUTH_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

interface FirebaseLookupResponse {
  users?: Array<{
    localId?: string;
  }>;
  error?: {
    message?: string;
  };
}

function getServiceAccountKey(): string | undefined {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey || isPlaceholderValue(serviceAccountKey)) {
    return undefined;
  }

  return serviceAccountKey;
}

function getFirebaseWebApiKey(): string | undefined {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || isPlaceholderValue(apiKey)) {
    return undefined;
  }

  return apiKey;
}

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const serviceAccountKey = getServiceAccountKey();

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (error) {
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }
  } else {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or provide NEXT_PUBLIC_FIREBASE_API_KEY for REST fallback verification."
    );
  }

  return adminApp;
}

async function verifyIdTokenWithRestFallback(token: string): Promise<{ uid: string }> {
  const apiKey = getFirebaseWebApiKey();

  if (!apiKey) {
    throw new Error(
      "Firebase token verification fallback is not configured. Missing NEXT_PUBLIC_FIREBASE_API_KEY."
    );
  }

  const response = await fetch(
    `${FIREBASE_AUTH_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    }
  );

  const payload = await response.json().catch(() => ({} as FirebaseLookupResponse));

  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Firebase Auth lookup failed with status ${response.status}`
    );
  }

  const uid = payload.users?.[0]?.localId;
  if (!uid) {
    throw new Error("Firebase Auth lookup succeeded without returning a user ID.");
  }

  return { uid };
}

export async function verifyIdToken(token: string): Promise<{ uid: string }> {
  const serviceAccountKey = getServiceAccountKey();

  if (serviceAccountKey) {
    try {
      const app = getAdminApp();
      const auth = getAuth(app);
      const decodedToken = await auth.verifyIdToken(token);
      return { uid: decodedToken.uid };
    } catch (error) {
      if (!getFirebaseWebApiKey()) {
        throw error;
      }

      console.warn(
        "[Firebase Admin] verifyIdToken failed, falling back to Firebase Auth REST lookup.",
        error
      );
    }
  }

  return verifyIdTokenWithRestFallback(token);
}

export function getAdminFirestore(): Firestore | null {
  if (!getServiceAccountKey()) {
    return null;
  }

  const app = getAdminApp();
  return getFirestore(app);
}
