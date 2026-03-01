import { initializeApp, getApps, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

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
    // Fall back to Application Default Credentials (e.g. when running on GCP)
    adminApp = initializeApp({
      credential: applicationDefault(),
    });
  }

  return adminApp;
}

export async function verifyIdToken(token: string): Promise<{ uid: string }> {
  const app = getAdminApp();
  const auth = getAuth(app);
  const decodedToken = await auth.verifyIdToken(token);
  return { uid: decodedToken.uid };
}
