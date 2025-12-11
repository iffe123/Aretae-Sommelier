"use client";

import { useState, useRef } from "react";
import { Wine, WineFormData } from "@/types/wine";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TextArea from "@/components/ui/TextArea";
import StarRating from "@/components/ui/StarRating";
import { Camera, X, Loader2, AlertCircle } from "lucide-react";
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
    bottlesOwned: initialData?.bottlesOwned || 1,
    storageLocation: initialData?.storageLocation || "",
    isWishlist: initialData?.isWishlist || false,
  });

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
      }));
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
          value={formData.bottlesOwned}
          onChange={(e) =>
            setFormData({ ...formData, bottlesOwned: parseInt(e.target.value) || 0 })
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
