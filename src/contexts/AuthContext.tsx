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

    if (!auth) {
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setCheckingRedirect(false);
        setLoading(false);
      });
      return;
    }

    let authStateResolved = false;
    let redirectCheckResolved = false;

    const tryFinishLoading = () => {
      // Only finish loading when both checks are complete
      if (authStateResolved && redirectCheckResolved) {
        setLoading(false);
        setCheckingRedirect(false);
      }
    };

    // Handle redirect result from Google sign-in (for mobile devices)
    // This must complete before we consider auth loading to be done
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          // User successfully authenticated via redirect
          setUser(result.user);
          // Clear the OAuth redirect marker since auth succeeded
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("oauth_redirect_pending");
          }
        }
        redirectCheckResolved = true;
        tryFinishLoading();
      })
      .catch((error) => {
        console.error("Redirect sign-in error:", error);
        // Clear the OAuth redirect marker on error
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("oauth_redirect_pending");
        }
        redirectCheckResolved = true;
        tryFinishLoading();
      });

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      authStateResolved = true;
      tryFinishLoading();
    });

    return () => unsubscribe();
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
    if (!auth) throw new Error("Firebase auth not initialized");
    const provider = new GoogleAuthProvider();

    // Detect if we should use redirect (mobile devices, in-app browsers, etc.)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isInAppBrowser = /FBAN|FBAV|Instagram|Twitter|Line/i.test(navigator.userAgent);

    if (isMobile || isInAppBrowser) {
      // Set marker before redirect so we know we're in OAuth flow when returning
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("oauth_redirect_pending", "true");
      }
      // Use redirect flow for mobile - more reliable than popups
      await signInWithRedirect(auth, provider);
    } else {
      // Use popup for desktop - better UX
      try {
        await signInWithPopup(auth, provider);
      } catch (error: unknown) {
        // If popup is blocked or fails, fallback to redirect
        const firebaseError = error as { code?: string };
        if (firebaseError.code === 'auth/popup-blocked' ||
            firebaseError.code === 'auth/popup-closed-by-user') {
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
