"use client";

import { ReactNode, useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  // Handle body overflow
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-modal-backdrop-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative w-full ${sizeClasses[size]} rounded-2xl bg-white p-6 shadow-2xl animate-modal-content-in`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            {title && (
              <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
                {title}
              </h2>
            )}
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors ml-auto group"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          </div>

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );
}
