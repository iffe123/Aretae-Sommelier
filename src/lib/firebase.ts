import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Firebase Configuration
 *
 * IMPORTANT: All environment variables must be prefixed with NEXT_PUBLIC_ to be
 * available in the browser.
 *
 * Required environment variables (set in .env.local):
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * DEBUGGING AUTHENTICATION ISSUES:
 *
 * 1. Verify Firebase Console Setup:
 *    - Go to Firebase Console → Authentication → Sign-in method
 *    - Ensure "Email/Password" provider is ENABLED
 *    - For Google sign-in, ensure "Google" provider is ENABLED
 *
 * 2. Check User Exists:
 *    - Go to Firebase Console → Authentication → Users tab
 *    - Search for the user's email address
 *    - Verify account is not disabled
 *
 * 3. Common Authentication Issues:
 *    - "auth/invalid-credential": User doesn't exist OR wrong password
 *      (Firebase combines these for security - prevents user enumeration)
 *    - "auth/user-not-found": No user with this email (older Firebase versions)
 *    - "auth/wrong-password": Incorrect password (older Firebase versions)
 *    - "auth/too-many-requests": Account temporarily locked due to many failed attempts
 *
 * 4. Test Authentication:
 *    - Create a new test user in Firebase Console → Authentication → Users → Add user
 *    - Try signing in with those credentials
 *    - Check browser console for detailed error codes
 *
 * 5. Verify Environment Variables:
 *    - Run: console.log('Firebase API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
 *    - If undefined, check .env.local file and restart the dev server
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize Firebase on the client side
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

if (typeof window !== 'undefined') {
  // Check for missing configuration in development
  if (process.env.NODE_ENV === 'development') {
    const missingVars = Object.entries(firebaseConfig)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.warn(
        '[Firebase] Missing environment variables:',
        missingVars.join(', '),
        '\nCheck your .env.local file and restart the dev server.'
      );
    }
  }

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Explicitly set auth persistence to local storage
  // This ensures the session persists across browser restarts and tabs
  // Firebase ID tokens expire after 1 hour, but the SDK automatically refreshes them
  // using the refresh token stored in IndexedDB/localStorage
  if (auth) {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error('[Firebase] Failed to set auth persistence:', error);
    });
  }

  // Log successful initialization in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Firebase] Initialized successfully for project:', firebaseConfig.projectId);
  }
}

export { app, auth, db, storage };
