"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// Development-only logging helper
const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkingRedirect: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // No longer checking redirects - popup-only auth (redirect is broken on modern browsers
  // due to third-party cookie blocking since June 2024)
  const [checkingRedirect] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    debugLog('[Auth] AuthProvider useEffect starting');

    if (!auth) {
      console.error('[Auth] Firebase auth not initialized');
      queueMicrotask(() => {
        setLoading(false);
      });
      return;
    }

    debugLog('[Auth] Firebase auth is valid');

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      debugLog('[Auth] onAuthStateChanged:', authUser ? `user: ${authUser.email}` : 'no user');
      setUser(authUser);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase auth not initialized");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    if (!auth) throw new Error("Firebase auth not initialized");
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
  };

  const signInWithGoogle = async () => {
    debugLog('[Auth] signInWithGoogle called');

    if (!auth) {
      console.error('[Auth] Firebase auth not initialized');
      throw new Error("Firebase auth not initialized");
    }

    const provider = new GoogleAuthProvider();

    // Always use popup - redirect flow is broken on modern browsers (Chrome 115+,
    // Safari 16.1+, Firefox 109+) due to third-party cookie blocking since June 2024.
    // Popups work on mobile browsers and provide better UX.
    debugLog('[Auth] Using popup flow for Google sign-in');

    try {
      const result = await signInWithPopup(auth, provider);
      debugLog('[Auth] Popup sign-in successful:', result.user?.email);
    } catch (error: unknown) {
      console.error('[Auth] Popup sign-in error:', error);
      const firebaseError = error as { code?: string; message?: string };

      // Handle specific popup errors with user-friendly messages
      if (firebaseError.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.');
      }
      if (firebaseError.code === 'auth/popup-closed-by-user') {
        // User closed the popup - not an error, just cancelled
        debugLog('[Auth] User closed the popup');
        return;
      }
      if (firebaseError.code === 'auth/cancelled-popup-request') {
        // Another popup was opened - ignore
        debugLog('[Auth] Popup request was cancelled');
        return;
      }

      throw error;
    }
  };

  const signOut = async () => {
    if (!auth) throw new Error("Firebase auth not initialized");
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Firebase auth not initialized");
    // Note: Firebase will send email even if account doesn't exist (security best practice)
    // to prevent user enumeration attacks
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, checkingRedirect, signIn, signUp, signInWithGoogle, signOut, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
