"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export default function NetworkStatus() {
  // Initialize with a function to read navigator.onLine only on client-side
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showBanner, setShowBanner] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" message briefly
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300 ${
        isOnline
          ? "bg-green-500 text-white"
          : "bg-amber-500 text-white"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline && <WifiOff className="w-4 h-4" />}
        {isOnline
          ? "You're back online!"
          : "You're offline - some features may not work"}
      </div>
    </div>
  );
}
