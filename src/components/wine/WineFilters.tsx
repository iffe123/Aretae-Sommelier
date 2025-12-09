"use client";

import { WineFilterOptions } from "@/types/wine";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface WineFiltersProps {
  filters: WineFilterOptions;
  onFilterChange: (filters: WineFilterOptions) => void;
  grapeVarieties?: string[];
  countries?: string[];
  regions?: string[];
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function WineFilters({
  filters,
  onFilterChange,
  grapeVarieties = [],
  countries = [],
  regions = [],
}: WineFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 300);
  const isFirstRender = useRef(true);

  // Update filters when debounced search changes
  useEffect(() => {
    // Skip the first render to avoid triggering on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onFilterChange({ ...filters, search: debouncedSearch || undefined });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = useCallback((key: keyof WineFilterOptions, value: unknown) => {
    onFilterChange({ ...filters, [key]: value || undefined });
  }, [filters, onFilterChange]);

  const clearFilters = () => {
    onFilterChange({ search: filters.search });
  };

  const hasActiveFilters =
    filters.grapeVariety ||
    filters.country ||
    filters.region ||
    filters.minRating ||
    filters.isWishlist !== undefined;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          id="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search wines..."
          className="pl-10 pr-10"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-wine-100 text-wine-700 text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-wine-600 hover:text-wine-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <Select
            id="grapeVariety"
            label="Grape"
            value={filters.grapeVariety || ""}
            onChange={(e) => updateFilter("grapeVariety", e.target.value)}
            options={[
              { value: "", label: "All grapes" },
              ...grapeVarieties.map((g) => ({ value: g, label: g })),
            ]}
          />

          <Select
            id="country"
            label="Country"
            value={filters.country || ""}
            onChange={(e) => updateFilter("country", e.target.value)}
            options={[
              { value: "", label: "All countries" },
              ...countries.map((c) => ({ value: c, label: c })),
            ]}
          />

          <Select
            id="region"
            label="Region"
            value={filters.region || ""}
            onChange={(e) => updateFilter("region", e.target.value)}
            options={[
              { value: "", label: "All regions" },
              ...regions.map((r) => ({ value: r, label: r })),
            ]}
          />

          <Select
            id="minRating"
            label="Min Rating"
            value={filters.minRating?.toString() || ""}
            onChange={(e) =>
              updateFilter("minRating", e.target.value ? parseInt(e.target.value) : undefined)
            }
            options={[
              { value: "", label: "Any rating" },
              { value: "5", label: "5 stars" },
              { value: "4", label: "4+ stars" },
              { value: "3", label: "3+ stars" },
              { value: "2", label: "2+ stars" },
              { value: "1", label: "1+ stars" },
            ]}
          />

          <div className="col-span-2 sm:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="wishlistFilter"
                  checked={filters.isWishlist === undefined}
                  onChange={() => updateFilter("isWishlist", undefined)}
                  className="text-wine-600 focus:ring-wine-500"
                />
                <span className="text-sm">All</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="wishlistFilter"
                  checked={filters.isWishlist === false}
                  onChange={() => updateFilter("isWishlist", false)}
                  className="text-wine-600 focus:ring-wine-500"
                />
                <span className="text-sm">In Cellar</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="wishlistFilter"
                  checked={filters.isWishlist === true}
                  onChange={() => updateFilter("isWishlist", true)}
                  className="text-wine-600 focus:ring-wine-500"
                />
                <span className="text-sm">Wishlist</span>
              </label>
            </div>
          </div>

          <div className="col-span-2">
            <Select
              id="sortBy"
              label="Sort by"
              value={filters.sortBy || "createdAt"}
              onChange={(e) =>
                updateFilter("sortBy", e.target.value as WineFilterOptions["sortBy"])
              }
              options={[
                { value: "createdAt", label: "Recently added" },
                { value: "name", label: "Name" },
                { value: "vintage", label: "Vintage" },
                { value: "rating", label: "Rating" },
                { value: "price", label: "Price" },
              ]}
            />
          </div>

          <div className="col-span-2">
            <Select
              id="sortOrder"
              label="Order"
              value={filters.sortOrder || "desc"}
              onChange={(e) =>
                updateFilter("sortOrder", e.target.value as "asc" | "desc")
              }
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
