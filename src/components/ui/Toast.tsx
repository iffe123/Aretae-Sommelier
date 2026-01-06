"use client";

import { useEffect, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: "bg-white border-l-4 border-l-green-500 border-gray-200",
  error: "bg-white border-l-4 border-l-red-500 border-gray-200",
  warning: "bg-white border-l-4 border-l-amber-500 border-gray-200",
  info: "bg-white border-l-4 border-l-blue-500 border-gray-200",
};

const iconStyles = {
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

const progressStyles = {
  success: "bg-green-500",
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

export default function Toast({
  message,
  type = "info",
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    if (duration > 0 && !isPaused) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, handleClose, isPaused]);

  if (!isVisible) return null;

  const Icon = icons[type];

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border shadow-lg
        ${styles[type]}
        ${isExiting ? "animate-toast-out" : "animate-toast-in"}
      `}
      role="alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`flex-shrink-0 p-1 rounded-full ${iconStyles[type]} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${iconStyles[type]}`} />
        </div>
        <div className="flex-1 pt-0.5">
          <p className="text-sm font-medium text-gray-900">{message}</p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-full transition-colors group"
          aria-label="Close notification"
        >
          <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
          <div
            className={`h-full ${progressStyles[type]} toast-progress`}
            style={{
              animationDuration: `${duration}ms`,
              animationPlayState: isPaused ? "paused" : "running"
            }}
          />
        </div>
      )}
    </div>
  );
}

// Toast Container for managing multiple toasts
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastType = "info", duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showSuccess = (message: string) => addToast(message, "success");
  const showError = (message: string) => addToast(message, "error", 7000);
  const showWarning = (message: string) => addToast(message, "warning");
  const showInfo = (message: string) => addToast(message, "info");

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
