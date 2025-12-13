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
            className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
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
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
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
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-wine-100 rounded-full mb-4">
          <WineIcon className="w-10 h-10 text-wine-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {emptyMessage}
        </h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Start building your wine collection by adding your first bottle.
        </p>
        {onAddWine && (
          <Button onClick={onAddWine}>
            <Plus className="w-4 h-4 mr-2" />
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
