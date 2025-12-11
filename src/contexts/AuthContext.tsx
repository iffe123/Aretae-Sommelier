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
  signInWithRedirect,
  getRedirectResult,
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
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    debugLog('[Auth] AuthProvider useEffect starting');

    if (!auth) {
      console.error('[Auth] Firebase auth not initialized');
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setCheckingRedirect(false);
        setLoading(false);
      });
      return;
    }

    debugLog('[Auth] Firebase auth is valid');

    let authStateResolved = false;
    let redirectCheckResolved = false;

    const tryFinishLoading = () => {
      // Only finish loading when both checks are complete
      if (authStateResolved && redirectCheckResolved) {
        debugLog('[Auth] Both auth state and redirect check resolved, finishing loading');
        setLoading(false);
        setCheckingRedirect(false);
      }
    };

    // Clear the OAuth redirect marker helper
    const clearOAuthMarker = () => {
      if (typeof sessionStorage !== "undefined") {
        debugLog('[Auth] Clearing oauth_redirect_pending marker');
        sessionStorage.removeItem("oauth_redirect_pending");
      }
    };

    // Handle redirect result from Google sign-in (for mobile devices)
    // This must complete before we consider auth loading to be done
    debugLog('[Auth] Calling getRedirectResult...');
    getRedirectResult(auth)
      .then((result) => {
        debugLog('[Auth] getRedirectResult:', result ? `has user: ${result.user?.email}` : 'no result');
        if (result?.user) {
          // User successfully authenticated via redirect
          setUser(result.user);
        }
        // ALWAYS clear the marker, not just on success
        clearOAuthMarker();
        redirectCheckResolved = true;
        tryFinishLoading();
      })
      .catch((error) => {
        console.error("[Auth] Redirect sign-in error:", error);
        // Clear the OAuth redirect marker on error
        clearOAuthMarker();
        redirectCheckResolved = true;
        tryFinishLoading();
      });

    // Fallback timeout to prevent infinite loading on mobile
    // This handles edge cases where getRedirectResult might hang
    const timeoutId = setTimeout(() => {
      if (!redirectCheckResolved) {
        console.warn("[Auth] OAuth redirect check timed out - clearing redirect state");
        clearOAuthMarker();
        redirectCheckResolved = true;
        tryFinishLoading();
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      debugLog('[Auth] onAuthStateChanged:', authUser ? `user: ${authUser.email}` : 'no user');
      setUser(authUser);
      authStateResolved = true;
      tryFinishLoading();
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
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

    // Detect if we should use redirect (mobile devices, in-app browsers, etc.)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isInAppBrowser = /FBAN|FBAV|Instagram|Twitter|Line/i.test(navigator.userAgent);

    debugLog('[Auth] Device detection:', { isMobile, isInAppBrowser, userAgent: navigator.userAgent });

    if (isMobile || isInAppBrowser) {
      debugLog('[Auth] Using redirect flow for mobile/in-app browser');
      // Set marker before redirect so we know we're in OAuth flow when returning
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("oauth_redirect_pending", "true");
      }
      // Use redirect flow for mobile - more reliable than popups
      await signInWithRedirect(auth, provider);
    } else {
      // Use popup for desktop - better UX
      debugLog('[Auth] Using popup flow for desktop');
      try {
        const result = await signInWithPopup(auth, provider);
        debugLog('[Auth] Popup sign-in successful:', result.user?.email);
      } catch (error: unknown) {
        console.error('[Auth] Popup sign-in error:', error);
        // If popup is blocked or fails, fallback to redirect
        const firebaseError = error as { code?: string; message?: string };
        if (firebaseError.code === 'auth/popup-blocked' ||
            firebaseError.code === 'auth/popup-closed-by-user') {
          debugLog('[Auth] Popup blocked/closed, falling back to redirect');
          // Set marker before redirect
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("oauth_redirect_pending", "true");
          }
          await signInWithRedirect(auth, provider);
        } else {
          throw error;
        }
      }
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
