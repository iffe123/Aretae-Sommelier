"use client";

import { useState, useRef } from "react";
import { Wine, WineFormData, WineType, WINE_TYPES } from "@/types/wine";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TextArea from "@/components/ui/TextArea";
import StarRating from "@/components/ui/StarRating";
import Select from "@/components/ui/Select";
import { Camera, X, Loader2, AlertCircle, Search, Wine as WineIcon, Star, ExternalLink, Utensils, Droplets, Gauge, Calendar } from "lucide-react";
import Image from "next/image";
import { validateImageFile, getStorageErrorMessage, formatFileSize, MAX_FILE_SIZE } from "@/lib/error-utils";
import { validateWineForm, WineFormErrors, LIMITS } from "@/lib/validation";

interface WineLabelData {
  name: string | null;
  winery: string | null;
  vintage: number | null;
  grapeVariety: string | null;
  region: string | null;
  country: string | null;
  wineType: WineType | null;
  classification: string | null;
  alcoholContent: number | null;
  drinkingWindowStart: number | null;
  drinkingWindowEnd: number | null;
}

// Vivino wine data structure (matches lib/vivino.ts)
interface VivinoWine {
  id: string;
  name: string;
  winery: string;
  region: string;
  country: string;
  grapeVariety?: string;
  vintage?: string;
  averageRating: number;
  ratingsCount: number;
  price?: {
    amount: number;
    currency: string;
  };
  imageUrl?: string;
  style?: {
    body?: string;
    acidity?: string;
    tannins?: string;
  };
  foodPairings?: string[];
  description?: string;
  vivinoUrl?: string;
}

interface WineFormProps {
  initialData?: Wine;
  onSubmit: (data: WineFormData) => Promise<void>;
  onCancel: () => void;
}

export default function WineForm({ initialData, onSubmit, onCancel }: WineFormProps) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<WineFormErrors>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialData?.photoUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vivino integration state
  const [vivinoSearching, setVivinoSearching] = useState(false);
  const [vivinoResults, setVivinoResults] = useState<VivinoWine[]>([]);
  const [vivinoError, setVivinoError] = useState<string | null>(null);
  const [showVivinoSearch, setShowVivinoSearch] = useState(false);
  const [vivinoSearchQuery, setVivinoSearchQuery] = useState("");
  const [selectedVivinoWine, setSelectedVivinoWine] = useState<VivinoWine | null>(null);

  const [formData, setFormData] = useState<WineFormData>({
    name: initialData?.name || "",
    winery: initialData?.winery || "",
    vintage: initialData?.vintage || new Date().getFullYear(),
    grapeVariety: initialData?.grapeVariety || "",
    region: initialData?.region || "",
    country: initialData?.country || "",
    price: initialData?.price,
    rating: initialData?.rating,
    tastingNotes: initialData?.tastingNotes || "",
    // Only show actual value if > 0, otherwise leave empty for placeholder
    bottlesOwned: initialData?.bottlesOwned && initialData.bottlesOwned > 0 ? initialData.bottlesOwned : undefined,
    storageLocation: initialData?.storageLocation || "",
    isWishlist: initialData?.isWishlist || false,
    // Wine classification
    wineType: initialData?.wineType,
    classification: initialData?.classification || "",
    alcoholContent: initialData?.alcoholContent,
    // Drinking window
    drinkingWindowStart: initialData?.drinkingWindowStart,
    drinkingWindowEnd: initialData?.drinkingWindowEnd,
    // Vivino-populated fields
    vivinoRating: initialData?.vivinoRating,
    vivinoRatingsCount: initialData?.vivinoRatingsCount,
    vivinoUrl: initialData?.vivinoUrl,
    body: initialData?.body || "",
    acidity: initialData?.acidity || "",
    foodPairings: initialData?.foodPairings || [],
  });

  // Search Vivino for wine data
  const searchVivino = async (query: string, vintage?: string) => {
    if (!query.trim()) return;

    setVivinoSearching(true);
    setVivinoError(null);
    setVivinoResults([]);
    setSelectedVivinoWine(null);

    try {
      const response = await fetch("/api/wine/vivino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query: query.trim(),
          vintage,
          limit: 5,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Don't show error for "not found" - just empty results
        if (response.status === 404) {
          setVivinoResults([]);
        } else if (response.status === 503 || data.code === "SERVICE_UNAVAILABLE") {
          // Service temporarily unavailable - show friendly message
          setVivinoError("Vivino lookup is temporarily unavailable. You can still add wine details manually.");
        } else {
          throw new Error(data.error || "Failed to search Vivino");
        }
        return;
      }

      const wines = data.data?.wines || [];
      setVivinoResults(wines);

      // If exactly one result, auto-select it
      if (wines.length === 1) {
        applyVivinoWine(wines[0]);
      }
    } catch (error) {
      console.error("Vivino search error:", error);
      setVivinoError(
        error instanceof Error
          ? error.message
          : "Failed to search Vivino"
      );
    } finally {
      setVivinoSearching(false);
    }
  };

  // Apply Vivino wine data to form
  const applyVivinoWine = (wine: VivinoWine) => {
    setSelectedVivinoWine(wine);
    setFormData((prev) => ({
      ...prev,
      // Only fill if currently empty or use Vivino data to enrich
      name: prev.name || wine.name,
      winery: prev.winery || wine.winery,
      grapeVariety: prev.grapeVariety || wine.grapeVariety || prev.grapeVariety,
      region: prev.region || wine.region,
      country: prev.country || wine.country,
      vintage: wine.vintage ? parseInt(wine.vintage) : prev.vintage,
      // Use Vivino price if we don't have one (price is displayed in kr)
      price: prev.price === undefined && wine.price?.amount
        ? Math.round(wine.price.amount)
        : prev.price,
      // Vivino-specific fields - always update with Vivino data
      vivinoRating: wine.averageRating,
      vivinoRatingsCount: wine.ratingsCount,
      vivinoUrl: wine.vivinoUrl,
      body: wine.style?.body || prev.body,
      acidity: wine.style?.acidity || prev.acidity,
      foodPairings: wine.foodPairings || prev.foodPairings,
    }));

    // Hide the search panel after selection
    setShowVivinoSearch(false);
  };

  // Handle manual Vivino search
  const handleVivinoSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (vivinoSearchQuery.trim()) {
      searchVivino(vivinoSearchQuery, formData.vintage?.toString());
    }
  };

  const analyzeWineLabel = async (imageBase64: string, mimeType: string) => {
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze-wine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze wine label");
      }

      const wineData: WineLabelData = data.data;

      // Auto-fill form fields with extracted data
      setFormData((prev) => ({
        ...prev,
        name: wineData.name || prev.name,
        winery: wineData.winery || prev.winery,
        vintage: wineData.vintage || prev.vintage,
        grapeVariety: wineData.grapeVariety || prev.grapeVariety,
        region: wineData.region || prev.region,
        country: wineData.country || prev.country,
        wineType: wineData.wineType || prev.wineType,
        classification: wineData.classification || prev.classification,
        alcoholContent: wineData.alcoholContent || prev.alcoholContent,
        drinkingWindowStart: wineData.drinkingWindowStart || prev.drinkingWindowStart,
        drinkingWindowEnd: wineData.drinkingWindowEnd || prev.drinkingWindowEnd,
      }));

      // After Gemini analysis, search Vivino for additional details
      const wineName = wineData.name || wineData.winery;
      if (wineName) {
        const searchQuery = [wineData.winery, wineData.name].filter(Boolean).join(" ");
        searchVivino(searchQuery, wineData.vintage?.toString());
      }
    } catch (error) {
      console.error("Wine label analysis error:", error);
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Couldn't read label - please fill in details manually"
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file before processing
      setPhotoError(null);
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setPhotoError(validation.error || 'Invalid file');
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setFormData({ ...formData, photo: file });
      const reader = new FileReader();
      reader.onerror = () => {
        setPhotoError('Failed to read file. Please try again.');
      };
      reader.onloadend = () => {
        const base64Result = reader.result as string;
        setPhotoPreview(base64Result);

        // Analyze the wine label with Gemini Vision
        const mimeType = file.type || "image/jpeg";
        analyzeWineLabel(base64Result, mimeType);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, photo: undefined });
    setPhotoPreview(null);
    setPhotoError(null);
    setAnalysisError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setValidationErrors({});

    // Validate form data
    const validation = validateWineForm(formData);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setSubmitError('Please fix the errors above before submitting.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Error submitting wine:", error);
      // Use storage error message if it looks like a storage error
      const errorCode = (error as { code?: string })?.code || '';
      if (errorCode.startsWith('storage/')) {
        setSubmitError(getStorageErrorMessage(error));
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : 'Failed to save wine. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Submit Error */}
      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wine Label Photo
          <span className="text-gray-400 font-normal ml-1">(max {formatFileSize(MAX_FILE_SIZE)})</span>
        </label>
        <div className="relative">
          {photoPreview ? (
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={photoPreview}
                alt="Wine label"
                fill
                className="object-cover"
              />
              {/* Analyzing overlay */}
              {analyzing && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                  <span className="text-white text-sm font-medium">Analyzing label...</span>
                </div>
              )}
              {!analyzing && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-wine-400 hover:bg-wine-50 transition-colors"
            >
              <Camera className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Add photo</span>
              <span className="text-xs text-gray-400 mt-1">AI will auto-fill details</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
            disabled={analyzing}
          />
        </div>
        {/* Photo error message */}
        {photoError && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {photoError}
          </p>
        )}
        {/* Analysis error message */}
        {analysisError && !photoError && (
          <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
            {analysisError}
          </p>
        )}
      </div>

      {/* Vivino Search Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <WineIcon className="w-5 h-5 text-wine-600" />
            <span className="text-sm font-medium text-gray-700">Vivino Lookup</span>
          </div>
          <button
            type="button"
            onClick={() => setShowVivinoSearch(!showVivinoSearch)}
            className="text-sm text-wine-600 hover:text-wine-700 font-medium"
          >
            {showVivinoSearch ? "Hide" : "Search Vivino"}
          </button>
        </div>

        {/* Vivino searching indicator */}
        {vivinoSearching && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Searching Vivino...</span>
          </div>
        )}

        {/* Vivino error */}
        {vivinoError && (
          <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded mb-3">
            {vivinoError}
          </p>
        )}

        {/* Selected Vivino wine info */}
        {selectedVivinoWine && !showVivinoSearch && (
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-wine-200">
            {selectedVivinoWine.imageUrl && (
              <div className="relative w-12 h-16 flex-shrink-0">
                <Image
                  src={selectedVivinoWine.imageUrl}
                  alt={selectedVivinoWine.name}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedVivinoWine.winery} {selectedVivinoWine.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs text-gray-600">
                    {selectedVivinoWine.averageRating.toFixed(1)} ({selectedVivinoWine.ratingsCount.toLocaleString()} ratings)
                  </span>
                </div>
              </div>
              {selectedVivinoWine.vivinoUrl && (
                <a
                  href={selectedVivinoWine.vivinoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-wine-600 hover:text-wine-700 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Vivino
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedVivinoWine(null);
                setShowVivinoSearch(true);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Manual search form */}
        {showVivinoSearch && (
          <div className="space-y-3">
            <form onSubmit={handleVivinoSearch} className="flex gap-2">
              <input
                type="text"
                value={vivinoSearchQuery}
                onChange={(e) => setVivinoSearchQuery(e.target.value)}
                placeholder="Search wine name..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-wine-500 focus:border-wine-500"
              />
              <button
                type="submit"
                disabled={vivinoSearching || !vivinoSearchQuery.trim()}
                className="px-4 py-2 bg-wine-600 text-white text-sm rounded-lg hover:bg-wine-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </form>

            {/* Quick search from form data */}
            {(formData.name || formData.winery) && !vivinoSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  const query = [formData.winery, formData.name].filter(Boolean).join(" ");
                  setVivinoSearchQuery(query);
                  searchVivino(query, formData.vintage?.toString());
                }}
                className="text-sm text-wine-600 hover:text-wine-700"
              >
                Search for “{[formData.winery, formData.name].filter(Boolean).join(" ")}”
              </button>
            )}

            {/* Vivino search results */}
            {vivinoResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <p className="text-xs text-gray-500">
                  {vivinoResults.length} result{vivinoResults.length !== 1 ? "s" : ""} found. Select one to auto-fill:
                </p>
                {vivinoResults.map((wine) => (
                  <button
                    key={wine.id}
                    type="button"
                    onClick={() => applyVivinoWine(wine)}
                    className={`w-full flex items-start gap-3 p-3 bg-white rounded-lg border hover:border-wine-300 transition-colors text-left ${
                      selectedVivinoWine?.id === wine.id ? "border-wine-500 ring-1 ring-wine-500" : "border-gray-200"
                    }`}
                  >
                    {wine.imageUrl && (
                      <div className="relative w-10 h-14 flex-shrink-0">
                        <Image
                          src={wine.imageUrl}
                          alt={wine.name}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {wine.winery} {wine.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {wine.vintage && `${wine.vintage} • `}
                        {wine.region}, {wine.country}
                      </p>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs text-gray-600">
                            {wine.averageRating.toFixed(1)}
                          </span>
                        </div>
                        {wine.price && (
                          <span className="text-xs text-gray-600">
                            {wine.price.amount.toFixed(0)} {wine.price.currency}
                          </span>
                        )}
                        {wine.grapeVariety && (
                          <span className="text-xs text-gray-500 truncate">
                            {wine.grapeVariety}
                          </span>
                        )}
                      </div>
                      {/* Show available Vivino data */}
                      {(wine.style?.body || wine.style?.acidity || wine.foodPairings) && (
                        <div className="flex items-center flex-wrap gap-2 mt-1.5 text-xs">
                          {wine.style?.body && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <Gauge className="w-3 h-3" />
                              {wine.style.body}
                            </span>
                          )}
                          {wine.style?.acidity && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <Droplets className="w-3 h-3" />
                              {wine.style.acidity} acidity
                            </span>
                          )}
                          {wine.foodPairings && wine.foodPairings.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <Utensils className="w-3 h-3" />
                              {wine.foodPairings.length} pairings
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {vivinoResults.length === 0 && !vivinoSearching && vivinoSearchQuery && !vivinoError && (
              <p className="text-sm text-gray-500 text-center py-2">
                No wines found. Try a different search term.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input
            id="name"
            label="Wine Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Château Margaux"
            maxLength={LIMITS.name}
            error={validationErrors.name}
            required
          />
        </div>

        <div className="col-span-2">
          <Input
            id="winery"
            label="Winery *"
            value={formData.winery}
            onChange={(e) => setFormData({ ...formData, winery: e.target.value })}
            placeholder="e.g., Château Margaux"
            maxLength={LIMITS.winery}
            error={validationErrors.winery}
            required
          />
        </div>

        <Input
          id="vintage"
          label="Vintage *"
          type="number"
          min={1900}
          max={new Date().getFullYear()}
          value={formData.vintage}
          onChange={(e) =>
            setFormData({ ...formData, vintage: parseInt(e.target.value) || 0 })
          }
          error={validationErrors.vintage}
          required
        />

        <Select
          id="wineType"
          label="Wine Type"
          value={formData.wineType || ""}
          onChange={(e) =>
            setFormData({ ...formData, wineType: (e.target.value as WineType) || undefined })
          }
          options={[
            { value: "", label: "Select type..." },
            ...WINE_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` })),
          ]}
        />

        <Input
          id="grapeVariety"
          label="Grape Variety *"
          value={formData.grapeVariety}
          onChange={(e) =>
            setFormData({ ...formData, grapeVariety: e.target.value })
          }
          placeholder="e.g., Cabernet Sauvignon"
          maxLength={LIMITS.grapeVariety}
          error={validationErrors.grapeVariety}
          required
        />

        <Input
          id="classification"
          label="Classification"
          value={formData.classification}
          onChange={(e) =>
            setFormData({ ...formData, classification: e.target.value })
          }
          placeholder="e.g., Grand Cru, Reserva"
          maxLength={100}
        />
      </div>

      {/* Location */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="region"
          label="Region *"
          value={formData.region}
          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
          placeholder="e.g., Bordeaux"
          maxLength={LIMITS.region}
          error={validationErrors.region}
          required
        />

        <Input
          id="country"
          label="Country *"
          value={formData.country}
          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          placeholder="e.g., France"
          maxLength={LIMITS.country}
          error={validationErrors.country}
          required
        />
      </div>

      {/* Price and Inventory */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="price"
          label="Price (kr) *"
          type="number"
          min={0}
          step={0.01}
          value={formData.price ?? ''}
          placeholder="0"
          onChange={(e) =>
            setFormData({ ...formData, price: e.target.value === '' ? undefined : parseFloat(e.target.value) })
          }
          error={validationErrors.price}
          required
        />

        <Input
          id="bottlesOwned"
          label="Bottles Owned"
          type="number"
          min={0}
          value={formData.bottlesOwned ?? ''}
          placeholder="1"
          onChange={(e) =>
            setFormData({ ...formData, bottlesOwned: e.target.value === '' ? undefined : parseInt(e.target.value) })
          }
          error={validationErrors.bottlesOwned}
        />
      </div>

      <Input
        id="storageLocation"
        label="Storage Location"
        value={formData.storageLocation}
        onChange={(e) =>
          setFormData({ ...formData, storageLocation: e.target.value })
        }
        placeholder="e.g., Wine fridge, Rack A3"
        maxLength={LIMITS.storageLocation}
        error={validationErrors.storageLocation}
      />

      {/* Additional Wine Details */}
      <div className="grid grid-cols-3 gap-4">
        <Input
          id="alcoholContent"
          label="Alcohol %"
          type="number"
          min={0}
          max={25}
          step={0.1}
          value={formData.alcoholContent ?? ""}
          placeholder="13.5"
          onChange={(e) =>
            setFormData({ ...formData, alcoholContent: e.target.value === "" ? undefined : parseFloat(e.target.value) })
          }
        />

        <Input
          id="drinkingWindowStart"
          label="Drink From"
          type="number"
          min={1900}
          max={2100}
          value={formData.drinkingWindowStart ?? ""}
          placeholder={`${new Date().getFullYear()}`}
          onChange={(e) =>
            setFormData({ ...formData, drinkingWindowStart: e.target.value === "" ? undefined : parseInt(e.target.value) })
          }
        />

        <Input
          id="drinkingWindowEnd"
          label="Drink Until"
          type="number"
          min={1900}
          max={2100}
          value={formData.drinkingWindowEnd ?? ""}
          placeholder={`${new Date().getFullYear() + 5}`}
          onChange={(e) =>
            setFormData({ ...formData, drinkingWindowEnd: e.target.value === "" ? undefined : parseInt(e.target.value) })
          }
        />
      </div>

      {/* AI-suggested Drinking Window indicator */}
      {formData.drinkingWindowStart && formData.drinkingWindowEnd && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          <Calendar className="w-4 h-4 text-wine-500" />
          <span>
            Drinking window: <span className="font-medium">{formData.drinkingWindowStart} - {formData.drinkingWindowEnd}</span>
            {(() => {
              const currentYear = new Date().getFullYear();
              if (currentYear < formData.drinkingWindowStart) {
                return <span className="ml-2 text-amber-600">(⏳ Still aging)</span>;
              } else if (currentYear > formData.drinkingWindowEnd) {
                return <span className="ml-2 text-red-600">(🔴 Past peak)</span>;
              } else {
                return <span className="ml-2 text-green-600">(🟢 Ready now)</span>;
              }
            })()}
          </span>
        </div>
      )}

      {/* Vivino Auto-populated Wine Characteristics */}
      {(formData.body || formData.acidity || formData.vivinoRating || (formData.foodPairings && formData.foodPairings.length > 0)) && (
        <div className="border border-wine-200 rounded-lg p-4 bg-wine-50/50 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <WineIcon className="w-4 h-4 text-wine-600" />
            <span className="text-sm font-medium text-wine-700">From Vivino</span>
            {formData.vivinoUrl && (
              <a
                href={formData.vivinoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-wine-600 hover:text-wine-700"
              >
                <ExternalLink className="w-3 h-3" />
                View on Vivino
              </a>
            )}
          </div>

          {/* Vivino Rating */}
          {formData.vivinoRating !== undefined && formData.vivinoRating > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-medium text-gray-900">
                {formData.vivinoRating.toFixed(1)}
              </span>
              {formData.vivinoRatingsCount !== undefined && (
                <span className="text-gray-500">
                  ({formData.vivinoRatingsCount.toLocaleString()} ratings)
                </span>
              )}
            </div>
          )}

          {/* Body and Acidity */}
          <div className="grid grid-cols-2 gap-4">
            {formData.body && (
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="w-4 h-4 text-wine-500" />
                <div>
                  <span className="text-gray-500">Body: </span>
                  <span className="font-medium text-gray-900">{formData.body}</span>
                </div>
              </div>
            )}
            {formData.acidity && (
              <div className="flex items-center gap-2 text-sm">
                <Droplets className="w-4 h-4 text-wine-500" />
                <div>
                  <span className="text-gray-500">Acidity: </span>
                  <span className="font-medium text-gray-900">{formData.acidity}</span>
                </div>
              </div>
            )}
          </div>

          {/* Food Pairings */}
          {formData.foodPairings && formData.foodPairings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm mb-2">
                <Utensils className="w-4 h-4 text-wine-500" />
                <span className="text-gray-500">Food Pairings:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.foodPairings.map((food, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-wine-100 text-wine-700"
                  >
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wishlist Toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isWishlist"
          checked={formData.isWishlist}
          onChange={(e) =>
            setFormData({ ...formData, isWishlist: e.target.checked })
          }
          className="w-4 h-4 text-wine-600 border-gray-300 rounded focus:ring-wine-500"
        />
        <label htmlFor="isWishlist" className="text-sm text-gray-700">
          Add to wishlist (wine I want to try)
        </label>
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rating
        </label>
        <StarRating
          rating={formData.rating || 0}
          onChange={(rating) => setFormData({ ...formData, rating })}
          size="lg"
        />
      </div>

      {/* Tasting Notes */}
      <TextArea
        id="tastingNotes"
        label={`Tasting Notes (${formData.tastingNotes?.length || 0}/${LIMITS.tastingNotes})`}
        value={formData.tastingNotes}
        onChange={(e) =>
          setFormData({ ...formData, tastingNotes: e.target.value })
        }
        placeholder="Describe the aroma, flavor, body, finish..."
        rows={4}
        maxLength={LIMITS.tastingNotes}
        error={validationErrors.tastingNotes}
      />

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={analyzing}>
          Cancel
        </Button>
        <Button type="submit" isLoading={loading} className="flex-1" disabled={analyzing}>
          {initialData ? "Save Changes" : "Add Wine"}
        </Button>
      </div>
    </form>
  );
}
