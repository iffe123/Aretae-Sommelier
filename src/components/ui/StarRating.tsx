"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

export default function StarRating({
  rating,
  maxRating = 5,
  onChange,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div
      className="flex gap-1"
      role={readonly ? "img" : "radiogroup"}
      aria-label={readonly ? `Rating: ${rating} out of ${maxRating} stars` : "Rate this wine"}
    >
      {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          aria-pressed={!readonly ? star <= rating : undefined}
          tabIndex={readonly ? -1 : 0}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110 focus:outline-none focus:ring-2 focus:ring-wine-500 focus:ring-offset-1 rounded"} transition-transform`}
        >
          <Star
            className={`${sizes[size]} ${
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-gray-300"
            }`}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
