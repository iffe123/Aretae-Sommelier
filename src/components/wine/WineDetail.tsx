"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Wine } from "@/types/wine";
import { deleteWine } from "@/lib/wine-service";
import Button from "@/components/ui/Button";
import StarRating from "@/components/ui/StarRating";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import SommelierChat from "@/components/chat/SommelierChat";
import { getFirestoreErrorMessage } from "@/lib/error-utils";
import {
  Wine as WineIcon,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  Heart,
  Edit,
  Trash2,
  MessageCircle,
  ArrowLeft,
  ChevronRight,
  Star,
  ExternalLink,
  Gauge,
  Droplets,
  Utensils,
  Grape,
  Award,
  Clock,
} from "lucide-react";
import { WINE_TYPES } from "@/types/wine";

interface WineDetailProps {
  wine: Wine;
  onEdit: () => void;
}

export default function WineDetail({ wine, onEdit }: WineDetailProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const { toasts, removeToast, showError } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteWine(wine.id);
      router.push("/cellar");
    } catch (error) {
      console.error("Error deleting wine:", error);
      showError(getFirestoreErrorMessage(error));
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // Get wine type info
  const wineTypeInfo = wine.wineType 
    ? WINE_TYPES.find(t => t.value === wine.wineType) 
    : null;

  const infoItems = [
    { icon: Calendar, label: "Vintage", value: wine.vintage },
    { icon: Grape, label: "Grape", value: wine.grapeVariety },
    ...(wineTypeInfo ? [{ 
      icon: WineIcon, 
      label: "Type", 
      value: `${wineTypeInfo.emoji} ${wineTypeInfo.label}` 
    }] : []),
    ...(wine.classification ? [{ 
      icon: Award, 
      label: "Classification", 
      value: wine.classification 
    }] : []),
    {
      icon: MapPin,
      label: "Origin",
      value: `${wine.region}, ${wine.country}`,
    },
    {
      icon: DollarSign,
      label: "Price",
      value: wine.price != null ? `${wine.price.toFixed(0)} kr` : "—",
    },
    ...(wine.alcoholContent ? [{
      icon: Gauge,
      label: "Alcohol",
      value: `${wine.alcoholContent}%`,
    }] : []),
    {
      icon: Package,
      label: "In Cellar",
      value: `${wine.bottlesOwned} bottle${wine.bottlesOwned !== 1 ? "s" : ""}`,
    },
  ];

  if (wine.storageLocation) {
    infoItems.push({
      icon: Package,
      label: "Location",
      value: wine.storageLocation,
    });
  }

  // Calculate drinking window status
  const getDrinkingStatus = () => {
    if (!wine.drinkingWindowStart || !wine.drinkingWindowEnd) return null;
    const currentYear = new Date().getFullYear();
    if (currentYear < wine.drinkingWindowStart) {
      return { emoji: "⏳", label: "Still Aging", color: "text-amber-600", bg: "bg-amber-50" };
    } else if (currentYear > wine.drinkingWindowEnd) {
      return { emoji: "🔴", label: "Past Peak", color: "text-red-600", bg: "bg-red-50" };
    } else {
      return { emoji: "🟢", label: "Ready Now", color: "text-green-600", bg: "bg-green-50" };
    }
  };

  const drinkingStatus = getDrinkingStatus();

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Hero Image */}
        <div className="relative h-64 sm:h-80 bg-wine-100">
          {wine.photoUrl ? (
            <Image
              src={wine.photoUrl}
              alt={wine.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <WineIcon className="w-24 h-24 text-wine-200" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" aria-hidden="true" />
          </button>

          {/* Wishlist Badge */}
          {wine.isWishlist && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span className="text-sm font-medium text-gray-700">Wishlist</span>
            </div>
          )}

          {/* Title */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {wine.name}
            </h1>
            <p className="text-white/80">{wine.winery}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 max-w-2xl mx-auto">
          {/* Rating */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Your Rating</p>
                <StarRating rating={wine.rating || 0} size="lg" readonly />
              </div>
              {wine.rating && (
                <span className="text-3xl font-bold text-wine-600">
                  {wine.rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 divide-y">
            {infoItems.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 bg-wine-50 rounded-full flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-wine-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <p className="font-medium text-gray-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tasting Notes */}
          {wine.tastingNotes && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
              <h2 className="font-semibold text-gray-900 mb-2">Tasting Notes</h2>
              <p className="text-gray-600 whitespace-pre-wrap">
                {wine.tastingNotes}
              </p>
            </div>
          )}

          {/* Drinking Window */}
          {(wine.drinkingWindowStart && wine.drinkingWindowEnd) && (
            <div className={`rounded-xl p-4 shadow-sm border mb-4 ${drinkingStatus?.bg || 'bg-white'} border-gray-100`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Clock className="w-5 h-5 text-wine-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Drinking Window</p>
                    <p className="font-semibold text-gray-900">
                      {wine.drinkingWindowStart} - {wine.drinkingWindowEnd}
                    </p>
                  </div>
                </div>
                {drinkingStatus && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${drinkingStatus.bg}`}>
                    <span>{drinkingStatus.emoji}</span>
                    <span className={`text-sm font-medium ${drinkingStatus.color}`}>
                      {drinkingStatus.label}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vivino Data */}
          {(wine.vivinoRating || wine.body || wine.acidity || (wine.foodPairings && wine.foodPairings.length > 0)) && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">From Vivino</h2>
                {wine.vivinoUrl && (
                  <a
                    href={wine.vivinoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-wine-600 hover:text-wine-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Vivino
                  </a>
                )}
              </div>

              {/* Vivino Rating */}
              {wine.vivinoRating !== undefined && wine.vivinoRating > 0 && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="text-xl font-bold text-gray-900">
                      {wine.vivinoRating.toFixed(1)}
                    </span>
                  </div>
                  {wine.vivinoRatingsCount !== undefined && (
                    <span className="text-sm text-gray-500">
                      ({wine.vivinoRatingsCount.toLocaleString()} ratings)
                    </span>
                  )}
                </div>
              )}

              {/* Body and Acidity */}
              {(wine.body || wine.acidity) && (
                <div className="grid grid-cols-2 gap-4 mb-3">
                  {wine.body && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-wine-50 rounded-full flex items-center justify-center">
                        <Gauge className="w-4 h-4 text-wine-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Body</p>
                        <p className="text-sm font-medium text-gray-900">{wine.body}</p>
                      </div>
                    </div>
                  )}
                  {wine.acidity && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-wine-50 rounded-full flex items-center justify-center">
                        <Droplets className="w-4 h-4 text-wine-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Acidity</p>
                        <p className="text-sm font-medium text-gray-900">{wine.acidity}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Food Pairings */}
              {wine.foodPairings && wine.foodPairings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Utensils className="w-4 h-4 text-wine-500" />
                    <span className="text-sm text-gray-500">Pairs well with:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wine.foodPairings.map((food, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-wine-50 text-wine-700"
                      >
                        {food}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sommelier Button */}
          <button
            onClick={() => setShowChat(true)}
            className="w-full bg-wine-600 hover:bg-wine-700 text-white rounded-xl p-4 shadow-sm flex items-center justify-between transition-colors mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-wine-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Ask the Sommelier</p>
                <p className="text-sm text-wine-200">
                  Get pairing tips, serving advice & more
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-wine-200" />
          </button>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onEdit} className="flex-1">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Wine"
        message={
          <>
            Are you sure you want to delete <strong>&quot;{wine.name}&quot;</strong> from your collection?
            This action cannot be undone.
          </>
        }
        confirmText="Delete Wine"
        cancelText="Keep Wine"
        variant="danger"
        isLoading={deleting}
      />

      {/* Sommelier Chat */}
      <SommelierChat
        wineContext={wine}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
