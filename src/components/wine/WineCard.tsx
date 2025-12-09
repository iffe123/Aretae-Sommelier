"use client";

import Image from "next/image";
import Link from "next/link";
import { Wine } from "@/types/wine";
import StarRating from "@/components/ui/StarRating";
import { Wine as WineIcon, Heart, MapPin } from "lucide-react";

interface WineCardProps {
  wine: Wine;
}

export default function WineCard({ wine }: WineCardProps) {
  return (
    <Link href={`/cellar/${wine.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
        <div className="relative aspect-[4/3] bg-wine-50">
          {wine.photoUrl ? (
            <Image
              src={wine.photoUrl}
              alt={wine.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <WineIcon className="w-16 h-16 text-wine-200" />
            </div>
          )}
          {wine.isWishlist && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{wine.name}</h3>
              <p className="text-sm text-gray-600 truncate">{wine.winery}</p>
            </div>
            <span className="flex-shrink-0 text-sm font-medium text-wine-600 bg-wine-50 px-2 py-1 rounded">
              {wine.vintage}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <span className="px-2 py-0.5 bg-gray-100 rounded-full">
              {wine.grapeVariety}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {wine.region}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            {wine.rating ? (
              <StarRating rating={wine.rating} size="sm" readonly />
            ) : (
              <span className="text-xs text-gray-400">Not rated</span>
            )}
            <span className="text-sm font-medium text-gray-900">
              ${wine.price.toFixed(2)}
            </span>
          </div>

          {!wine.isWishlist && wine.bottlesOwned > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {wine.bottlesOwned} bottle{wine.bottlesOwned !== 1 ? "s" : ""} in cellar
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
