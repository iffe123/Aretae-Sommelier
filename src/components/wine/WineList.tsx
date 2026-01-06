"use client";

import { Wine } from "@/types/wine";
import WineCard from "./WineCard";
import { Wine as WineIcon, Plus, Search } from "lucide-react";
import Button from "@/components/ui/Button";

interface WineListProps {
  wines: Wine[];
  loading?: boolean;
  emptyMessage?: string;
  isFilterActive?: boolean;
  onAddWine?: () => void;
  onClearFilters?: () => void;
  isSelectionMode?: boolean;
  selectedWineIds?: string[];
  onToggleSelect?: (wine: Wine) => void;
}

export default function WineList({
  wines,
  loading,
  emptyMessage = "No wines found",
  isFilterActive = false,
  onAddWine,
  onClearFilters,
  isSelectionMode = false,
  selectedWineIds = [],
  onToggleSelect,
}: WineListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="aspect-[4/3] skeleton-shimmer" />
            <div className="p-4 space-y-3">
              <div className="h-5 skeleton-shimmer rounded w-3/4" />
              <div className="h-4 skeleton-shimmer rounded w-1/2" />
              <div className="flex gap-2">
                <div className="h-6 skeleton-shimmer rounded-full w-16" />
                <div className="h-6 skeleton-shimmer rounded-full w-20" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="w-4 h-4 skeleton-shimmer rounded" />
                  ))}
                </div>
                <div className="h-5 skeleton-shimmer rounded w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (wines.length === 0) {
    // Different empty states based on context
    if (isFilterActive) {
      return (
        <div className="text-center py-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4 hover-bounce">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No wines match your search
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Try adjusting your filters or search terms to find what you&apos;re looking for.
          </p>
          {onClearFilters && (
            <Button variant="outline" onClick={onClearFilters}>
              Clear All Filters
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="text-center py-16 animate-fade-in">
        {/* Decorative wine illustration */}
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-wine-100 to-wine-200 rounded-full flex items-center justify-center hover-bounce">
            <WineIcon className="w-12 h-12 text-wine-500" />
          </div>
          <div className="absolute -right-2 -top-2 w-8 h-8 bg-wine-500 rounded-full flex items-center justify-center shadow-lg">
            <Plus className="w-5 h-5 text-white" />
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {emptyMessage}
        </h3>
        <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
          Your wine cellar is waiting to be filled! Add your first bottle to start tracking your collection,
          get AI-powered recommendations, and discover the perfect pairings.
        </p>

        {/* Feature highlights */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 max-w-lg mx-auto">
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
            <span className="text-lg">📸</span>
            <span>Scan wine labels</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
            <span className="text-lg">🤖</span>
            <span>AI sommelier</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
            <span className="text-lg">🍽️</span>
            <span>Food pairings</span>
          </div>
        </div>

        {onAddWine && (
          <Button onClick={onAddWine} size="lg">
            <Plus className="w-5 h-5 mr-2" />
            Add Your First Wine
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {wines.map((wine) => (
        <WineCard
          key={wine.id}
          wine={wine}
          isSelectionMode={isSelectionMode}
          isSelected={selectedWineIds.includes(wine.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
